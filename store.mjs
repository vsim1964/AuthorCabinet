import fs from 'node:fs';
import {normalizeTags} from './tags.mjs';
import path from 'node:path';
import crypto from 'node:crypto';
import initSqlJs from 'sql.js';
import {zipSync,unzipSync} from 'fflate';
export const SQL=await initSqlJs();
const DAY_MS=24*60*60*1000;
const localDay=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
function migrateVersions(db){
 const columns=db.exec('PRAGMA table_info(versions)')[0].values.map(row=>row[1]);
 db.run('BEGIN');
 try{
  // Historical rows have no reliable provenance. Protect them as legacy.
  if(!columns.includes('kind'))db.run("ALTER TABLE versions ADD COLUMN kind TEXT NOT NULL DEFAULT 'legacy'");
  if(!columns.includes('day'))db.run('ALTER TABLE versions ADD COLUMN day TEXT');
  db.run("CREATE UNIQUE INDEX IF NOT EXISTS versions_daily_unique ON versions(document_id,day) WHERE kind='automatic'");
  const documentColumns=db.exec('PRAGMA table_info(documents)')[0].values.map(row=>row[1]);
  if(!documentColumns.includes('deleted_at'))db.run('ALTER TABLE documents ADD COLUMN deleted_at TEXT');
  if(!documentColumns.includes('tags'))db.run("ALTER TABLE documents ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'");
  db.run('PRAGMA user_version=4');db.run('COMMIT');
 }catch(error){db.run('ROLLBACK');throw error}
}
export class Store {
 constructor(root,{now=()=>new Date()}={}){
  this.root=root;this.now=now;this.current=path.join(root,'current');this.backups=path.join(root,'backups');
  fs.mkdirSync(this.current,{recursive:true});fs.mkdirSync(this.backups,{recursive:true});fs.mkdirSync(path.join(this.current,'assets'),{recursive:true});
  const file=path.join(this.current,'database.sqlite');const existed=fs.existsSync(file);
  this.db=existed?new SQL.Database(fs.readFileSync(file)):new SQL.Database();
  const schema=this.db.exec('PRAGMA user_version')[0].values[0][0];if(schema>4)throw Error('База создана более новой версией приложения');
  this.db.run(`CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,title TEXT NOT NULL,kind TEXT NOT NULL,html TEXT NOT NULL DEFAULT '',plain TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'черновик',tasks TEXT NOT NULL DEFAULT '[]',checks TEXT NOT NULL DEFAULT '[false,false,false,false,false]',notes TEXT NOT NULL DEFAULT '',examples TEXT NOT NULL DEFAULT '',revision INTEGER NOT NULL DEFAULT 1,position INTEGER NOT NULL,updated TEXT NOT NULL); CREATE TABLE IF NOT EXISTS versions(id TEXT PRIMARY KEY,document_id TEXT NOT NULL,label TEXT NOT NULL,html TEXT NOT NULL,plain TEXT NOT NULL,created TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  if(existed&&schema<4)this.backup();
  migrateVersions(this.db);this.persist();this.pruneExpired();
 }
 rows(sql,args=[]){const s=this.db.prepare(sql);try{s.bind(args);const result=[];while(s.step())result.push(s.getAsObject());return result}finally{s.free()}}
 persist(){const tmp=path.join(this.current,'database.sqlite.tmp');const fd=fs.openSync(tmp,'w');try{fs.writeFileSync(fd,this.db.export());fs.fsyncSync(fd)}finally{fs.closeSync(fd)}fs.renameSync(tmp,path.join(this.current,'database.sqlite'))}
 transaction(fn){const before=this.db.export();try{this.db.run('BEGIN');const result=fn();this.db.run('COMMIT');this.persist();return result}catch(error){this.db.close();this.db=new SQL.Database(before);throw error}}
 list(){return this.rows('SELECT id,title,kind,status,tags,position,updated,revision,length(plain) AS characters FROM documents WHERE deleted_at IS NULL ORDER BY position').map(d=>({...d,tags:JSON.parse(d.tags)}))}
 projectState(){
  const settings=this.rows("SELECT key,value FROM settings WHERE key IN ('bookTitle','projectId') ORDER BY key");
  const documents=this.rows('SELECT id,revision,position,deleted_at FROM documents ORDER BY id');
  const versions=this.rows('SELECT id,document_id,created FROM versions ORDER BY id');
  const title=settings.find(s=>s.key==='bookTitle')?.value||'';
  return {title,exists:Boolean(title||documents.length||versions.length||settings.some(s=>s.key==='projectId')),fingerprint:crypto.createHash('sha256').update(JSON.stringify({settings,documents,versions})).digest('hex')};
 }
 createProject(title,{expectedFingerprint,confirmReplace=false}={}){
  if(typeof title!=='string'||!title.trim()||title.trim().length>200)throw Object.assign(Error('Укажите название проекта от 1 до 200 символов'),{status:400});
  const current=this.projectState();
  if(expectedFingerprint!==current.fingerprint)throw Object.assign(Error('Текущий проект изменился в другой вкладке. Проверьте данные и подтвердите создание нового проекта ещё раз.'),{status:409});
  if(current.exists&&confirmReplace!==true)throw Object.assign(Error('Подтвердите замену текущего проекта. Перед заменой будет создана резервная копия.'),{status:400});
  const previousDocumentIds=this.rows('SELECT id FROM documents').map(d=>d.id);
  const temporary=fs.mkdtempSync(path.join(this.root,'new-project-'));let empty;
  try{
   empty=new Store(temporary,{now:this.now});
   empty.transaction(()=>{empty.db.run('INSERT INTO settings(key,value) VALUES (?,?)',['bookTitle',title.trim()]);empty.db.run('INSERT INTO settings(key,value) VALUES (?,?)',['projectId',crypto.randomUUID()])});
   const archive=empty.archive();empty.close();empty=null;
   const backup=this.restore(archive);
   return {backup,previousDocumentIds};
  }finally{empty?.close();fs.rmSync(temporary,{recursive:true,force:true})}
 }
 trash(){return this.rows('SELECT id,title,kind,status,position,updated,revision,deleted_at,length(plain) AS characters FROM documents WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC,id')}
 trashMaterial(id,revision){
  const d=this.get(id);if(!d)throw Object.assign(Error('Материал не найден или уже находится в корзине'),{status:404});
  if(d.revision!==revision)throw Object.assign(Error('Материал изменился в другой вкладке. Обновите его перед удалением.'),{status:409});
  return this.transaction(()=>{this.db.run('UPDATE documents SET deleted_at=?,revision=revision+1 WHERE id=?',[this.now().toISOString(),id]);return this.trash()});
 }
 restoreMaterial(id,revision){
  const d=this.trash().find(d=>d.id===id);if(!d)throw Object.assign(Error('Материал не найден в корзине'),{status:404});
  if(d.revision!==revision)throw Object.assign(Error('Корзина изменилась. Обновите список.'),{status:409});
  return this.transaction(()=>{const pos=Number(this.rows('SELECT coalesce(max(position),0)+1 AS n FROM documents WHERE deleted_at IS NULL')[0].n);this.db.run('UPDATE documents SET deleted_at=NULL,position=?,revision=revision+1 WHERE id=?',[pos,id]);return this.get(id)});
 }
 emptyTrash(expectedTrash){
  const current=this.trash();
  const signature=rows=>JSON.stringify(rows.map(d=>[d.id,d.revision]).sort((a,b)=>a[0].localeCompare(b[0])));
  if(!Array.isArray(expectedTrash)||expectedTrash.some(d=>!d||typeof d.id!=='string'||!Number.isInteger(d.revision))||signature(expectedTrash)!==signature(current))throw Object.assign(Error('Содержимое корзины изменилось. Проверьте список и подтвердите очистку ещё раз.'),{status:409});
  if(!current.length)return {deletedCount:0,backup:null};
  const backup=this.backup();
  this.transaction(()=>{for(const d of current){this.db.run('DELETE FROM versions WHERE document_id=?',[d.id]);this.db.run('DELETE FROM documents WHERE id=? AND deleted_at IS NOT NULL',[d.id])}});
  this.db.run('VACUUM');this.persist();return {deletedCount:current.length,backup};
 }
 reorder(ids,expectedOrder){
  const current=this.list().map(d=>d.id);
  if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string')||ids.length!==current.length||new Set(ids).size!==current.length||ids.some(id=>!current.includes(id)))throw Object.assign(Error('Нужно передать каждый материал ровно один раз'),{status:400});
  if(!Array.isArray(expectedOrder)||expectedOrder.length!==current.length||expectedOrder.some((id,i)=>id!==current[i]))throw Object.assign(Error('Оглавление изменилось в другой вкладке. Список обновлён; повторите перенос.'),{status:409});
  if(ids.every((id,i)=>id===current[i]))return this.list();
  return this.transaction(()=>{ids.forEach((id,index)=>this.db.run('UPDATE documents SET position=? WHERE id=?',[index+1,id]));return this.list()});
 }
 get(id){const d=this.rows('SELECT * FROM documents WHERE id=? AND deleted_at IS NULL',[id])[0];if(!d)return null;d.tags=JSON.parse(d.tags);d.tasks=JSON.parse(d.tasks);d.checks=JSON.parse(d.checks);return d}
 create({title='Новый раздел',kind='глава',html='',plain='',tags=[]}){tags=normalizeTags(tags);return this.transaction(()=>{const id=crypto.randomUUID();const pos=Number(this.rows('SELECT coalesce(max(position),0)+1 AS n FROM documents')[0].n);this.db.run('INSERT INTO documents(id,title,kind,html,plain,tags,position,updated) VALUES (?,?,?,?,?,?,?,?)',[id,title,kind,html,plain,JSON.stringify(tags),pos,new Date().toISOString()]);return this.get(id)})}
 save(id,d){
  const old=this.get(id);if(!old)throw Object.assign(Error('Раздел не найден'),{status:404});
  if(d.revision!==old.revision)throw Object.assign(Error('Раздел изменён в другой вкладке. Скачайте несохранённый текст перед перезагрузкой.'),{status:409});
  const tags=normalizeTags(d.tags===undefined?old.tags:d.tags);
  const result=this.transaction(()=>{
   const now=this.now();
   this.db.run('UPDATE documents SET title=?,kind=?,html=?,plain=?,status=?,tasks=?,checks=?,notes=?,examples=?,tags=?,revision=revision+1,updated=? WHERE id=?',[d.title,d.kind,d.html,d.plain,d.status,JSON.stringify(d.tasks),JSON.stringify(d.checks),d.notes,d.examples,JSON.stringify(tags),now.toISOString(),id]);
   if(old.html!==d.html)this.updateDaily(id,d,now);
   return this.get(id);
  });
  this.pruneExpired();return result;
 }
 updateDaily(id,d,now=this.now()){
  const day=localDay(now);const existing=this.rows("SELECT id FROM versions WHERE document_id=? AND kind='automatic' AND day=?",[id,day])[0];
  if(existing){this.db.run('UPDATE versions SET html=?,plain=?,created=? WHERE id=?',[d.html,d.plain,now.toISOString(),existing.id]);return existing.id}
  const version=this.addVersion(id,'Суточная версия · '+day,d,{kind:'automatic',day,now});return version.id;
 }
 addVersion(id,label,d=this.get(id),{kind='author',day=null,now=this.now()}={}){
  if(!d)throw Error('Раздел не найден');
  const v={id:crypto.randomUUID(),document_id:id,label,html:d.html,plain:d.plain,created:now.toISOString(),kind,day};
  this.db.run('INSERT INTO versions(id,document_id,label,html,plain,created,kind,day) VALUES (?,?,?,?,?,?,?,?)',Object.values(v));return v;
 }
 version(id,label){return this.transaction(()=>this.addVersion(id,label))}
 expiredIds(){
  const cutoff=new Date(this.now().getTime()-7*DAY_MS).toISOString();
  return this.rows("SELECT id FROM versions WHERE kind='automatic' AND (created<=? OR id NOT IN (SELECT v.id FROM versions v WHERE v.kind='automatic' AND v.document_id=versions.document_id ORDER BY v.day DESC,v.created DESC LIMIT 7))",[cutoff]).map(row=>row.id);
 }
 pruneExpired(){
  const ids=this.expiredIds();if(!ids.length)return 0;
  this.transaction(()=>{for(const id of ids)this.db.run("DELETE FROM versions WHERE id=? AND kind='automatic'",[id])});
  // Reclaim released pages, so removing old snapshots also reduces the file.
  this.db.run('VACUUM');this.persist();return ids.length;
 }
 versions(id){if(!this.get(id))throw Object.assign(Error('Материал не найден или находится в корзине'),{status:404});this.pruneExpired();return this.rows('SELECT * FROM versions WHERE document_id=? ORDER BY created DESC',[id])}
 restoreVersion(id,versionId){
  this.pruneExpired();
  const result=this.transaction(()=>{
   const v=this.rows('SELECT * FROM versions WHERE id=? AND document_id=?',[versionId,id])[0];if(!v)throw Error('Версия не найдена');
   const old=this.get(id);const now=this.now();this.addVersion(id,'Перед восстановлением',old,{kind:'system',now});
   this.db.run('UPDATE documents SET html=?,plain=?,revision=revision+1,updated=? WHERE id=?',[v.html,v.plain,now.toISOString(),id]);
   if(old.html!==v.html)this.updateDaily(id,v,now);return this.get(id);
  });
  this.pruneExpired();return result;
 }
 archive(){const files={'database.sqlite':this.db.export(),'manifest.json':Buffer.from(JSON.stringify({app:'author-cabinet',schema:Number(this.db.exec('PRAGMA user_version')[0].values[0][0]),created:this.now().toISOString()}))};for(const name of fs.readdirSync(path.join(this.current,'assets')))files['assets/'+name]=fs.readFileSync(path.join(this.current,'assets',name));return Buffer.from(zipSync(files,{level:6}))}
 backup(){const name='cabinet-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex')+'.zip';fs.writeFileSync(path.join(this.backups,name),this.archive(),{flag:'wx'});return name}
 restore(bytes){let total=0;const files=unzipSync(bytes,{filter:file=>{total+=file.originalSize;if(total>150*1024*1024)throw Error('Архив слишком большой');return true}});const manifest=JSON.parse(Buffer.from(files['manifest.json']||[]).toString());if(manifest.app!=='author-cabinet'||![1,2,3,4].includes(manifest.schema)||!files['database.sqlite'])throw Error('Это не резервная копия Кабинета автора');for(const name of Object.keys(files))if(!['database.sqlite','manifest.json'].includes(name)&&!/^assets\/[a-f0-9-]+\.(png|jpg|jpeg|gif|webp|docx|pdf|txt)$/.test(name))throw Error('Недопустимый путь в архиве');const candidate=new SQL.Database(files['database.sqlite']);try{if(candidate.exec('PRAGMA integrity_check')[0]?.values[0][0]!=='ok')throw Error('Повреждена база данных');candidate.exec('SELECT id,title,html,plain,revision FROM documents LIMIT 1');candidate.exec('SELECT id FROM versions LIMIT 1');candidate.exec('SELECT key,value FROM settings LIMIT 1');if(candidate.exec('PRAGMA user_version')[0].values[0][0]>4)throw Error('Архив создан более новой версией приложения');migrateVersions(candidate);files['database.sqlite']=candidate.export()}catch(e){candidate.close();throw e}const backup=this.backup();const stage=path.join(this.root,'staging-'+crypto.randomUUID());fs.mkdirSync(path.join(stage,'assets'),{recursive:true});for(const [name,data]of Object.entries(files))if(name!=='manifest.json')fs.writeFileSync(path.join(stage,name),data);const previous=path.join(this.root,'previous-'+crypto.randomUUID());fs.renameSync(this.current,previous);try{fs.renameSync(stage,this.current)}catch(e){fs.renameSync(previous,this.current);candidate.close();throw e}this.db.close();this.db=candidate;fs.rmSync(previous,{recursive:true,force:true});this.pruneExpired();return backup}
 close(){this.db.close()}
}
