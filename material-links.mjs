// Stable project-local links remain valid after renaming and reordering materials.
export function materialHref(id){return '#material/'+encodeURIComponent(id)}
export function materialId(href){
 const match=/^#material\/([a-zA-Z0-9-]+)$/.exec(href||'');
 return match?.[1]||null;
}
