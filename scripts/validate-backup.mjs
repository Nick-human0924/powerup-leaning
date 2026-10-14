import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
if(!process.argv[2])throw Error('Usage: node scripts/validate-backup.mjs <backup.json>');
fs.mkdirSync('tmp/validate-build',{recursive:true});
fs.writeFileSync('tmp/validate-build/schema.js',ts.transpileModule(fs.readFileSync('src/lib/schema.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
const require=createRequire(import.meta.url);const {validateReferences}=require('../tmp/validate-build/schema.js');
const data=validateReferences(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));
console.log(JSON.stringify({schema_version:data.schema_version,skills:data.skills.length,observations:data.observations.length,notes:data.notes.length,lessons:data.lessons.length}));
