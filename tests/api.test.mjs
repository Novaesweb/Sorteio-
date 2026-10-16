import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.mjs';
import { family } from '../server/db.mjs';

test('fluxo completo, autorização, isolamento de resultados e persistência',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'familia-')),databasePath=join(dir,'test.sqlite'),password='1803';
 const config={databasePath,origin:'http://familia.test'};
 const app=createApp(config);
 // Exercise the actual HTTP handler without opening sockets (restricted CI compatible).
 const request=async(path,data,cookie='',origin='http://familia.test')=>new Promise((resolve,reject)=>{
  const req=Readable.from(data===undefined?[]:[Buffer.from(JSON.stringify(data))]);
  req.method=data===undefined?'GET':'POST';req.url='/api'+path;
  req.headers={...(data===undefined?{}:{'content-type':'application/json',origin}),cookie};
  req.socket={remoteAddress:'127.0.0.1'};
  const headers={};
  const res={headersSent:false,status:200,setHeader(k,v){headers[k.toLowerCase()]=v;},writeHead(status,extra){this.status=status;this.headersSent=true;for(const [k,v] of Object.entries(extra))headers[k.toLowerCase()]=v;},end(body){try{resolve({status:this.status,data:JSON.parse(body),cookie:headers['set-cookie']?.split(';')[0]||''});}catch(e){reject(e);}}};
  app.server.emit('request',req,res);
 });
 try{
  assert.equal((await request('/admin/dashboard')).status,401);
  assert.equal((await request('/admin/login',{password},'','https://evil.test')).status,403);
  assert.equal((await request('/admin/login',{password:'wrong'})).status,401);
  const admin=await request('/admin/login',{password});assert.equal(admin.status,200);
  const event=await request('/event');assert.equal(event.data.participants.length,12);assert.deepEqual(event.data.participants.map(p=>p.name),family);
  assert.deepEqual(Object.keys(event.data.participants[0]).sort(),['id','name']);
  const generated=await request('/admin/codes',{},admin.cookie);assert.equal(generated.data.length,12);
  const codes=generated.data;
  assert.equal((await request('/admin/codes',{},admin.cookie)).data.length,0);
  assert.equal((await request('/login',{id:codes[0].id,code:'wrong'})).status,401);
  const user=await request('/login',{id:codes[0].id,code:codes[0].code});assert.equal(user.status,200);
  assert.equal((await request('/reveal',{},user.cookie)).status,409);
  assert.equal((await request('/admin/results',undefined,user.cookie)).status,401);
  assert.equal((await request('/admin/start',{},admin.cookie)).status,200);
  assert.equal((await request('/admin/start',{},admin.cookie)).status,409);
  assert.equal((await request('/admin/participants',{action:'remove',id:codes[1].id},admin.cookie)).status,403);
  assert.equal((await request('/result',undefined,user.cookie)).status,409);
  const result=await request('/reveal',{},user.cookie);assert.equal(result.status,200);assert.equal(result.data.revealedAt,app.db.prepare('SELECT revealed_at FROM participants WHERE id=?').get(codes[0].id).revealed_at);
  assert.notEqual(result.data.receiver.id,codes[0].id);assert.equal(result.data.participant,codes[0].name);
  assert.deepEqual(Object.keys(result.data).sort(),['participant','receiver','revealedAt']);
  const again=await request('/reveal',{},user.cookie);assert.deepEqual(again.data,result.data);
  const secondDevice=await request('/login',{id:codes[0].id,code:codes[0].code});
  assert.deepEqual((await request('/result',undefined,secondDevice.cookie)).data,result.data);
  const dashboard=await request('/admin/dashboard',undefined,admin.cookie);
  assert.equal(dashboard.data.participants.filter(p=>p.confirmed_at).length,1);
  assert.equal(dashboard.data.participants.filter(p=>p.revealed_at).length,1);
  assert.ok(!JSON.stringify(dashboard.data).includes('code_hash'));
  const full=await request('/admin/results',undefined,admin.cookie);assert.equal(full.data.length,12);
  assert.equal(new Set(full.data.map(p=>p.receiver)).size,12);
  // Every participant logs in and receives only their own assigned result.
  for(const c of codes.slice(1)){
   const login=await request('/login',{id:c.id,code:c.code});
   const own=await request('/reveal',{},login.cookie);
   assert.equal(own.data.participant,c.name);assert.notEqual(own.data.receiver.id,c.id);
   assert.equal(own.data.receiver.name,full.data.find(p=>p.giver===c.name).receiver);
  }
  const replacement=await request('/admin/codes',{id:codes[0].id},admin.cookie);
  assert.equal((await request('/result',undefined,user.cookie)).status,401);
  assert.equal((await request('/login',{id:codes[0].id,code:codes[0].code})).status,401);
  const renewed=await request('/login',{id:codes[0].id,code:replacement.data[0].code});
  assert.deepEqual((await request('/result',undefined,renewed.cookie)).data,result.data);
  assert.equal((await request('/admin/reset',{confirmation:'sim',password},admin.cookie)).status,400);
  assert.equal((await request('/admin/reset',{confirmation:'INVALIDAR RESULTADOS',password:'wrong'},admin.cookie)).status,400);
  assert.equal((await request('/admin/reset',{confirmation:'INVALIDAR RESULTADOS',password},admin.cookie)).status,200);
  assert.equal((await request('/result',undefined,renewed.cookie)).status,401);
  assert.equal((await request('/admin/results',undefined,admin.cookie)).data.length,0);
  const final=await request('/admin/dashboard',undefined,admin.cookie);
  assert.equal(final.data.participants.filter(p=>p.revealed_at).length,0);
  assert.equal(final.data.participants.filter(p=>p.confirmed_at).length,12);
  assert.equal((await request('/admin/participants',{action:'add',name:'Estephane'},admin.cookie)).status,403);
  assert.equal((await request('/admin/participants',{action:'add',name:'Pessoa nova'},admin.cookie)).status,403);
  assert.equal((await request('/admin/participants',{action:'add',name:'JÉSSICA RAFAELA'},admin.cookie)).status,403);
  const updated=await request('/event');assert.equal(updated.data.participants.length,12);
  assert.equal((await request('/admin/logout',{},admin.cookie)).status,200);
  assert.equal((await request('/admin/dashboard',undefined,admin.cookie)).status,401);
 }finally{app.server.close();app.db.close();}
 try{
  const reopened=createApp(config);
  assert.equal(reopened.db.prepare('SELECT COUNT(*) AS n FROM participants').get().n,12);
  assert.ok(reopened.db.prepare('SELECT COUNT(*) AS n FROM audit').get().n>0);
  reopened.server.close();reopened.db.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('produção exige origem HTTPS',()=>{assert.throws(()=>createApp({production:true}));});
