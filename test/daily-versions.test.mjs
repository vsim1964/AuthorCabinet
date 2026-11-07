import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {zipSync} from 'fflate';
import {Store,SQL} from '../store.mjs';
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'author-daily-'));
const day=(n,h=12)=>new Date(2026,0,n,h);
const change=(store,id,text)=>store.save(id,{...store.get(id),html:'<p>'+text+'</p>',plain:text});
test('One daily snapshot holds the last saved text, unchanged content and metadata create none',()=>{
 const root=temp();let clock=day(1);const s=new Store(root,{now:()=>clock});
 try{const d=s.create({title:'Глава',html:'<p>Начало</p>',plain:'Начало'});
  s.save(d.id,s.get(d.id));assert.equal(s.versions(d.id).length,0);
  s.save(d.id,{...s.get(d.id),notes:'Заметка',title:'Другое имя'});assert.equal(s.versions(d.id).length,0);
  change(s,d.id,'Первая правка');const first=s.versions(d.id)[0];assert.equal(first.kind,'automatic');assert.equal(first.day,'2026-01-01');assert.equal(first.plain,'Первая правка');
  clock=day(1,23);change(s,d.id,'Итог дня');assert.equal(s.versions(d.id).length,1);assert.equal(s.versions(d.id)[0].id,first.id);assert.equal(s.versions(d.id)[0].plain,'Итог дня');
  const author=s.version(d.id,'Суточная версия · 2026-01-01');assert.equal(author.kind,'author');
  clock=day(2);s.save(d.id,s.get(d.id));assert.equal(s.versions(d.id).filter(x=>x.kind==='automatic').length,1);
  change(s,d.id,'Второй день');const daily=s.versions(d.id).filter(x=>x.kind==='automatic');assert.equal(daily.length,2);assert.equal(daily.find(x=>x.day==='2026-01-01').plain,'Итог дня');
  clock=day(20);s.pruneExpired();assert.deepEqual(s.versions(d.id).map(x=>x.id),[author.id]);
 }finally{s.close();fs.rmSync(root,{recursive:true,force:true})}
});
test('Expiry boundary, seven-snapshot limit and per-document isolation',()=>{
 const root=temp();let clock=day(1,23);const s=new Store(root,{now:()=>clock});
 try{const a=s.create({title:'A'}),b=s.create({title:'B'});change(s,a.id,'День 1');change(s,b.id,'B');
  for(let n=2;n<=8;n++){clock=day(n,1);change(s,a.id,'День '+n)}
  assert.equal(s.versions(a.id).length,7);assert.ok(s.versions(a.id).every(v=>v.day!=='2026-01-01'));assert.equal(s.versions(b.id).length,1);
  clock=day(8,23);s.pruneExpired();assert.equal(s.versions(b.id).length,0);
  assert.equal(s.versions(a.id).length,7);
 }finally{s.close();fs.rmSync(root,{recursive:true,force:true})}
});
test('Startup removes expired snapshots and compacts SQLite, manual and recovery versions survive',()=>{
 const root=temp();let clock=day(1);let s=new Store(root,{now:()=>clock});
 try{const d=s.create({title:'Размер'});change(s,d.id,'x'.repeat(250000));const daily=s.versions(d.id)[0];change(s,d.id,'Короткий текст');const author=s.version(d.id,'Авторская');s.restoreVersion(d.id,daily.id);assert.ok(s.versions(d.id).some(x=>x.kind==='system'));clock=day(2);change(s,d.id,'y'.repeat(250000));clock=day(2,13);change(s,d.id,'Финал');
  const before=fs.statSync(path.join(s.current,'database.sqlite')).size;s.close();clock=day(20);s=new Store(root,{now:()=>clock});
  assert.ok(s.versions(d.id).some(x=>x.id===author.id));assert.ok(s.versions(d.id).some(x=>x.kind==='system'));assert.equal(s.versions(d.id).filter(x=>x.kind==='automatic').length,0);assert.ok(fs.statSync(path.join(s.current,'database.sqlite')).size<before);assert.equal(s.get(d.id).plain,'Финал');
 }finally{s.close();fs.rmSync(root,{recursive:true,force:true})}
});
test('Old schema migration and old backup restore preserve ambiguous historical versions',()=>{
 const root=temp();let s=new Store(root);let id;
 try{const d=s.create({title:'Старая книга'});id=d.id;s.version(id,'Автоматическая версия');s.version(id,'Моя авторская');const legacy=new SQL.Database(s.db.export());
  legacy.run('CREATE TABLE legacy_versions AS SELECT id,document_id,label,html,plain,created FROM versions; DROP TABLE versions; ALTER TABLE legacy_versions RENAME TO versions; PRAGMA user_version=1');const bytes=legacy.export();legacy.close();s.close();fs.writeFileSync(path.join(root,'current','database.sqlite'),bytes);
  s=new Store(root,{now:()=>day(31)});assert.equal(s.versions(id).length,2);assert.ok(s.versions(id).every(x=>x.kind==='legacy'));assert.ok(fs.readdirSync(s.backups).length>=1);change(s,id,'Новый текст');assert.equal(s.versions(id).filter(x=>x.kind==='automatic').length,1);
  const archive=zipSync({'database.sqlite':bytes,'manifest.json':Buffer.from(JSON.stringify({app:'author-cabinet',schema:1}))});s.restore(archive);assert.equal(s.versions(id).length,2);assert.ok(s.versions(id).every(x=>x.kind==='legacy'));change(s,id,'После восстановления');assert.equal(s.versions(id).filter(x=>x.kind==='automatic').length,1);
 }finally{s.close();fs.rmSync(root,{recursive:true,force:true})}
});
