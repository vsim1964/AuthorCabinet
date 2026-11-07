import fs from 'node:fs';
import path from 'node:path';
import {parseDocument,DomUtils} from 'htmlparser2';
import {Document,Packer} from 'docx';
import {htmlToContent} from 'docx/html';
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const mime={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp'};
const stylesheet='body{max-width:850px;margin:40px auto;padding:0 24px;font:18px/1.7 Georgia,serif;color:#172333;background:white}h1{font-size:1.6em}h2{font-size:1.4em}h3{font-size:1.2em}h4{font-size:1.1em}h1,h2,h3,h4{line-height:1.4;break-after:avoid}p{margin:0 0 1em}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%;margin:1em 0}td,th{border:1px solid #7185a0;padding:8px;vertical-align:top}th{background:#e6eefb}blockquote{border-left:4px solid #2563eb;padding:12px 20px;margin:1em 0;background:#edf3ff}a{color:#164dc7}section{margin-top:2.5em}.book-title{font-size:2em}';
export function selectDocuments(documents,{scope,ids}={}){
 if(scope==='book'){const result=documents.filter(d=>d.kind==='глава');if(!result.length)throw Error('В книге пока нет глав. Выберите материалы для экспорта.');return result}
 if(!['current','selected'].includes(scope))throw Error('Выберите книгу, текущий материал или несколько разделов');
 if(!Array.isArray(ids)||!ids.length||ids.some(id=>typeof id!=='string')||(scope==='current'&&ids.length!==1))throw Error('Выберите хотя бы один материал');
 const selected=new Set(ids);const result=documents.filter(d=>selected.has(d.id));if(result.length!==selected.size)throw Error('Один из выбранных материалов не найден');return result;
}
function withTitle(document){
 const dom=parseDocument(document.html||'');const first=dom.children.find(n=>n.type!=='comment'&&(n.type!=='text'||n.data.trim()));
 const normal=s=>s.replace(/\s+/g,' ').trim();
 if(first?.type==='tag'&&/^h[1-6]$/.test(first.name)&&normal(DomUtils.textContent(first))===normal(document.title))return document.html;
 return '<h1>'+escape(document.title)+'</h1>'+(document.html||'');
}
export function htmlToPlain(html){
 const dom=parseDocument(html);
 const text=node=>{
  if(node.type==='text')return node.data;
  const children=node.children||[];const joined=()=>children.map(text).join('');const name=node.name;
  if(name==='br')return '\n';
  if(name==='img')return '[Изображение'+(node.attribs.alt?': '+node.attribs.alt:'')+']';
  if(name==='ul'||name==='ol'){
   const items=children.filter(n=>n.type==='tag'&&n.name==='li');let start=Number(node.attribs.start)||1;
   return '\n'+items.map((item,i)=>{const body=(item.children||[]).map(text).join('').trim();const lines=body.split('\n');return (name==='ol'?(start+i)+'. ':'• ')+lines[0]+(lines.length>1?'\n'+lines.slice(1).map(l=>'  '+l).join('\n'):'')}).join('\n')+'\n\n';
  }
  if(name==='blockquote')return '\n'+joined().trim().split('\n').map(l=>'> '+l).join('\n')+'\n\n';
  if(name==='tr')return children.filter(n=>n.type==='tag'&&['td','th'].includes(n.name)).map(n=>text(n).trim().replace(/\n+/g,' ')).join('\t')+'\n';
  if(name==='table')return '\n'+joined().trim()+'\n\n';
  if(name==='a'){const t=joined();const href=node.attribs.href;return href&&!href.startsWith('#')&&href!==t.trim()?t+' ('+href+')':t}
  if(['p','h1','h2','h3','h4','h5','h6'].includes(name))return joined()+'\n\n';
  return joined();
 };
 return text(dom).replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
export async function exportPublication({documents,title,format,assetsDirectory,includeBookTitle=false}){
 if(!['html','docx','txt'].includes(format))throw Error('Поддерживаются HTML, DOCX и TXT');
 if(!documents.length)throw Error('Нет материалов для экспорта');
 const bodies=documents.map(withTitle);
 const whole=(includeBookTitle?'<h1 class="book-title">'+escape(title)+'</h1>':'')+bodies.map(html=>'<section>'+html+'</section>').join('');
 const name=(title||'Книга').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'').slice(0,120)||'Книга';
 if(format==='txt'){
  const text=[...(includeBookTitle?[title]:[]),...bodies.map(htmlToPlain)].join('\n\n');
  return {filename:name+'.txt',type:'text/plain; charset=utf-8',bytes:Buffer.from('\ufeff'+text.replace(/\r?\n/g,'\r\n'))};
 }
 const dom=parseDocument(whole);const images=new Map();
 for(const image of DomUtils.findAll(n=>n.type==='tag'&&n.name==='img',dom.children)){
  const src=image.attribs.src||'';const match=src.match(/^\/assets\/([a-f0-9-]+\.(png|jpg|jpeg|gif|webp))$/);
  if(!match)throw Error('Не удалось включить изображение: '+(image.attribs.alt||src||'не указан файл'));
  if(!images.has(src)){
   const file=path.join(assetsDirectory,match[1]);if(!fs.existsSync(file))throw Error('Не найдено изображение «'+(image.attribs.alt||match[1])+'». Добавьте его заново перед экспортом.');
   images.set(src,{bytes:fs.readFileSync(file),mime:mime[match[2]]});
  }
  if(format==='html'){const imageData=images.get(src);image.attribs.src='data:'+imageData.mime+';base64,'+imageData.bytes.toString('base64')}
 }
 if(format==='html')return {filename:name+'.html',type:'text/html; charset=utf-8',bytes:Buffer.from('<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+escape(title)+'</title><style>'+stylesheet+'</style></head><body>'+DomUtils.getOuterHTML(dom,{encodeEntities:"utf8"})+'</body></html>')};
 const warnings=[];
 const children=htmlToContent(whole,{maxImageWidth:600,stylesheet:'table{border-collapse:collapse}td,th{border:1px solid #7185a0;padding:8px}th{background-color:#e6eefb}blockquote{margin-left:24px}',images:source=>images.get(source)?.bytes,onWarning:warning=>warnings.push(warning)});
 if(warnings.length)throw Error('Не удалось полностью перенести оформление в DOCX. Сначала используйте HTML. Подробность: '+JSON.stringify(warnings[0]));
 const doc=new Document({title,creator:'Кабинет автора',styles:{default:{document:{run:{font:'Times New Roman',size:24},paragraph:{spacing:{after:160,line:360}}}}},sections:[{children}]});
 return {filename:name+'.docx',type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',bytes:await Packer.toBuffer(doc)};
}
