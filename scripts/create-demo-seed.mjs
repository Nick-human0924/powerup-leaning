import { lstat, mkdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicDemoSnapshot, legacyDemoSvg, publicDemoSvg } from './public-curriculum.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, '..');
if (!process.argv[2]) throw new Error('A staging target is required. This generator never writes to the repository root.');
const targetRoot = path.resolve(process.argv[2]);
const basePath = process.argv[3] ?? process.env.NEXT_PUBLIC_BASE_PATH ?? '/powerup-leaning';

await assertSafeEmptyStage(targetRoot);
const snapshot = createPublicDemoSnapshot(basePath);
await mkdir(path.join(targetRoot, 'schemas'), { recursive: true });
await mkdir(path.join(targetRoot, 'public', 'demo'), { recursive: true });
const json = `${JSON.stringify(snapshot, null, 2)}\n`;
await writeFile(path.join(targetRoot, 'schemas', 'initial-reference.json'), json, 'utf8');
await writeFile(path.join(targetRoot, 'public', 'seed.json'), json, 'utf8');
await writeFile(path.join(targetRoot, 'public', 'demo', 'demo-source.svg'), legacyDemoSvg, 'utf8');
await writeFile(path.join(targetRoot, 'public', 'demo', 'curriculum.svg'), publicDemoSvg, 'utf8');

async function assertSafeEmptyStage(target) {
  const rootReal = await realpath(repositoryRoot);
  const tmpRoot = path.join(rootReal, 'tmp');
  const relative = path.relative(tmpRoot, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || relative.includes(path.sep)) throw new Error('Demo seed target must be a direct child of repository tmp.');
  if (!/^pages-build-[a-z0-9-]+$/iu.test(path.basename(target))) throw new Error('Demo seed target must use the pages-build-* staging name.');
  const info = await lstat(target).catch(() => undefined);
  if (!info?.isDirectory() || info.isSymbolicLink()) throw new Error('Demo seed target must be an existing, real staging directory.');
  const targetReal = await realpath(target);
  const realRelative = path.relative(tmpRoot, targetReal);
  if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative) || realRelative.includes(path.sep)) throw new Error('Demo seed staging directory resolves outside repository tmp.');
  const forbidden = [
    path.join(target, 'schemas', 'initial-reference.json'),
    path.join(target, 'schemas', 'textbook-import.json'),
    path.join(target, 'public', 'seed.json'),
    path.join(target, 'public', 'textbook-pages'),
    path.join(target, 'public', 'reference-pages'),
    path.join(target, 'imports'),
    path.join(target, '.env'),
  ];
  for (const candidate of forbidden) {
    if (await lstat(candidate).then(() => true, () => false)) throw new Error(`Demo seed refuses to overwrite or coexist with private/local data: ${candidate}`);
  }
}
