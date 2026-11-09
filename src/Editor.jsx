import {useEditor,EditorContent} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {TextStyle} from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import {Table,TableRow,TableCell,TableHeader} from '@tiptap/extension-table';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import {useRef,useState,useEffect} from 'react';
import {Bold,Italic,Underline,Strikethrough,Link,Unlink,ImagePlus,Table2,List,ListOrdered,Quote,Subscript as SubIcon,Superscript as SuperIcon,Undo2,Redo2,AlignLeft,AlignCenter,AlignRight,AlignJustify,Highlighter,Palette,RemoveFormatting} from 'lucide-react';
import DOMPurify from 'dompurify';
import {materialHref,materialId} from '../material-links.mjs';
export const clean=html=>DOMPurify.sanitize(html);
export function RichView({html}){return <div className="rich-body" dangerouslySetInnerHTML={{__html:clean(html||'')}}/>}
export default function Editor({html,onChange,onError,materials=[],onOpenMaterial}){
 const file=useRef(null);const toolbar=useRef(null);const [link,setLink]=useState(null);const [linkSearch,setLinkSearch]=useState('');const editor=useEditor({shouldRerenderOnTransaction:true,extensions:[StarterKit.configure({link:{openOnClick:false,HTMLAttributes:{rel:'noopener noreferrer'}}}),TextStyle,Color,Highlight.configure({multicolor:true}),Image,Table.configure({resizable:true}),TableRow,TableCell,TableHeader,Subscript,Superscript,TextAlign.configure({types:['heading','paragraph']})],content:clean(html||''),onUpdate:({editor})=>onChange(editor.getHTML(),editor.getText())});
 useEffect(()=>{
  const element=toolbar.current;if(!editor||!element)return;
  let measured=0;
  const update=()=>{
   const height=Math.ceil(element.getBoundingClientRect().height)+12;if(height===measured)return;measured=height;
   element.closest('.document')?.style.setProperty('--editor-toolbar-height',height+'px');
   editor.setOptions({editorProps:{...editor.options.editorProps,scrollMargin:{top:height,right:12,bottom:12,left:12},scrollThreshold:{top:height,right:0,bottom:0,left:0}}});
  };
  update();
  if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(update);observer.observe(element);return()=>observer.disconnect()}
  window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update);
 },[editor]);
 const normalizeTitle=value=>value.toLocaleLowerCase('ru').replaceAll('ё','е').trim();
 const searchWords=normalizeTitle(linkSearch).split(/\s+/).filter(Boolean);
 const linkResults=materials.filter(d=>searchWords.every(word=>normalizeTitle(d.title).includes(word)));
 const selectedMaterial=materials.find(d=>d.id===link?.id);
 const linkDialog=useRef(null);
 useEffect(()=>{
  if(!link)return;const previous=document.activeElement;
  const dialog=linkDialog.current;
  dialog?.querySelector('input')?.focus();
  const handle=e=>{
   if(e.key==='Escape'){e.preventDefault();setLink(null);return}
   if(e.key!=='Tab'||!dialog)return;
   const controls=[...dialog.querySelectorAll('button:not(:disabled),input,select,[tabindex="0"]')];
   const first=controls[0],last=controls.at(-1);
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
  };
  dialog?.addEventListener('keydown',handle);
  return()=>{dialog?.removeEventListener('keydown',handle);previous?.focus()};
 },[link!==null,link?.type]);
 if(!editor)return null;
 const b=(label,Icon,cmd,active=false,disabled=false)=><button type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={cmd} className={active?'active':''}><Icon size={17}/></button>;
 return <><div className="editor-toolbar" ref={toolbar}><div className="format" role="toolbar" aria-label="Форматирование"><select aria-label="Стиль текста" value={editor.isActive('heading',{level:1})?'h1':editor.isActive('heading',{level:2})?'h2':editor.isActive('heading',{level:3})?'h3':editor.isActive('heading',{level:4})?'h4':'p'} onChange={e=>e.target.value==='p'?editor.chain().focus().setParagraph().run():editor.chain().focus().toggleHeading({level:Number(e.target.value.slice(1))}).run()}><option value="p">Обычный текст</option><option value="h1">H1</option><option value="h2">H2</option><option value="h3">H3</option><option value="h4">H4</option></select>
 {b('Отменить',Undo2,()=>editor.chain().focus().undo().run(),false,!editor.can().undo())}{b('Повторить',Redo2,()=>editor.chain().focus().redo().run(),false,!editor.can().redo())}<span className="separator"/>
 {b('Полужирный',Bold,()=>editor.chain().focus().toggleBold().run(),editor.isActive('bold'))}{b('Курсив',Italic,()=>editor.chain().focus().toggleItalic().run(),editor.isActive('italic'))}{b('Подчёркнутый',Underline,()=>editor.chain().focus().toggleUnderline().run(),editor.isActive('underline'))}{b('Зачёркнутый',Strikethrough,()=>editor.chain().focus().toggleStrike().run(),editor.isActive('strike'))}
 <label className="color" title="Цвет текста"><Palette size={17}/><input type="color" aria-label="Цвет текста" value={editor.getAttributes('textStyle').color||'#172333'} onChange={e=>editor.chain().focus().setColor(e.target.value).run()}/></label><label className="color" title="Цвет выделения"><Highlighter size={17}/><input type="color" aria-label="Цвет выделения" defaultValue="#fff29a" onChange={e=>editor.chain().focus().setHighlight({color:e.target.value}).run()}/></label>
 {b('Нижний индекс',SubIcon,()=>editor.chain().focus().toggleSubscript().run(),editor.isActive('subscript'))}{b('Верхний индекс',SuperIcon,()=>editor.chain().focus().toggleSuperscript().run(),editor.isActive('superscript'))}{b('Убрать форматирование',RemoveFormatting,()=>editor.chain().focus().unsetAllMarks().clearNodes().run())}<span className="separator"/>
 {b('Маркированный список',List,()=>editor.chain().focus().toggleBulletList().run(),editor.isActive('bulletList'))}{b('Нумерованный список',ListOrdered,()=>editor.chain().focus().toggleOrderedList().run(),editor.isActive('orderedList'))}{b('Цитата',Quote,()=>editor.chain().focus().toggleBlockquote().run(),editor.isActive('blockquote'))}{b('По левому краю',AlignLeft,()=>editor.chain().focus().setTextAlign('left').run(),editor.isActive({textAlign:'left'}))}{b('По центру',AlignCenter,()=>editor.chain().focus().setTextAlign('center').run(),editor.isActive({textAlign:'center'}))}{b('По правому краю',AlignRight,()=>editor.chain().focus().setTextAlign('right').run(),editor.isActive({textAlign:'right'}))}{b('По ширине',AlignJustify,()=>editor.chain().focus().setTextAlign('justify').run(),editor.isActive({textAlign:'justify'}))}<span className="separator"/>
 {b('Добавить ссылку',Link,()=>{const href=editor.getAttributes('link').href||'';setLinkSearch('');setLink({type:materialId(href)?'material':'external',href,id:materialId(href)||''})},editor.isActive('link'))}{b('Удалить ссылку',Unlink,()=>editor.chain().focus().unsetLink().run(),false,!editor.isActive('link'))}{b('Вставить изображение',ImagePlus,()=>file.current.click())}{b('Вставить таблицу',Table2,()=>editor.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run())}
 <input ref={file} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;if(f.size>5*1024*1024)return onError('Изображение должно быть не больше 5 МБ');try{const r=await fetch('/api/images',{method:'POST',headers:{'X-Author-Client':'1','Content-Type':f.type},body:f});const d=await r.json();if(!r.ok)throw Error(d.error);editor.chain().focus().setImage({src:d.src,alt:f.name}).run()}catch(e){onError(e.message)}}}/></div>
 {editor.isActive('table')&&<div className="table-tools"><button onClick={()=>editor.chain().focus().addRowAfter().run()}>+ Строка</button><button onClick={()=>editor.chain().focus().addColumnAfter().run()}>+ Столбец</button><button onClick={()=>editor.chain().focus().deleteRow().run()}>Удалить строку</button><button onClick={()=>editor.chain().focus().deleteColumn().run()}>Удалить столбец</button><button onClick={()=>editor.chain().focus().mergeOrSplit().run()}>Объединить / разделить</button><button onClick={()=>editor.chain().focus().deleteTable().run()}>Удалить таблицу</button></div>}
 </div><EditorContent editor={editor}/><div className="edit-tip">Ctrl+B: полужирный · Ctrl+I: курсив · Ctrl+Z: отмена · Изображения сохраняются на диск</div>
 {link!==null&&<div className="overlay link-overlay"><form ref={linkDialog} className="modal link-modal" role="dialog" aria-modal="true" aria-labelledby="link-dialog-title" onSubmit={e=>{
  e.preventDefault();let href=link.href;let title='';
  if(link.type==='material'){
   const target=materials.find(d=>d.id===link.id);if(!target)return onError('Выберите доступный материал проекта');
   href=materialHref(target.id);title=target.title;
  }else{try{const u=new URL(href);if(!['https:','http:','mailto:'].includes(u.protocol))throw Error()}catch{return onError('Введите полный адрес, например https://example.org')}}
  const chain=editor.chain().focus().extendMarkRange('link');
  if(editor.state.selection.empty&&title&&!editor.isActive('link'))chain.insertContent({type:'text',text:title,marks:[{type:'link',attrs:{href,target:'_self'}}]}).run();
  else chain.setLink({href,target:link.type==='material'?'_self':'_blank'}).run();
  setLink(null);
 }}><div className="link-dialog-header"><h2 id="link-dialog-title">Вставить ссылку</h2><button type="button" aria-label="Закрыть окно ссылки" onClick={()=>setLink(null)}>×</button></div>
 <fieldset className="link-kind"><legend>Куда ведёт ссылка</legend>{[['external','Внешний ресурс'],['material','Материал проекта']].map(([value,label])=><label key={value} className={link.type===value?'chosen':''}><input type="radio" name="link-kind" checked={link.type===value} onChange={()=>setLink({...link,type:value})}/>{label}</label>)}</fieldset>
 <div className="link-dialog-content">{link.type==='external'?<><label className="link-field" htmlFor="external-link-address">Адрес ресурса</label><input id="external-link-address" type="text" value={link.href} onChange={e=>setLink({...link,href:e.target.value})} placeholder="https://example.org"/><p className="hint">Вставьте полный адрес страницы или адрес электронной почты с префиксом mailto:.</p></>:<><label className="link-field" htmlFor="material-link-search">Поиск материала по названию</label><input id="material-link-search" type="search" autoComplete="off" value={linkSearch} onChange={e=>setLinkSearch(e.target.value)} placeholder="Начните вводить название…" aria-controls="material-link-results"/><p className="link-result-count" role="status">Найдено: {linkResults.length}</p><div id="material-link-results" className="link-results" role="group" aria-label="Найденные материалы">{linkResults.length?linkResults.map(d=><button key={d.id} type="button" aria-pressed={link.id===d.id} className={'link-result '+(link.id===d.id?'selected':'')} onClick={()=>setLink({...link,id:d.id})}><span>{d.title}</span><small>{d.kind}{link.id===d.id?' · выбран':''}</small></button>):<p className="link-no-results">{materials.length?'Материалы не найдены. Измените запрос.':'В проекте пока нет материалов.'}</p>}</div>{selectedMaterial&&<div className="link-selected"><strong>Выбрано:</strong> {selectedMaterial.title}</div>}<p className="hint">Выделенный текст станет ссылкой. Если выделения нет, вставится название материала. Переход в редакторе: Ctrl+щелчок.</p></>}</div>
 <div className="actions link-dialog-actions"><button type="button" onClick={()=>setLink(null)}>Отмена</button>{link.type==='material'&&link.id&&<button type="button" onClick={()=>{const id=link.id;setLink(null);onOpenMaterial?.(id)}}>Открыть материал</button>}<button className="primary" disabled={link.type==='material'?!selectedMaterial:!link.href.trim()}>Вставить ссылку</button></div></form></div>}</>
}
