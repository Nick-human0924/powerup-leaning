import { createHash } from 'node:crypto';
import { lstat, mkdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, '..');
if (!process.argv[2]) throw new Error('A staging target is required. This generator never writes to the repository root.');
const targetRoot = path.resolve(process.argv[2]);
const basePath = normalizeBasePath(process.argv[3] ?? process.env.NEXT_PUBLIC_BASE_PATH ?? '/powerup-leaning');
const createdAt = '2026-10-15T00:00:00.000Z';

await assertSafeEmptyStage(targetRoot);

function normalizeBasePath(value) {
  const normalized = `/${String(value).trim().replace(/^\/+|\/+$/gu, '')}`;
  return normalized === '/' ? '' : normalized;
}

const demoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1260" viewBox="0 0 1000 1260" role="img" aria-labelledby="title description">
  <title id="title">互动演示素材</title>
  <desc id="description">公开合成的英语词汇和礼貌请求示例卡片</desc>
  <rect width="1000" height="1260" rx="48" fill="#f8f6f0"/>
  <rect x="64" y="64" width="872" height="1132" rx="40" fill="#ffffff" stroke="#cddbd1" stroke-width="4"/>
  <circle cx="166" cy="170" r="54" fill="#dceee7"/>
  <path d="M142 176c15-35 48-46 70-15-8 39-39 58-70 15Z" fill="#116b5b"/>
  <text x="244" y="158" fill="#116b5b" font-family="Arial, sans-serif" font-size="46" font-weight="700">互动演示素材</text>
  <text x="244" y="208" fill="#586c65" font-family="Arial, sans-serif" font-size="28">公开合成内容 · 不含教材原页或学习记录</text>
  <text x="110" y="330" fill="#173f37" font-family="Arial, sans-serif" font-size="36" font-weight="700">Words</text>
  <g font-family="Arial, sans-serif" font-size="44" fill="#173f37">
    <text x="130" y="430">apple</text><text x="560" y="430" fill="#586c65">苹果</text>
    <text x="130" y="525">book</text><text x="560" y="525" fill="#586c65">书</text>
    <text x="130" y="620">water</text><text x="560" y="620" fill="#586c65">水</text>
  </g>
  <rect x="104" y="714" width="792" height="310" rx="32" fill="#eaf4ef"/>
  <text x="146" y="790" fill="#116b5b" font-family="Arial, sans-serif" font-size="32" font-weight="700">Polite request</text>
  <text x="146" y="875" fill="#173f37" font-family="Arial, sans-serif" font-size="40">Can I have some water,</text>
  <text x="146" y="932" fill="#173f37" font-family="Arial, sans-serif" font-size="40">please?</text>
  <text x="110" y="1110" fill="#8d5c28" font-family="Arial, sans-serif" font-size="26">Synthetic demo card created for the public interface preview.</text>
