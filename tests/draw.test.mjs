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
