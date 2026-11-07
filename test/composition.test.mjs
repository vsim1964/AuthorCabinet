import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store} from '../store.mjs';
import {start} from '../server.mjs';
import {chapterTitle,numberChapters,chapterLabel,moveRelative} from '../composition.mjs';
import {unzipSync} from 'fflate';
import mammoth from 'mammoth';
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'author-order-'));
test('Moves retain hidden materials; chapter numbers skip notes and preserve meaningful year titles',()=>{
 assert.deepEqual(moveRelative(['a','note','b','c'],'c','a','before'),['c','a','note','b']);assert.deepEqual(moveRelative(['a','note','b','c'],'a','c','after'),['note','b','c','a']);assert.deepEqual(moveRelative(['a','b'],'a','a'),['a','b']);
 assert.equal(chapterTitle('12: Название'),'Название');assert.equal(chapterTitle('Глава 12. Название'),'Название');assert.equal(chapterTitle('1917: Петроград'),'1917: Петроград');assert.equal(chapterTitle('10 фактов'),'10 фактов');assert.equal(chapterTitle('Глава 12'),'');
 const docs=numberChapters([{title:'Третья',kind:'глава'},{title:'Заметка',kind:'заметка'},{title:'Первая',kind:'глава'}]);assert.deepEqual(docs.map(x=>x.chapterNumber),[1,null,2]);assert.equal(chapterLabel({...docs[2],title:'1: Первая'}),'Глава 2. Первая');assert.equal(chapterLabel({...docs[0],title:'Глава 12'}),'Глава 1');
});
test('Reorder persists atomically without text edits or new versions; stale and invalid orders are rejected',()=>{
 const root=temp();let s=new Store(root);try{const a=s.create({title:'Первая',html:'<p>Первый текст</p>',plain:'Первый текст'}),b=s.create({title:'Вторая'}),note=s.create({title:'Заметка',kind:'заметка'});s.version(a.id,'Авторская');const original=s.list().map(x=>x.id);const copy=s.archive();
  s.reorder([b.id,note.id,a.id],original);assert.deepEqual(s.list().map(x=>x.id),[b.id,note.id,a.id]);assert.equal(s.get(a.id).html,a.html);assert.equal(s.get(a.id).revision,a.revision);assert.equal(s.versions(a.id).length,1);
  assert.throws(()=>s.reorder(original,original),e=>e.status===409);assert.throws(()=>s.reorder([b.id,b.id,a.id],s.list().map(x=>x.id)),e=>e.status===400);assert.throws(()=>s.reorder([a.id],s.list().map(x=>x.id)),e=>e.status===400);
  s.close();s=new Store(root);assert.deepEqual(s.list().map(x=>x.id),[b.id,note.id,a.id]);s.restore(copy);assert.deepEqual(s.list().map(x=>x.id),original);
 }finally{s.close();fs.rmSync(root,{recursive:true,force:true})}
});
test('Order API and HTML/DOCX/TXT publication use the new sequence and global chapter numbering',async()=>{
 const root=temp();const app=await start({root,port:0,seed:false});const request=async(url,method,body)=>fetch(app.address+url,{method,headers:{'X-Author-Client':'1','Content-Type':'application/json'},body:JSON.stringify(body)});
 try{const a=app.store.create({title:'1: Альфа',kind:'глава',html:'<h1>1: Альфа</h1><p>Текст Альфа.</p>',plain:'Текст Альфа.'});const b=app.store.create({title:'2: Бета',kind:'глава',html:'<h1>2: Бета</h1><p>Текст Бета.</p>',plain:'Текст Бета.'});const note=app.store.create({title:'Заметка',kind:'заметка',html:'<p>Служебный текст</p>'});const old=app.store.list().map(d=>d.id);
  const reorder=await request('/api/documents/order','PUT',{ids:[b.id,note.id,a.id],expectedOrder:old});assert.equal(reorder.status,200);assert.deepEqual((await reorder.json()).documents.map(d=>d.id),[b.id,note.id,a.id]);const stale=await request('/api/documents/order','PUT',{ids:old,expectedOrder:old});assert.equal(stale.status,409);
  for(const format of ['html','txt','docx']){const response=await request('/api/export/publication','POST',{scope:'book',format});assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());const text=format==='docx'?(await mammoth.extractRawText({buffer:bytes})).value:bytes.toString();assert.ok(text.includes('Глава 1. Бета'));assert.ok(text.includes('Глава 2. Альфа'));assert.ok(text.indexOf('Глава 1. Бета')<text.indexOf('Глава 2. Альфа'));assert.ok(!text.includes('Служебный текст'));assert.equal((text.match(/Текст Альфа\./g)||[]).length,1)}
  const single=await request('/api/export/publication','POST',{scope:'current',ids:[a.id],format:'txt'});assert.equal(single.status,200);assert.ok((await single.text()).includes('Глава 2. Альфа'));assert.ok(decodeURIComponent(single.headers.get('content-disposition')).includes('Глава 2. Альфа.txt'));assert.equal(app.store.get(a.id).html,a.html);
 }finally{await app.close();fs.rmSync(root,{recursive:true,force:true})}
});
