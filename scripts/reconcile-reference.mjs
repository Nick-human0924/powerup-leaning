import fs from 'node:fs';

const schemaPath = 'schemas/initial-reference.json';
const publicPath = 'public/seed.json';
const extracted = JSON.parse(fs.readFileSync('imports/reference-extracted.json', 'utf8'));
const seed = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const materialId = seed.materials.find((item) => item.title === extracted.book.title && item.edition === extracted.book.edition)?.id;
if (!materialId) throw new Error('Could not match the V3 reference outline to a seed material');

const outlines = [{
  id: 'PU1-U0-HELLO', order: 0, title: 'Hello', range: null,
  goal: '姓名、年龄、数字和颜色（主提示词概览，待原页核对）', vocabulary: [], expressions: [],
  source_ref: 'Codex_Andy_English_Companion_Master_Prompt_V1.md#10 · 概览待原页核对',
}, ...extracted.units.map((unit) => ({
  id: `PU1-U${unit.id}`, order: unit.id, title: unit.title, range: unit.range,
  goal: unit.focus, vocabulary: unit.vocab, expressions: unit.grammar,
  source_ref: 'reference/andy_review_demo_v3.html#UNITS · V3参考待原页核对',
}))];

for (const outline of outlines) {
  const reference_outline = { vocabulary: outline.vocabulary, expressions: outline.expressions, goal: outline.goal, source_ref: outline.source_ref };
  const existing = seed.units.find((unit) => unit.id === outline.id);
  if (existing) Object.assign(existing, { order: outline.order, reference_outline });
  else seed.units.push({ id: outline.id, material_id: materialId, title: outline.title, printed_page_range: outline.range, source_page_ids: [], review_status: 'pending', order: outline.order, reference_outline });
}
// Keep the long-standing verified Unit 4 row first for backward compatibility.
// Consumers must use the explicit `order` field; array order is not curriculum order.
seed.units.sort((a, b) => (a.id === 'PU1-U4' ? -1 : b.id === 'PU1-U4' ? 1 : (a.order ?? 999) - (b.order ?? 999) || a.title.localeCompare(b.title, 'en')));
if (!seed.audit.some((entry) => entry.id === 'catalog-v2')) seed.audit.push({
  id: 'catalog-v2', timestamp: '2026-10-14T12:00:00.000Z', action: 'reference_catalog_revision', entity_id: materialId,
  detail: '恢复 Hello 与 Unit 1–7 的 V3/主提示词参考目录；除已核验 Unit 4 页外，均为待原页核对的参考纲要，不代表 PDF 已解析、实际上过或已经掌握。',
});

const output = `${JSON.stringify(seed, null, 2)}\n`;
fs.writeFileSync(schemaPath, output);
fs.writeFileSync(publicPath, output);
console.log(`Reconciled ${outlines.length} ordered reference units without claiming PDF ingestion.`);
