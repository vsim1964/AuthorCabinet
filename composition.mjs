// Numbers belong to the composition, not the saved manuscript text.
export function chapterTitle(title){
 const value=String(title).trim();
 if(/^глава\s*(?:№\s*)?\d+\s*[:.)]?\s*$/iu.test(value))return '';
 return value.replace(/^(?:глава\s*(?:№\s*)?\d+(?:\s*[:.)]\s*|\s+)|\d{1,3}\s*[:.)]\s*)(?=\S)/iu,'').trim();
}
export function numberChapters(documents){let chapter=0;return documents.map(d=>({...d,chapterNumber:d.kind==='глава'?++chapter:null}))}
export function chapterLabel(document){return document.kind==='глава'&&Number.isInteger(document.chapterNumber)?'Глава '+document.chapterNumber+(chapterTitle(document.title)?'. '+chapterTitle(document.title):''):document.title}
export function moveRelative(ids,source,target,placement='before'){
 if(source===target)return [...ids];if(!ids.includes(source)||!ids.includes(target))throw Error('Материал не найден в оглавлении');
 const moved=ids.filter(id=>id!==source);const index=moved.indexOf(target)+(placement==='after'?1:0);moved.splice(index,0,source);return moved;
}
