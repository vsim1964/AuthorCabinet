import React,{useState} from 'react';
import {normalizeTags} from '../tags.mjs';
export function TagList({tags=[]}){return <div className="tag-list">{tags.map(tag=><span className="material-tag" key={tag}>{tag}</span>)}</div>}
export default function Tags({tags=[],onChange,onError}){
 const [value,setValue]=useState('');
 const add=()=>{if(!value.trim())return;try{onChange(normalizeTags([...tags,...value.split(',')]));setValue('')}catch(e){onError(e.message)}};
 return <section className="material-tags" aria-label="Теги материала"><label htmlFor="material-tag-input">Теги</label><div className="tag-list">{tags.map(tag=><span className="material-tag" key={tag}>{tag}<button type="button" aria-label={'Удалить тег: '+tag} onClick={()=>onChange(tags.filter(t=>t!==tag))}>×</button></span>)}{!tags.length&&<span className="tag-empty">Теги пока не добавлены</span>}</div><div className="tag-input-row"><input id="material-tag-input" value={value} placeholder="Введите тег и нажмите Enter" maxLength={250} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add()}}} onBlur={add}/><button type="button" onClick={add}>Добавить тег</button></div><small>Несколько тегов можно разделить запятыми.</small></section>
}
