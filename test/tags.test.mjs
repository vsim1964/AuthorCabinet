import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store} from '../store.mjs';

test('Tags survive saves, restart, trash and backup; old clients do not erase them',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'author-tags-'));let s=new Store(root);
 try{
  let d=s.create({title:'Глава',tags:[' Наука ','наука','История']});assert.deepEqual(d.tags,['Наука','История']);
  d=s.save(d.id,{...d,tags:['Проверить','Источник']});assert.deepEqual(s.list()[0].tags,d.tags);assert.equal(s.versions(d.id).length,0);
  const oldClient={...d};delete oldClient.tags;d=s.save(d.id,oldClient);assert.deepEqual(d.tags,['Проверить','Источник']);
  assert.throws(()=>s.save(d.id,{...d,tags:'bad'}));assert.throws(()=>s.save(d.id,{...d,tags:['a'.repeat(81)]}));
  const archive=s.archive();s.close();s=new Store(root);assert.deepEqual(s.get(d.id).tags,d.tags);
  s.trashMaterial(d.id,s.get(d.id).revision);s.restoreMaterial(d.id,s.trash()[0].revision);assert.deepEqual(s.get(d.id).tags,d.tags);
  s.save(d.id,{...s.get(d.id),tags:[]});s.restore(archive);assert.deepEqual(s.get(d.id).tags,d.tags);
 }finally{s.close();fs.rmSync(root,{recursive:true,force:true})}
});
test('Schema 3 migration backs up old database and keeps material text and versions',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'author-tags-old-'));let s=new Store(root);
 try{const d=s.create({title:'Старая глава',html:'<p>Текст</p>',plain:'Текст'});s.version(d.id,'Авторская');s.db.run('ALTER TABLE documents DROP COLUMN tags; PRAGMA user_version=3');s.persist();s.close();s=new Store(root);assert.deepEqual(s.get(d.id).tags,[]);assert.equal(s.get(d.id).plain,'Текст');assert.equal(s.versions(d.id).length,1);assert.equal(s.db.exec('PRAGMA user_version')[0].values[0][0],4);assert.ok(fs.readdirSync(s.backups).length)}finally{s.close();fs.rmSync(root,{recursive:true,force:true})}
});
