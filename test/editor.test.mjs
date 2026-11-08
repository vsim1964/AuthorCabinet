import {fixtureDocx} from './fixture.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import fs from 'node:fs';
import mammoth from 'mammoth';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://127.0.0.1:4317'});
for(const key of ['window','document','DOMParser','HTMLElement','Element','Node','MutationObserver','getComputedStyle'])globalThis[key]=key==='getComputedStyle'?dom.window.getComputedStyle.bind(dom.window):dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.requestAnimationFrame=fn=>setTimeout(fn,0);globalThis.cancelAnimationFrame=clearTimeout;
const {Editor}=await import('@tiptap/core');
const {default:StarterKit}=await import('@tiptap/starter-kit');
const {TextStyle}=await import('@tiptap/extension-text-style');
const {default:Color}=await import('@tiptap/extension-color');
const {default:Highlight}=await import('@tiptap/extension-highlight');
const {default:Image}=await import('@tiptap/extension-image');
const {Table,TableRow,TableCell,TableHeader}=await import('@tiptap/extension-table');
const {default:Subscript}=await import('@tiptap/extension-subscript');
const {default:Superscript}=await import('@tiptap/extension-superscript');
const {clean}=await import('../server.mjs');
const extensions=()=>[StarterKit,TextStyle,Color,Highlight.configure({multicolor:true}),Image,Table,TableRow,TableCell,TableHeader,Subscript,Superscript];
test('Editor retains imported DOCX text and italic spans on open and save',async()=>{const source=await fixtureDocx();const converted=await mammoth.convertToHtml({buffer:source},{includeEmbeddedStyleMap:false});const editor=new Editor({element:document.createElement('div'),extensions:extensions(),content:clean(converted.value)});try{const original=new DOMParser().parseFromString(converted.value,'text/html');const saved=new DOMParser().parseFromString(clean(editor.getHTML()),'text/html');const norm=x=>x.replace(/\s+/g,' ').trim();assert.equal(norm(saved.body.textContent),norm(original.body.textContent));assert.equal(saved.querySelectorAll('em').length,original.querySelectorAll('em').length);assert.equal(saved.querySelectorAll('h1').length,15)}finally{editor.destroy()}});
test('Rich formatting, tables, lists, quotes and images survive sanitization and reopening',()=>{const input='<h2>Заголовок</h2><p><strong>Жирный</strong> <em>Курсив</em> <u>Линия</u> <s>Правка</s> H<sub>2</sub> x<sup>3</sup> <span style="color:#ff0000">Цвет</span> <mark data-color="#ffff00" style="background-color:#ffff00">Выделение</mark> <a href="https://example.org">Источник</a></p><blockquote><p>Цитата</p></blockquote><ul><li><p>Пункт</p></li></ul><ol><li><p>Первый</p></li></ol><table><tr><th>Название</th><td>Ячейка</td></tr></table><img src="/assets/ab12.png" alt="Схема">';const editor=new Editor({element:document.createElement('div'),extensions:extensions(),content:input});let reopened;try{const html=clean(editor.getHTML());reopened=new Editor({element:document.createElement('div'),extensions:extensions(),content:html});const doc=new DOMParser().parseFromString(reopened.getHTML(),'text/html');for(const tag of ['strong','em','u','s','sub','sup','span','mark','a','blockquote','ul','ol','table','img'])assert.ok(doc.querySelector(tag),tag);assert.equal(doc.querySelector('img').getAttribute('src'),'/assets/ab12.png');assert.ok(doc.querySelector('span').getAttribute('style').includes('color'))}finally{editor.destroy();reopened?.destroy()}});

test('Internal material links retain stable targets through editor and server round trips',async()=>{
 const {materialHref,materialId}=await import('../material-links.mjs');
 const href=materialHref('12345678-abcd-4321-abcd-123456789abc');
 const editor=new Editor({element:document.createElement('div'),extensions:extensions(),content:'<p>См. <a href="'+href+'">другую главу</a></p>'});
 let reopened;
 try{
  const html=clean(editor.getHTML());
  reopened=new Editor({element:document.createElement('div'),extensions:extensions(),content:html});
  const saved=new DOMParser().parseFromString(clean(reopened.getHTML()),'text/html');
  const link=saved.querySelector('a');
  assert.equal(link.getAttribute('href'),href);
  assert.equal(link.getAttribute('target'),'_self');
  assert.equal(link.textContent,'другую главу');
  assert.equal(materialId(href),'12345678-abcd-4321-abcd-123456789abc');
  assert.equal(materialId('https://example.org/#material/123'),null);
  assert.equal(materialId('#material/../../api'),null);
  assert.equal(materialId('javascript:alert(1)'),null);
  const external=new DOMParser().parseFromString(clean('<a href="https://example.org">Источник</a><a href="javascript:alert(1)">Опасно</a>'),'text/html');
  assert.equal(external.querySelector('a').getAttribute('target'),'_blank');
  assert.equal(external.querySelectorAll('a')[1].hasAttribute('href'),false);
 }finally{editor.destroy();reopened?.destroy()}
});
