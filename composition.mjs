// Keep author-written titles unchanged; order does not imply chapter numbering.
export function chapterTitle(title){return String(title)}
export function numberChapters(documents){return documents.map(d=>({...d,chapterNumber:null}))}
export function chapterLabel(document){return document.title}
export function moveRelative(ids,source,target,placement='before'){
 if(source===target)return [...ids];if(!ids.includes(source)||!ids.includes(target))throw Error('Материал не найден в оглавлении');
 const moved=ids.filter(id=>id!==source);const index=moved.indexOf(target)+(placement==='after'?1:0);moved.splice(index,0,source);return moved;
}
