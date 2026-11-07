import fs from 'node:fs';
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
  db.run('PRAGMA user_version=2');db.run('COMMIT');
 }catch(error){db.run('ROLLBACK');throw error}
}
export class Store {
 constructor(root,{now=()=>new Date()}={}){
  this.root=root;this.now=now;this.current=path.join(root,'current');this.backups=path.join(root,'backups');
  fs.mkdirSync(this.current,{recursive:true});fs.mkdirSync(this.backups,{recursive:true});fs.mkdirSync(path.join(this.current,'assets'),{recursive:true});
  const file=path.join(this.current,'database.sqlite');const existed=fs.existsSync(file);
  this.db=existed?new SQL.Database(fs.readFileSync(file)):new SQL.Database();
  const schema=this.db.exec('PRAGMA user_version')[0].values[0][0];if(schema>2)throw Error('База создана более новой версией приложения');
  this.db.run(`CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,title TEXT NOT NULL,kind TEXT NOT NULL,html TEXT NOT NULL DEFAULT '',plain TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'черновик',tasks TEXT NOT NULL DEFAULT '[]',checks TEXT NOT NULL DEFAULT '[false,false,false,false,false]',notes TEXT NOT NULL DEFAULT '',examples TEXT NOT NULL DEFAULT '',revision INTEGER NOT NULL DEFAULT 1,position INTEGER NOT NULL,updated TEXT NOT NULL); CREATE TABLE IF NOT EXISTS versions(id TEXT PRIMARY KEY,document_id TEXT NOT NULL,label TEXT NOT NULL,html TEXT NOT NULL,plain TEXT NOT NULL,created TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  if(existed&&schema<2)this.backup();
  migrateVersions(this.db);this.persist();this.pruneExpired();
 }
 rows(sql,args=[]){const s=this.db.prepare(sql);try{s.bind(args);const result=[];while(s.step())result.push(s.getAsObject());return result}finally{s.free()}}
 persist(){const tmp=path.join(this.current,'database.sqlite.tmp');const fd=fs.openSync(tmp,'w');try{fs.writeFileSync(fd,this.db.export());fs.fsyncSync(fd)}finally{fs.closeSync(fd)}fs.renameSync(tmp,path.join(this.current,'database.sqlite'))}
 transaction(fn){const before=this.db.export();try{this.db.run('BEGIN');const result=fn();this.db.run('COMMIT');this.persist();return result}catch(error){this.db.close();this.db=new SQL.Database(before);throw error}}
 list(){return this.rows('SELECT id,title,kind,status,position,updated,revision,length(plain) AS characters FROM documents ORDER BY position')}
 get(id){const d=this.rows('SELECT * FROM documents WHERE id=?',[id])[0];if(!d)return null;d.tasks=JSON.parse(d.tasks);d.checks=JSON.parse(d.checks);return d}
 create({title='Новый раздел',kind='глава',html='',plain=''}){return this.transaction(()=>{const id=crypto.randomUUID();const pos=Number(this.rows('SELECT coalesce(max(position),0)+1 AS n FROM documents')[0].n);this.db.run('INSERT INTO documents(id,title,kind,html,plain,position,updated) VALUES (?,?,?,?,?,?,?)',[id,title,kind,html,plain,pos,new Date().toISOString()]);return this.get(id)})}
 save(id,d){
  const old=this.get(id);if(!old)throw Object.assign(Error('Раздел не найден'),{status:404});
  if(d.revision!==old.revision)throw Object.assign(Error('Раздел изменён в другой вкладке. Скачайте несохранённый текст перед перезагрузкой.'),{status:409});
  const result=this.transaction(()=>{
   const now=this.now();
   this.db.run('UPDATE documents SET title=?,kind=?,html=?,plain=?,status=?,tasks=?,checks=?,notes=?,examples=?,revision=revision+1,updated=? WHERE id=?',[d.title,d.kind,d.html,d.plain,d.status,JSON.stringify(d.tasks),JSON.stringify(d.checks),d.notes,d.examples,now.toISOString(),id]);
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
 versions(id){this.pruneExpired();return this.rows('SELECT * FROM versions WHERE document_id=? ORDER BY created DESC',[id])}
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
 restore(bytes){let total=0;const files=unzipSync(bytes,{filter:file=>{total+=file.originalSize;if(total>150*1024*1024)throw Error('Архив слишком большой');return true}});const manifest=JSON.parse(Buffer.from(files['manifest.json']||[]).toString());if(manifest.app!=='author-cabinet'||![1,2].includes(manifest.schema)||!files['database.sqlite'])throw Error('Это не резервная копия Кабинета автора');for(const name of Object.keys(files))if(!['database.sqlite','manifest.json'].includes(name)&&!/^assets\/[a-f0-9-]+\.(png|jpg|jpeg|gif|webp|docx|pdf|txt)$/.test(name))throw Error('Недопустимый путь в архиве');const candidate=new SQL.Database(files['database.sqlite']);try{if(candidate.exec('PRAGMA integrity_check')[0]?.values[0][0]!=='ok')throw Error('Повреждена база данных');candidate.exec('SELECT id,title,html,plain,revision FROM documents LIMIT 1');candidate.exec('SELECT id FROM versions LIMIT 1');candidate.exec('SELECT key,value FROM settings LIMIT 1');if(candidate.exec('PRAGMA user_version')[0].values[0][0]>2)throw Error('Архив создан более новой версией приложения');migrateVersions(candidate);files['database.sqlite']=candidate.export()}catch(e){candidate.close();throw e}const backup=this.backup();const stage=path.join(this.root,'staging-'+crypto.randomUUID());fs.mkdirSync(path.join(stage,'assets'),{recursive:true});for(const [name,data]of Object.entries(files))if(name!=='manifest.json')fs.writeFileSync(path.join(stage,name),data);const previous=path.join(this.root,'previous-'+crypto.randomUUID());fs.renameSync(this.current,previous);try{fs.renameSync(stage,this.current)}catch(e){fs.renameSync(previous,this.current);candidate.close();throw e}this.db.close();this.db=candidate;fs.rmSync(previous,{recursive:true,force:true});this.pruneExpired();return backup}
 close(){this.db.close()}
}
