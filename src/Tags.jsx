import React,{useState} from 'react';
import {normalizeTags} from '../tags.mjs';
export function TagList({tags=[]}){return <div className="tag-list">{tags.map(tag=><span className="material-tag" key={tag}>{tag}</span>)}</div>}
export default function Tags({tags=[],existingTags=[],onChange,onError}){
 const [value,setValue]=useState(''),[focused,setFocused]=useState(false),[active,setActive]=useState(-1);
 const key=t=>t.trim().toLocaleLowerCase('ru');
 const token=value.split(',').at(-1).trim();
 const used=new Set([...tags,...value.split(',').slice(0,-1)].map(key));
 const suggestions=[...new Map(existingTags.map(t=>[key(t),t])).values()].filter(t=>!used.has(key(t))&&key(t).includes(key(token)));
 const visible=focused&&!!token&&suggestions.length>0;
 const add=(text=value)=>{if(!text.trim())return;try{onChange(normalizeTags([...tags,...text.split(',')]));setValue('');setActive(-1)}catch(e){onError(e.message)}};
 const choose=tag=>add([...value.split(',').slice(0,-1),tag].join(','));
 return <section className="material-tags" aria-label="Теги материала"><label htmlFor="material-tag-input">Теги</label><div className="tag-list">{tags.map(tag=><span className="material-tag" key={tag}>{tag}<button type="button" aria-label={'Удалить тег: '+tag} onClick={()=>onChange(tags.filter(t=>t!==tag))}>×</button></span>)}{!tags.length&&<span className="tag-empty">Теги пока не добавлены</span>}</div><div className="tag-input-row"><div className="tag-combobox"><input id="material-tag-input" role="combobox" aria-autocomplete="list" aria-expanded={visible} aria-controls="tag-suggestions" aria-activedescendant={visible&&active>=0?'tag-suggestion-'+active:undefined} autoComplete="off" value={value} placeholder="Введите тег и нажмите Enter" maxLength={250} onFocus={()=>setFocused(true)} onChange={e=>{setValue(e.target.value);setActive(-1);setFocused(true)}} onKeyDown={e=>{
 if(e.key==='Escape'){setFocused(false);setActive(-1);return}
 if(visible&&(e.key==='ArrowDown'||e.key==='ArrowUp')){e.preventDefault();setActive(i=>e.key==='ArrowDown'?(i+1)%suggestions.length:(i<=0?suggestions.length-1:i-1));return}
 if(e.key==='Enter'){e.preventDefault();if(visible&&active>=0)choose(suggestions[active]);else add()}
 }} onBlur={e=>{setFocused(false);setActive(-1);if(!e.currentTarget.closest('.material-tags').contains(e.relatedTarget))add()}}/>
 {visible&&<div id="tag-suggestions" role="listbox" aria-label="Существующие теги" className="tag-suggestions">{suggestions.map((tag,i)=><button id={'tag-suggestion-'+i} key={tag} type="button" role="option" aria-selected={active===i} className={active===i?'highlighted':''} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(tag)}>{tag}</button>)}</div>}</div><button type="button" onClick={()=>add()}>Добавить тег</button></div><small>Выберите существующий тег или введите новый. Несколько тегов можно разделить запятыми.</small></section>
}
