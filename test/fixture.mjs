import {Document,Paragraph,TextRun,Packer,HeadingLevel} from 'docx';
// Synthetic data for import tests. No book or author manuscripts are bundled.
export async function fixtureDocx(){
 const children=[];
 for(let n=1;n<=15;n++){
  children.push(new Paragraph({heading:HeadingLevel.HEADING_1,text:n+': Тестовый раздел '+n}));
  children.push(new Paragraph({children:[new TextRun('Проверочный абзац '+n+'. '),new TextRun({text:'Термин '+n,italics:true}),new TextRun(' и пояснение для проверки импорта.')] }));
 }
 return Packer.toBuffer(new Document({sections:[{children}]}));
}
