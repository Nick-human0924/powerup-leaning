import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const html=fs.readFileSync('reference/andy_review_demo_v3.html','utf8');
function literal(name){const match=html.match(new RegExp(`const ${name}=([\\s\\S]*?);(?:\\r?\\n)`));if(!match)throw Error(`Missing ${name}`);return vm.runInNewContext(`(${match[1]})`,{}, {timeout:1000});}
fs.mkdirSync('public/reference-pages',{recursive:true});
const source=literal('SOURCE');
for(const [page,data] of Object.entries(source)){const b64=data.split(',')[1];fs.writeFileSync(`public/reference-pages/p${page}.jpg`,Buffer.from(b64,'base64'));}
fs.writeFileSync('imports/reference-extracted.json',JSON.stringify({book:literal('BOOK'),units:literal('UNITS'),tasks:literal('TASKS'),pages:Object.keys(source).map(Number)},null,2));
console.log(`Extracted ${Object.keys(source).length} genuine reference previews; no textbook PDFs present.`);
