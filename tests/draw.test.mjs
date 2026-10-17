import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDraw } from '../server/draw.mjs';
import { hashSecret, verifySecret } from '../server/security.mjs';
test('1.000 sorteios: ninguém tira a si mesmo e todos dão/recebem exatamente uma vez',()=>{
 for(let trial=0;trial<1000;trial++){
  const ids=Array.from({length:2+trial%29},(_,i)=>i+1), pairs=createDraw(ids);
  assert.equal(pairs.length,ids.length);
  assert.equal(new Set(pairs.map(p=>p.giver)).size,ids.length);
  assert.equal(new Set(pairs.map(p=>p.receiver)).size,ids.length);
  for(const p of pairs){assert.notEqual(p.giver,p.receiver);assert.ok(ids.includes(p.receiver));}
 }
});
test('lista inválida é recusada',()=>{assert.throws(()=>createDraw([]));assert.throws(()=>createDraw([1]));assert.throws(()=>createDraw([1,1]));});
test('códigos são protegidos com sal e verificação de hash',()=>{const a=hashSecret('ABC123'),b=hashSecret('ABC123');assert.notEqual(a,b);assert.ok(verifySecret('ABC123',a));assert.equal(verifySecret('errado',a),false);assert.equal(verifySecret('ABC123',''),false);});

test('exceção da família: Iris duas vezes, Erick fora dos destinatários e nenhum sorteio próprio',async()=>{
 const {createFamilyDraw}=await import('../server/draw.mjs');
 const {family}=await import('../server/db.mjs');
 const people=family.map((name,i)=>({id:i+1,name}));
 const iris=people.find(p=>p.name==='Iris Ferreira').id,erick=people.find(p=>p.name==='Erick').id;
 for(let i=0;i<1000;i++){
  const pairs=createFamilyDraw(people);
  assert.equal(pairs.length,14);assert.equal(new Set(pairs.map(p=>p.giver)).size,14);
  assert.equal(pairs.filter(p=>p.receiver===iris).length,2);
  assert.equal(pairs.filter(p=>p.receiver===erick).length,0);
  assert.equal(new Set(pairs.map(p=>`${p.receiver}:${p.receiverSlot}`)).size,14);
  for(const p of pairs){assert.notEqual(p.giver,p.receiver);if(p.receiver!==iris)assert.equal(p.receiverSlot,1);}
 }
});
