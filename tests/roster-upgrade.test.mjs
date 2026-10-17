import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase,family} from '../server/db.mjs';

test('ampliação reinicia os 12 participantes antigos uma vez, preserva IDs e inclui Patrícia e Agatha',()=>{
 const dir=mkdtempSync(join(tmpdir(),'familia-upgrade-')),path=join(dir,'test.sqlite');
 let db;
 try{
  db=openDatabase(path);
  // Simulate the last version of the existing local database.
  db.exec('DELETE FROM migrations WHERE version=2; DELETE FROM participants WHERE id>12');
  db.exec("UPDATE participants SET code_hash='existing-hash',confirmed_at='old',revealed_at='old'; UPDATE settings SET started_at='old'; INSERT INTO pairs(giver,receiver) VALUES(1,2); INSERT INTO sessions VALUES('old-session','participant',1,9999999999999)");
  db.close();db=openDatabase(path);
  assert.deepEqual(db.prepare('SELECT name FROM participants ORDER BY id').all().map(p=>p.name),family);
  assert.equal(family.length,14);assert.deepEqual(family.slice(-2),['Patrícia','Agatha']);
  assert.equal(db.prepare('SELECT count(*) n FROM pairs').get().n,0);
  assert.equal(db.prepare('SELECT count(*) n FROM sessions').get().n,0);
  assert.equal(db.prepare('SELECT count(*) n FROM participants WHERE confirmed_at IS NOT NULL OR revealed_at IS NOT NULL').get().n,0);
  assert.equal(db.prepare("SELECT count(*) n FROM participants WHERE code_hash='existing-hash'").get().n,12);
  db.exec("UPDATE participants SET confirmed_at='new',revealed_at='new' WHERE id=1");
  db.close();db=openDatabase(path);
  assert.equal(db.prepare('SELECT revealed_at FROM participants WHERE id=1').get().revealed_at,'new');
 }finally{db?.close();rmSync(dir,{recursive:true,force:true});}
});
