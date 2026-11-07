import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {start} from '../server.mjs';
test('Second launch returns existing address and does not stop or modify the running cabinet',async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'author-reopen-'));const app=await start({root,port:0,seed:false});try{app.store.create({title:'Сохранённая глава'});const before=fs.readFileSync(path.join(root,'current','database.sqlite'));const port=app.server.address().port;const second=await start({root,port,seed:false});assert.equal(second.alreadyRunning,true);assert.equal(second.address,app.address);await second.close();const response=await fetch(app.address+'/api/state');assert.equal(response.status,200);const data=await response.json();assert.equal(data.documents[0].title,'Сохранённая глава');assert.ok(before.equals(fs.readFileSync(path.join(root,'current','database.sqlite'))))}finally{await app.close();fs.rmSync(root,{recursive:true,force:true})}});