</svg>\n`;

const sourceHash = createHash('sha256').update(demoSvg).digest('hex');
const materialId = 'DEMO-MATERIAL-INTERACTIVE';
const assetId = 'DEMO-ASSET-CARD';
const pageId = 'DEMO-PAGE-CARD';
const unitId = 'DEMO-UNIT-DAILY';
const sectionId = 'DEMO-SECTION-DAILY';
const previewRef = `${basePath}/demo/demo-source.svg`;

const skillDefinitions = [
  { id: 'DEMO-SKILL-APPLE', title: 'apple', type: 'vocabulary', expression: 'apple', goal: '用英语说出“苹果”', evidence: '公开合成演示卡：Words 区域的 apple。' },
  { id: 'DEMO-SKILL-BOOK', title: 'book', type: 'vocabulary', expression: 'book', goal: '用英语说出“书”', evidence: '公开合成演示卡：Words 区域的 book。' },
  { id: 'DEMO-SKILL-WATER', title: 'water', type: 'vocabulary', expression: 'water', goal: '用英语说出“水”', evidence: '公开合成演示卡：Words 区域的 water。' },
  { id: 'DEMO-SKILL-REQUEST', title: '礼貌提出请求', type: 'target_expression', expression: 'Can I have some water, please?', goal: '在日常情境中礼貌请求喝水', evidence: '公开合成演示卡：Polite request 区域。' },
];

const skills = skillDefinitions.map((item) => ({
  id: item.id,
  title: item.title,
  unit_id: unitId,
  type: item.type,
  canonical_expression: item.expression,
  ...(item.type === 'vocabulary' ? { words: [item.expression] } : {}),
  goal: item.goal,
  source_page_ids: [pageId],
  origin: 'source',
  review_status: 'verified',
  version: 1,
  source_evidence: item.evidence,
  confidence: 1,
}));

const tasks = [
  { id: 'DEMO-TASK-APPLE', skill_ids: ['DEMO-SKILL-APPLE'], prompt: 'What fruit can be red or green and grows on a tree?', parent_instruction: '直接读英文问题，先让孩子独立回答；不要展示目标单词。', expected_answers: ['apple'], hint_levels: ['It starts with /æ/.'], scenario: '用英文回答常见水果问题' },
  { id: 'DEMO-TASK-BOOK', skill_ids: ['DEMO-SKILL-BOOK'], prompt: 'What do you open and read when you want a story?', parent_instruction: '直接读英文问题，先让孩子独立回答；不要展示目标单词。', expected_answers: ['book'], hint_levels: ['It starts with /b/.'], scenario: '用英文回答常见物品问题' },
  { id: 'DEMO-TASK-WATER', skill_ids: ['DEMO-SKILL-WATER'], prompt: 'What do you drink when you are thirsty?', parent_instruction: '直接读英文问题，先让孩子独立回答；不要展示目标单词。', expected_answers: ['water'], hint_levels: ['It starts with /w/.'], scenario: '用英文回答常见饮品问题' },
  { id: 'DEMO-TASK-REQUEST', skill_ids: ['DEMO-SKILL-REQUEST'], prompt: 'You are thirsty after playing outside. Ask politely for a drink.', parent_instruction: '只读英文情境，不先念目标句；需要时逐级提示。', expected_answers: ['Can I have some water, please?'], hint_levels: ['Can I…', 'Can I have some…'], scenario: '户外活动后礼貌请求喝水' },
].map((item) => ({ ...item, estimated_seconds: 45, origin: 'derived', source_page_ids: [pageId], version: 1 }));

const snapshot = {
  schema_version: '1.0.0',
  materials: [{ id: materialId, title: '互动演示素材', level: '公开示例', edition: '合成内容 v1', publisher: 'Andy English Companion Demo', created_at: createdAt, source_kind: 'manual', review_status: 'verified' }],
  assets: [{ id: assetId, material_id: materialId, filename: 'demo-source.svg', file_hash: sourceHash, mime: 'image/svg+xml', storage_ref: previewRef, uploaded_at: createdAt }],
  pages: [{ id: pageId, asset_id: assetId, pdf_page_index: null, printed_page_number: null, unit_id: unitId, printed_page_status: 'not_present', ocr_printed_page_candidate: null, printed_page_evidence: '公开合成卡片没有教材印刷页码。', page_preview_ref: previewRef, ocr_status: 'not_needed', source_confidence: 1, content_hash: sourceHash, extracted_text: 'apple | book | water | Can I have some water, please?' }],
  units: [{ id: unitId, material_id: materialId, title: '日常小练习', printed_page_range: null, source_page_ids: [pageId], review_status: 'verified', order: 0, reference_outline: { vocabulary: ['apple', 'book', 'water'], expressions: ['Can I have some water, please?'], goal: '用常见词汇完成一个礼貌请求。', source_ref: '公开合成演示卡片；不对应任何商业教材。' } }],
  sections: [{ id: sectionId, unit_id: unitId, material_id: materialId, title: '常见词汇与礼貌请求', printed_page_range: null, source_page_ids: [pageId], section_type: 'synthetic_demo', review_status: 'verified' }],
  skills,
  tasks,
  lessons: [],
  sessions: [],
  observations: [],
  notes: [],
  audio: [],
  jobs: [],
  audit: [{ id: 'public-demo-v1', timestamp: createdAt, action: 'synthetic_public_demo_created', entity_id: materialId, detail: 'Synthetic public demonstration data only; contains no textbook pages, lesson history, observations, notes, or audio.' }],
};

validateDemoSeed(snapshot);
await mkdir(path.join(targetRoot, 'schemas'), { recursive: true });
await mkdir(path.join(targetRoot, 'public', 'demo'), { recursive: true });
const json = `${JSON.stringify(snapshot, null, 2)}\n`;
await writeFile(path.join(targetRoot, 'schemas', 'initial-reference.json'), json, 'utf8');
await writeFile(path.join(targetRoot, 'public', 'seed.json'), json, 'utf8');
await writeFile(path.join(targetRoot, 'public', 'demo', 'demo-source.svg'), demoSvg, 'utf8');

function validateDemoSeed(value) {
  const collections = ['materials', 'assets', 'pages', 'units', 'sections', 'skills', 'tasks', 'lessons', 'sessions', 'observations', 'notes', 'audio', 'jobs', 'audit'];
  if (value.schema_version !== '1.0.0') throw new Error('Demo seed schema version is invalid.');
  for (const name of collections) if (!Array.isArray(value[name])) throw new Error(`Demo seed collection is missing: ${name}`);
  const ids = new Set();
  for (const name of collections) for (const row of value[name]) {
    if (!row.id || ids.has(row.id)) throw new Error(`Demo seed has an invalid or duplicate id: ${row.id}`);
    ids.add(row.id);
  }
  const has = (name, id) => value[name].some((row) => row.id === id);
  for (const asset of value.assets) if (!has('materials', asset.material_id)) throw new Error(`Broken demo asset reference: ${asset.id}`);
  for (const page of value.pages) if (!has('assets', page.asset_id) || (page.unit_id && !has('units', page.unit_id))) throw new Error(`Broken demo page reference: ${page.id}`);
  for (const unit of value.units) if (!has('materials', unit.material_id) || unit.source_page_ids.some((id) => !has('pages', id))) throw new Error(`Broken demo unit reference: ${unit.id}`);
  for (const section of value.sections) if (!has('units', section.unit_id) || !has('materials', section.material_id) || section.source_page_ids.some((id) => !has('pages', id))) throw new Error(`Broken demo section reference: ${section.id}`);
  for (const skill of value.skills) if (!has('units', skill.unit_id) || skill.source_page_ids.some((id) => !has('pages', id))) throw new Error(`Broken demo skill reference: ${skill.id}`);
  for (const task of value.tasks) if (task.skill_ids.some((id) => !has('skills', id)) || task.source_page_ids.some((id) => !has('pages', id))) throw new Error(`Broken demo task reference: ${task.id}`);
  if (value.lessons.length || value.sessions.length || value.observations.length || value.notes.length || value.audio.length) throw new Error('Public demo seed must not contain learning or personal history.');
  const serialized = JSON.stringify(value).toLowerCase();
  for (const forbidden of ['power up', 'pupil_s book', 'parent_report', 'local-file:', 'private-file:']) {
    if (serialized.includes(forbidden)) throw new Error(`Public demo seed contains forbidden private/source marker: ${forbidden}`);
  }
}

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
