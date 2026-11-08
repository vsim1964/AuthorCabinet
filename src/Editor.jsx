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
 const file=useRef(null);const toolbar=useRef(null);const [link,setLink]=useState(null);const editor=useEditor({shouldRerenderOnTransaction:true,extensions:[StarterKit.configure({link:{openOnClick:false,HTMLAttributes:{rel:'noopener noreferrer'}}}),TextStyle,Color,Highlight.configure({multicolor:true}),Image,Table.configure({resizable:true}),TableRow,TableCell,TableHeader,Subscript,Superscript,TextAlign.configure({types:['heading','paragraph']})],content:clean(html||''),onUpdate:({editor})=>onChange(editor.getHTML(),editor.getText())});
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
 if(!editor)return null;
 const b=(label,Icon,cmd,active=false,disabled=false)=><button type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={cmd} className={active?'active':''}><Icon size={17}/></button>;
 return <><div className="editor-toolbar" ref={toolbar}><div className="format" role="toolbar" aria-label="Форматирование"><select aria-label="Стиль текста" value={editor.isActive('heading',{level:1})?'h1':editor.isActive('heading',{level:2})?'h2':editor.isActive('heading',{level:3})?'h3':editor.isActive('heading',{level:4})?'h4':'p'} onChange={e=>e.target.value==='p'?editor.chain().focus().setParagraph().run():editor.chain().focus().toggleHeading({level:Number(e.target.value.slice(1))}).run()}><option value="p">Обычный текст</option><option value="h1">H1</option><option value="h2">H2</option><option value="h3">H3</option><option value="h4">H4</option></select>
 {b('Отменить',Undo2,()=>editor.chain().focus().undo().run(),false,!editor.can().undo())}{b('Повторить',Redo2,()=>editor.chain().focus().redo().run(),false,!editor.can().redo())}<span className="separator"/>
 {b('Полужирный',Bold,()=>editor.chain().focus().toggleBold().run(),editor.isActive('bold'))}{b('Курсив',Italic,()=>editor.chain().focus().toggleItalic().run(),editor.isActive('italic'))}{b('Подчёркнутый',Underline,()=>editor.chain().focus().toggleUnderline().run(),editor.isActive('underline'))}{b('Зачёркнутый',Strikethrough,()=>editor.chain().focus().toggleStrike().run(),editor.isActive('strike'))}
 <label className="color" title="Цвет текста"><Palette size={17}/><input type="color" aria-label="Цвет текста" value={editor.getAttributes('textStyle').color||'#172333'} onChange={e=>editor.chain().focus().setColor(e.target.value).run()}/></label><label className="color" title="Цвет выделения"><Highlighter size={17}/><input type="color" aria-label="Цвет выделения" defaultValue="#fff29a" onChange={e=>editor.chain().focus().setHighlight({color:e.target.value}).run()}/></label>
 {b('Нижний индекс',SubIcon,()=>editor.chain().focus().toggleSubscript().run(),editor.isActive('subscript'))}{b('Верхний индекс',SuperIcon,()=>editor.chain().focus().toggleSuperscript().run(),editor.isActive('superscript'))}{b('Убрать форматирование',RemoveFormatting,()=>editor.chain().focus().unsetAllMarks().clearNodes().run())}<span className="separator"/>
 {b('Маркированный список',List,()=>editor.chain().focus().toggleBulletList().run(),editor.isActive('bulletList'))}{b('Нумерованный список',ListOrdered,()=>editor.chain().focus().toggleOrderedList().run(),editor.isActive('orderedList'))}{b('Цитата',Quote,()=>editor.chain().focus().toggleBlockquote().run(),editor.isActive('blockquote'))}{b('По левому краю',AlignLeft,()=>editor.chain().focus().setTextAlign('left').run(),editor.isActive({textAlign:'left'}))}{b('По центру',AlignCenter,()=>editor.chain().focus().setTextAlign('center').run(),editor.isActive({textAlign:'center'}))}{b('По правому краю',AlignRight,()=>editor.chain().focus().setTextAlign('right').run(),editor.isActive({textAlign:'right'}))}{b('По ширине',AlignJustify,()=>editor.chain().focus().setTextAlign('justify').run(),editor.isActive({textAlign:'justify'}))}<span className="separator"/>
 {b('Добавить ссылку',Link,()=>{const href=editor.getAttributes('link').href||'';setLink({type:materialId(href)?'material':'external',href,id:materialId(href)||''})},editor.isActive('link'))}{b('Удалить ссылку',Unlink,()=>editor.chain().focus().unsetLink().run(),false,!editor.isActive('link'))}{b('Вставить изображение',ImagePlus,()=>file.current.click())}{b('Вставить таблицу',Table2,()=>editor.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run())}
 <input ref={file} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;if(f.size>5*1024*1024)return onError('Изображение должно быть не больше 5 МБ');try{const r=await fetch('/api/images',{method:'POST',headers:{'X-Author-Client':'1','Content-Type':f.type},body:f});const d=await r.json();if(!r.ok)throw Error(d.error);editor.chain().focus().setImage({src:d.src,alt:f.name}).run()}catch(e){onError(e.message)}}}/></div>
 {editor.isActive('table')&&<div className="table-tools"><button onClick={()=>editor.chain().focus().addRowAfter().run()}>+ Строка</button><button onClick={()=>editor.chain().focus().addColumnAfter().run()}>+ Столбец</button><button onClick={()=>editor.chain().focus().deleteRow().run()}>Удалить строку</button><button onClick={()=>editor.chain().focus().deleteColumn().run()}>Удалить столбец</button><button onClick={()=>editor.chain().focus().mergeOrSplit().run()}>Объединить / разделить</button><button onClick={()=>editor.chain().focus().deleteTable().run()}>Удалить таблицу</button></div>}
 </div><EditorContent editor={editor}/><div className="edit-tip">Ctrl+B: полужирный · Ctrl+I: курсив · Ctrl+Z: отмена · Изображения сохраняются на диск</div>
 {link!==null&&<div className="overlay"><form className="modal" role="dialog" aria-modal="true" aria-label="Ссылка" onSubmit={e=>{
  e.preventDefault();let href=link.href;let title='';
  if(link.type==='material'){
   const target=materials.find(d=>d.id===link.id);if(!target)return onError('Выберите доступный материал проекта');
   href=materialHref(target.id);title=target.title;
  }else{try{const u=new URL(href);if(!['https:','http:','mailto:'].includes(u.protocol))throw Error()}catch{return onError('Введите полный адрес, например https://example.org')}}
  const chain=editor.chain().focus().extendMarkRange('link');
  if(editor.state.selection.empty&&title&&!editor.isActive('link'))chain.insertContent({type:'text',text:title,marks:[{type:'link',attrs:{href,target:'_self'}}]}).run();
  else chain.setLink({href,target:link.type==='material'?'_self':'_blank'}).run();
  setLink(null);
 }}><h2>Ссылка</h2><label>Куда ведёт ссылка<select value={link.type} onChange={e=>setLink({...link,type:e.target.value})}><option value="external">Внешний ресурс</option><option value="material">Материал проекта</option></select></label>
 {link.type==='external'?<label>Адрес<input autoFocus value={link.href} onChange={e=>setLink({...link,href:e.target.value})} placeholder="https://"/></label>:<><label>Материал<select autoFocus value={link.id} onChange={e=>setLink({...link,id:e.target.value})}><option value="">Выберите материал</option>{materials.map(d=><option key={d.id} value={d.id}>{d.kind}: {d.title}</option>)}</select></label>{!materials.length&&<p>Сначала создайте материал проекта.</p>}<p className="hint">Выделенный текст станет ссылкой. Если выделения нет, будет вставлено название материала. Для перехода в редакторе нажмите Ctrl и щёлкните ссылку.</p></>}
 <div className="actions"><button type="button" onClick={()=>setLink(null)}>Отмена</button>{link.type==='material'&&link.id&&<button type="button" onClick={()=>{const id=link.id;setLink(null);onOpenMaterial?.(id)}}>Открыть материал</button>}<button className="primary">Вставить</button></div></form></div>}</>
}
