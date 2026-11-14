export function normalizeTags(tags){
 if(!Array.isArray(tags)||tags.length>30||tags.some(t=>typeof t!=='string'||t.trim().length>80))throw Object.assign(Error('Укажите не более 30 тегов, каждый до 80 символов.'),{status:400});
 const seen=new Set();return tags.map(t=>t.trim()).filter(t=>{const key=t.toLocaleLowerCase('ru');if(!t||seen.has(key))return false;seen.add(key);return true});
}
