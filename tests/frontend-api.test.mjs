import {test} from 'node:test';
import assert from 'node:assert/strict';
import {api,ApiError,revealResult} from '../src/api.ts';

test('a roleta envia POST para revelar e preserva o resultado devolvido',async()=>{
 const original=globalThis.fetch;
 const result={participant:'Caíque Eduardo',receiver:{id:2,name:'Estephane'},revealedAt:'2026-10-17T00:00:00Z'};
 try{
  globalThis.fetch=async(url,options)=>{
   assert.equal(url,'/api/reveal');assert.equal(options.method,'POST');
   assert.equal(options.credentials,'same-origin');assert.equal(options.headers['Content-Type'],'application/json');
   assert.deepEqual(JSON.parse(options.body),{});
   return Response.json(result);
  };
  assert.deepEqual(await revealResult(),result);
  globalThis.fetch=async()=>Response.json({error:'Entre novamente.'},{status:401});
  await assert.rejects(revealResult(),e=>e instanceof ApiError&&e.status===401&&e.message==='Entre novamente.');
  globalThis.fetch=async(url,options)=>{
   assert.equal(url,'/api/result');assert.equal(options.method,undefined);
   return Response.json(result);
  };
  assert.deepEqual(await api('/result'),result);
 }finally{globalThis.fetch=original;}
});
