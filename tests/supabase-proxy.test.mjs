import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseHandler } from '../server/supabase-proxy.mjs';
const token='a'.repeat(64);
async function invoke({path='/admin/login',method='POST',body={password:'123456'},cookie='',origin='https://familia.test',preview=false,fetcher}={}){
 const calls=[];
 const defaultFetcher=async(url,options)=>{calls.push({url,options,request:JSON.parse(options.body)});return {json:async()=>({status:200,data:{ok:true},session:{role:'admin',token,maxAge:28800}})};};
 const handler=createSupabaseHandler({endpoint:'https://example.supabase.co/functions/v1/familia-ferreira',publishableKey:'public-test-key',preview,fetcher:fetcher||defaultFetcher});
 const req={url:'/api'+path,method,headers:{host:'familia.test',origin,cookie,'content-type':'application/json'},body};
 const res={headers:{},statusCode:200,setHeader(k,v){this.headers[k.toLowerCase()]=v;},status(s){this.statusCode=s;return this;},json(data){this.data=data;return this;}};
 await handler(req,res);return {...res,calls};
}
test('Supabase: login transforma token em cookie HttpOnly, sem expor metadados',async()=>{
 const r=await invoke();assert.equal(r.statusCode,200);assert.deepEqual(r.data,{ok:true});assert.match(r.headers['set-cookie'],/HttpOnly; SameSite=Strict/);assert.match(r.headers['set-cookie'],/Secure/);assert.ok(!JSON.stringify(r.data).includes(token));assert.equal(r.calls[0].request.path,'/admin/login');
});
test('Supabase: consulta envia somente a sessão adequada, sem compartilhar cookie administrativo',async()=>{
 let sent;
 const r=await invoke({path:'/result',method:'GET',body:undefined,cookie:`__Host-familia_admin=${'b'.repeat(64)}; __Host-familia_participant=${token}`,fetcher:async(u,o)=>{sent=JSON.parse(o.body);return {json:async()=>({status:401,data:{error:'Entre novamente'}})};}});
 assert.equal(sent.sessionToken,token);assert.equal(r.statusCode,401);assert.equal(r.headers['set-cookie'],undefined);
});
test('Supabase: protege origem, bloqueia preview e recusa entrada malformada',async()=>{
 assert.equal((await invoke({origin:'https://other.test'})).statusCode,403);
 assert.equal((await invoke({preview:true})).statusCode,403);
 assert.equal((await invoke({body:'{bad'})).statusCode,400);
 assert.equal((await invoke({body:['unexpected']})).statusCode,400);
});
test('Supabase: não confirma operação nem libera cookie se backend falhar',async()=>{
 const r=await invoke({fetcher:async()=>{throw new Error('Offline');}});assert.equal(r.statusCode,503);assert.equal(r.headers['set-cookie'],undefined);
 const invalid=await invoke({fetcher:async()=>({json:async()=>({status:200,data:{ok:true},session:{role:'admin',token:'invalid; Secure',maxAge:28800}})})});assert.equal(invalid.statusCode,503);assert.equal(invalid.headers['set-cookie'],undefined);
});
