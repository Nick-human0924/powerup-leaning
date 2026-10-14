import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const empty={schema_version:'1.0.0',materials:[],assets:[],pages:[],units:[],sections:[],skills:[],tasks:[],lessons:[],sessions:[],observations:[],notes:[],audio:[],jobs:[],audit:[]};
for(const directory of ['schemas','public'])fs.mkdirSync(path.join(project,directory),{recursive:true});
const seedPath=path.join(project,'schemas/initial-reference.json');
if(!fs.existsSync(seedPath)) {
  fs.writeFileSync(seedPath,JSON.stringify(empty,null,2));
  console.log('Created empty local catalog; import your own materials through the app.');
}
const publicPath=path.join(project,'public/seed.json');
if(!fs.existsSync(publicPath))fs.copyFileSync(seedPath,publicPath);
const nextEnv=path.join(project,'next-env.d.ts');
if(!fs.existsSync(nextEnv))fs.writeFileSync(nextEnv,'/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n');
const worker=path.join(project,'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
if(fs.existsSync(worker))fs.copyFileSync(worker,path.join(project,'public/pdf.worker.min.mjs'));
