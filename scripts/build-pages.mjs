import { spawnSync } from 'node:child_process';
import { cp, lstat, mkdir, readFile, readdir, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '..');
const stage = path.join(root, 'tmp', `pages-build-${process.pid}`);
const output = path.join(root, 'pages-out');
const basePath = '/powerup-leaning';
const sourceNodeModules = path.join(root, 'node_modules');

const rootFiles = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'next.config.ts'];
const publicFiles = ['icon.svg', 'icon-192.png', 'icon-512.png'];
const visualFiles = ['hero-learning-v2.png', 'parent-guide-v2.png', 'child-practice-v2.png'];

await assertDirectory(sourceNodeModules, 'node_modules is missing. Run pnpm install before building Pages.');
await assertSafeTmpRoot();
await safeRemoveStage(stage);
await mkdir(stage, { recursive: true });

try {
  await cp(path.join(root, 'src'), path.join(stage, 'src'), { recursive: true });
  await rm(path.join(stage, 'src', 'app', 'api'), { recursive: true, force: true });
  for (const filename of rootFiles) await cp(path.join(root, filename), path.join(stage, filename));
  await mkdir(path.join(stage, 'public', 'visuals'), { recursive: true });
  for (const filename of publicFiles) await cp(path.join(root, 'public', filename), path.join(stage, 'public', filename));
  await cp(path.join(sourceNodeModules, 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'), path.join(stage, 'public', 'pdf.worker.min.mjs'));
  for (const filename of visualFiles) await cp(path.join(root, 'public', 'visuals', filename), path.join(stage, 'public', 'visuals', filename));
  const fromNext=createRequire(await realpath(path.join(sourceNodeModules,'next','package.json')));
  const sharp=fromNext('sharp');
  const homeFile=path.join(stage,'src','components','HomeView.tsx');
  let home=await readFile(homeFile,'utf8');
  for(let i=0;i<visualFiles.length;i++){
    const original=visualFiles[i],optimized=original.replace(/\.png$/u,'.webp');
    await sharp(path.join(stage,'public','visuals',original)).resize({width:i===0?1000:320,withoutEnlargement:true}).webp({quality:82}).toFile(path.join(stage,'public','visuals',optimized));
    await unlink(path.join(stage,'public','visuals',original));
    home=home.replaceAll(`/visuals/${original}`,`/visuals/${optimized}`);
    visualFiles[i]=optimized;
  }
  await writeFile(homeFile,home,'utf8');

  const manifest = {
    name: '英语互动复习演示', short_name: 'English Demo', lang: 'zh-CN',
    start_url: `${basePath}/`, scope: `${basePath}/`, display: 'standalone',
    background_color: '#F8F6F0', theme_color: '#116B5B',
    icons: [
      { src: `${basePath}/icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: `${basePath}/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${basePath}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
  await writeFile(path.join(stage, 'public', 'manifest.webmanifest'), `${JSON.stringify(manifest)}\n`, 'utf8');

  const demoSeedScript = path.join(root, 'scripts', 'create-demo-seed.mjs');
  runNode([demoSeedScript, stage, basePath], root, 'Synthetic demo seed generation failed.');
  await assertPublicAllowlist(stage);

  await symlink(sourceNodeModules, path.join(stage, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const nextCli = path.join(sourceNodeModules, 'next', 'dist', 'bin', 'next');
  runNode([nextCli, 'build'], stage, 'GitHub Pages static build failed.', {
    ...process.env,
    GITHUB_PAGES: 'true',
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_PUBLIC_DEMO: 'true',
  });

  const exported = path.join(stage, 'out');
  await assertDirectory(exported, 'Next.js did not create the expected static out directory.');
  await safeRemoveOutput(output);
  await cp(exported, output, { recursive: true });
  console.log(`GitHub Pages export created at ${output}`);
} finally {
  await safeRemoveStage(stage);
}

function runNode(args, cwd, message, env = process.env) {
  const result = spawnSync(process.execPath, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${message} Exit code: ${result.status ?? 'unknown'}`);
}

async function assertDirectory(target, message) {
  try {
    if (!(await lstat(target)).isDirectory()) throw new Error(message);
  } catch (error) {
    if (error instanceof Error && error.message === message) throw error;
    throw new Error(message, { cause: error });
  }
}

async function assertPublicAllowlist(targetRoot) {
  const publicRoot = path.join(targetRoot, 'public');
  const allowed = new Set([
    'demo/demo-source.svg',
    'demo/curriculum.svg',
    'icon-192.png',
    'icon-512.png',
    'icon.svg',
    'manifest.webmanifest',
    'pdf.worker.min.mjs',
    'seed.json',
    ...visualFiles.map((filename) => `visuals/${filename}`),
  ]);
  const actual = await listFiles(publicRoot);
  const unexpected = actual.filter((filename) => !allowed.has(filename));
  const missing = [...allowed].filter((filename) => !actual.includes(filename));
  if (unexpected.length || missing.length) throw new Error(`Pages public allowlist mismatch. Unexpected: ${unexpected.join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'}`);

  const seedText = await readFile(path.join(publicRoot, 'seed.json'), 'utf8');
  const seed = JSON.parse(seedText);
  if (seed.materials?.[0]?.title !== '互动演示素材' || seed.audit?.[0]?.id !== 'public-demo-v1') throw new Error('Pages seed is not the synthetic public demo seed.');
  for (const collection of ['lessons', 'sessions', 'observations', 'notes', 'audio']) {
    if (!Array.isArray(seed[collection]) || seed[collection].length) throw new Error(`Pages seed contains forbidden history collection: ${collection}`);
  }
  const lower = seedText.toLowerCase();
  for (const forbidden of ['power up', 'pupil_s book', 'textbook-pages', 'reference-pages', 'private-file:', 'local-file:']) {
    if (lower.includes(forbidden)) throw new Error(`Pages seed contains forbidden local textbook marker: ${forbidden}`);
  }
}

async function listFiles(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await listFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) result.push(relative.replaceAll('\\', '/'));
    else throw new Error(`Pages public directory contains a non-file entry: ${relative}`);
  }
  return result.sort();
}

async function safeRemoveStage(target) {
  assertLexicalChild(path.join(root, 'tmp'), target, /^pages-build-[a-z0-9-]+$/iu, 'Pages staging directory');
  const info = await lstat(target).catch(() => undefined);
  if (!info) return;
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Refusing to recursively remove a staging path that is not a real directory.');
  await assertRealChild(path.join(root, 'tmp'), target, 'Pages staging directory');
  const nodeModulesLink = path.join(target, 'node_modules');
  const nodeModulesInfo = await lstat(nodeModulesLink).catch(() => undefined);
  if (nodeModulesInfo?.isSymbolicLink()) await unlink(nodeModulesLink);
  else if (nodeModulesInfo) throw new Error('Refusing to clean staging because node_modules is not the expected link.');
  await rm(target, { recursive: true, force: true });
}

async function assertSafeTmpRoot() {
  const tmpRoot = path.join(root, 'tmp');
  const rootReal = await realpath(root);
  const info = await lstat(tmpRoot).catch(() => undefined);
  if (!info) await mkdir(tmpRoot);
  else if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Repository tmp must be a real directory, not a link.');
  const tmpReal = await realpath(tmpRoot);
  if (path.dirname(tmpReal) !== rootReal || path.basename(tmpReal) !== 'tmp') throw new Error('Repository tmp resolves outside the repository root.');
}

async function safeRemoveOutput(target) {
  if (path.resolve(target) !== path.join(root, 'pages-out')) throw new Error('Pages output path is not the expected repository pages-out directory.');
  const info = await lstat(target).catch(() => undefined);
  if (!info) return;
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Refusing to recursively remove pages-out because it is not a real directory.');
  await assertRealChild(root, target, 'Pages output directory');
  await rm(target, { recursive: true, force: true });
}

function assertLexicalChild(parent, target, basenamePattern, label) {
  const resolvedParent = path.resolve(parent);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedParent, resolvedTarget);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || relative.includes(path.sep) || !basenamePattern.test(path.basename(resolvedTarget))) {
    throw new Error(`${label} escapes its allowed parent.`);
  }
}

async function assertRealChild(parent, target, label) {
  const parentReal = await realpath(parent);
  const targetReal = await realpath(target);
  const relative = path.relative(parentReal, targetReal);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || relative.includes(path.sep)) throw new Error(`${label} resolves outside its allowed parent.`);
}
