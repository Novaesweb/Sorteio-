import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runServerlessRequest } from '../server/serverless.mjs';
import { createBlobStore } from '../server/blob-store.mjs';
import { family } from '../server/db.mjs';

class Conflict extends Error {}
function memoryStore(){
 let state=null,version=0,writes=0,conflicts=0;
 return {
  async read(){return state?{bytes:Buffer.from(state),etag:String(version)}:null;},
  async write(bytes,etag){await Promise.resolve();if(etag!==(state?String(version):null)){conflicts++;throw new Conflict();}state=Buffer.from(bytes);version++;writes++;},
  isConflict(error){return error instanceof Conflict;},
  metrics:()=>({writes,conflicts})
 };
}
const request=(store,path,data,cookie='',options={})=>runServerlessRequest(store,{
 method:data===undefined?'GET':'POST',url:'/api'+path,
 headers:{cookie,...(data===undefined?{}:{'content-type':'application/json',origin:'https://familia.test'})},
 rawBody:data===undefined?'':JSON.stringify(data),address:options.address||'family'
},{origin:'https://familia.test',pause:()=>Promise.resolve(),...options}).then(r=>({...r,data:JSON.parse(r.body),cookie:r.headers['set-cookie']?.split(';')[0]||''}));

test('Vercel: sessões e cadastros persistem entre execuções independentes, inclusive simultâneas',async()=>{
 const store=memoryStore();
 const initial=await request(store,'/event');assert.deepEqual(initial.data.participants.map(p=>p.name),family);assert.equal(store.metrics().writes,0);
 const admin=await request(store,'/admin/login',{password:'1803'});assert.equal(admin.status,200);assert.match(admin.cookie,/^__Host-familia_admin=/);assert.match(admin.headers['set-cookie'],/Secure/);
 const codes=await request(store,'/admin/codes',{},admin.cookie);assert.equal(codes.data.length,12);
 const users=await Promise.all(codes.data.map(c=>request(store,'/login',{id:c.id,code:c.code})));
 assert.ok(users.every(u=>u.status===200));assert.ok(store.metrics().conflicts>0);
 const dashboard=await request(store,'/admin/dashboard',undefined,admin.cookie);
 assert.equal(dashboard.status,200);assert.equal(dashboard.data.participants.filter(p=>p.confirmed_at).length,12);
 assert.equal((await request(store,'/admin/start',{},admin.cookie)).status,200);
 const reveals=await Promise.all(users.map(u=>request(store,'/reveal',{},u.cookie)));
 assert.ok(reveals.every(r=>r.status===200));assert.equal(new Set(reveals.map(r=>r.data.receiver.id)).size,12);
 for(let i=0;i<users.length;i++){
  assert.equal(reveals[i].data.participant,codes.data[i].name);
  assert.notEqual(reveals[i].data.receiver.id,codes.data[i].id);
  assert.deepEqual((await request(store,'/result',undefined,users[i].cookie)).data,reveals[i].data);
 }
 const writes=store.metrics().writes;await request(store,'/event');await request(store,'/admin/dashboard',undefined,admin.cookie);assert.equal(store.metrics().writes,writes);
 assert.equal((await request(store,'/admin/results',undefined,users[0].cookie)).status,401);
});
test('Vercel: não confirma login quando o armazenamento falha',async()=>{
 const store=memoryStore();store.write=async()=>{throw new Error('Offline');};
 await assert.rejects(()=>request(store,'/admin/login',{password:'1803'}),/Offline/);
});
test('Vercel: limite de tentativas sobrevive a cold starts e salva falhas de login',async()=>{
 const store=memoryStore();
 for(let i=0;i<60;i++)assert.equal((await request(store,'/admin/login',{password:'wrong'})).status,401);
 assert.equal((await request(store,'/admin/login',{password:'1803'})).status,429);
 assert.equal((await request(store,'/admin/login',{password:'1803'},'',{address:'other-device'})).status,200);
});
test('Vercel: esgotar conflitos não retorna sucesso nem cookie não persistido',async()=>{
 const store=memoryStore();store.write=async()=>{throw new Conflict();};
 const response=await request(store,'/admin/login',{password:'1803'},'',{maxAttempts:2});
 assert.equal(response.status,409);assert.equal(response.cookie,'');
});
test('Blob: leitura privada sem cache, primeira criação exclusiva e atualização com ETag',async()=>{
 const calls=[];
 const sdk={
  async get(path,options){calls.push({op:'get',path,options});return {statusCode:200,stream:new Blob(['snapshot']).stream(),blob:{etag:'v1'}};},
  async put(path,bytes,options){calls.push({op:'put',path,options});},
  BlobPreconditionFailedError:Conflict
 };
 const store=createBlobStore(sdk,'family.sqlite');
 const snapshot=await store.read();assert.equal(snapshot.bytes.toString(),'snapshot');assert.deepEqual(calls[0].options,{access:'private',useCache:false});
 await store.write(snapshot.bytes,null);assert.equal(calls[1].options.allowOverwrite,false);assert.equal(calls[1].options.ifMatch,undefined);
 await store.write(snapshot.bytes,'v1');assert.equal(calls[2].options.allowOverwrite,true);assert.equal(calls[2].options.ifMatch,'v1');
 assert.equal(store.isConflict(new Conflict()),true);
});

test('Blob: primeira criação concorrente com BlobError genérico força releitura segura',async()=>{
 const sdk={
  async get(){return {statusCode:200,stream:new Blob(['newer state']).stream(),blob:{etag:'v2'}};},
  async put(){throw new Error('Already exists');}
 };
 const store=createBlobStore(sdk,'family.sqlite');
 let conflict;
 try{await store.write(Buffer.from('old state'),null);}catch(e){conflict=e;}
 assert.equal(store.isConflict(conflict),true);
});
