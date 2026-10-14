import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
let privateCatalog=false;
try { privateCatalog=JSON.parse(readFileSync(new URL('./schemas/initial-reference.json',import.meta.url),'utf8')).skills.length>0; } catch {}
export default defineConfig({test:{include:privateCatalog?['tests/**/*.test.ts']:['tests/public.test.ts','tests/providers.test.ts'],environment:'node'},resolve:{alias:{'@':new URL('./src',import.meta.url).pathname}}});
