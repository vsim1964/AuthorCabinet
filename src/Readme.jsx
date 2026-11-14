import React from 'react';
function inline(text){return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g).map((part,i)=>{if(part.startsWith('**'))return <strong key={i}>{part.slice(2,-2)}</strong>;if(part.startsWith('`'))return <code key={i}>{part.slice(1,-1)}</code>;const link=part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);if(link)return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;return part})}
export default function Readme({text}){
 const blocks=[];const lines=text.split(/\r?\n/);let paragraph=[],code=null;
 const flush=()=>{if(paragraph.length){blocks.push(<p key={blocks.length}>{inline(paragraph.join('\n'))}</p>);paragraph=[]}};
 for(const line of lines){
  if(/^\s*```/.test(line)){flush();if(code!==null){blocks.push(<pre key={blocks.length}><code>{code.join('\n')}</code></pre>);code=null}else code=[];continue}
  if(code!==null){code.push(line);continue}
  const heading=line.match(/^(#{1,6})\s+(.+)$/);if(heading){flush();const H='h'+heading[1].length;blocks.push(<H key={blocks.length}>{inline(heading[2])}</H>);continue}
  if(!line.trim()){flush();continue}
  if(/^\s*(?:\d+\.|[-*])\s/.test(line)){flush();blocks.push(<p className="readme-step" key={blocks.length}>{inline(line)}</p>);continue}
  paragraph.push(line);
 }
 flush();if(code!==null)blocks.push(<pre key={blocks.length}><code>{code.join('\n')}</code></pre>);
 return <article className="readme-page" aria-label="README.md">{blocks}</article>
}
