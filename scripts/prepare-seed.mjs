import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import { createRequire } from 'node:module';
const seed=JSON.parse(fs.readFileSync('schemas/initial-reference.json','utf8'));
fs.mkdirSync('tmp/seed-build',{recursive:true});
for(const name of ['schema','runtime','domain'])fs.writeFileSync(`tmp/seed-build/${name}.js`,ts.transpileModule(fs.readFileSync(`src/lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
const require=createRequire(import.meta.url);
const {generateTasks}=require('../tmp/seed-build/domain.js');
for(const skill of seed.skills)if(!seed.tasks.some(t=>t.skill_ids.includes(skill.id)))seed.tasks.push(...generateTasks(skill));
for(const asset of seed.assets){
  if(!asset.storage_ref.startsWith('/'))continue;
  const data=fs.readFileSync('public'+asset.storage_ref);
  asset.file_hash=crypto.createHash('sha256').update(data).digest('hex');
  const page=seed.pages.find(p=>p.asset_id===asset.id);if(page)page.content_hash=asset.file_hash;
}
fs.writeFileSync('public/seed.json',JSON.stringify(seed,null,2));
fs.writeFileSync('schemas/initial-reference.json',JSON.stringify(seed,null,2));
console.log('Private initial data ready; generated pages remain private.');
