import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll } from '../src/lib/db';
import { mastery, recordObservation } from '../src/lib/domain';
import { inspectFiles, publishImport, stableId } from '../src/lib/ingestion';
import { createSeedSnapshot } from '../src/lib/seed';
import { validateReferences, type ImportJob, type SourceAsset, type SourcePage } from '../src/lib/schema';

beforeEach(async () => clearAll());

type Entry = { type: 'vocabulary' | 'target_expression'; expression: string; meaning: string; page_id: string; evidence: string };
function inputFor(snapshot = createSeedSnapshot(), expression = 'Where is the kite?', printedPage: number | null = 91) {
  const assetId = `asset-simulated-${expression.replace(/\W/g, '')}`;
  const asset: SourceAsset = { id: assetId, material_id: 'pending', filename: 'simulated-unit-page.png', file_hash: `hash-${assetId}`, mime: 'image/png', storage_ref: assetId, uploaded_at: '2026-10-14T08:00:00.000Z' };
  const page: SourcePage = { id: `page-${assetId}`, asset_id: assetId, pdf_page_index: null, printed_page_number: printedPage, page_preview_ref: assetId, ocr_status: 'manual_required', source_confidence: 0, content_hash: `pixels-${assetId}`, extracted_text: '' };
  const job: ImportJob = { id: `job-${assetId}`, asset_ids: [assetId], job_type: 'material', status: 'manual_review', progress: 1, errors: [], created_candidate_ids: [page.id], created_at: '2026-10-14T08:00:00.000Z' };
  return { asset, page, job, publish: (entries: Entry[] = [{ type: 'target_expression', expression, meaning: '询问物品在哪里', page_id: page.id, evidence: 'Where is the kite? It is under the chair.' }]) => publishImport(snapshot, { material: { title: 'Power Up 1', level: '1', edition: 'Second Edition' }, unit_title: 'Simulated Unit 8', section_type: 'Language Practice', pages: [page], assets: [asset], jobs: [job], entries }) };
}

describe('incremental manual material publishing', () => {
  it('keeps an unreadable PDF in a failed job instead of reporting a successful import', async () => {
    const file = Object.assign(new Blob(['this is not a PDF'], { type: 'application/pdf' }), { name: 'broken.pdf' }) as File;
    const result = await inspectFiles([file], createSeedSnapshot(), () => {});
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].status).toBe('failed');
    expect(result.jobs[0].errors.length).toBeGreaterThan(0);
    expect(result.assets).toHaveLength(0);
    expect(result.pages).toHaveLength(0);
  });

  it('publishes a simulated new page into schema-valid skills and generated not-tested tasks while retaining evidence', () => {
    const snapshot = createSeedSnapshot();
    recordObservation(snapshot, { skill_id: 'PU1-U4-REQUEST', outcome: 'prompted', evidence: 'water after a hint', source: 'parent_report', prompt_shown: true, answer_revealed: false, confidence: 1, verified_by_parent: true, timestamp: '2026-10-13T08:00:00.000Z' });
    snapshot.notes.push({ id: 'keep-raw-note', raw_text: 'banana 完全不用提示', transcription_status: 'complete', consent_status: 'not_requested', linked_observation_ids: [], created_at: '2026-10-13T08:00:00.000Z' });
    const originalObservation = structuredClone(snapshot.observations);
    const originalTaskCount = snapshot.tasks.length;
    const created = inputFor(snapshot);
    created.publish();
    validateReferences(snapshot);
    const skill = snapshot.skills.find((item) => item.canonical_expression === 'Where is the kite?');
    expect(skill).toMatchObject({ origin: 'source', review_status: 'verified', version: 1, source_page_ids: [created.page.id] });
    expect(snapshot.tasks.length).toBeGreaterThan(originalTaskCount);
    expect(snapshot.tasks.filter((task) => task.skill_ids.includes(skill!.id)).length).toBeGreaterThan(0);
    expect(mastery(skill!.id, snapshot).status).toBe('not_tested');
    expect(snapshot.observations).toEqual(originalObservation);
    expect(snapshot.notes[0].raw_text).toBe('banana 完全不用提示');
  });

  it('deduplicates repeated page content, skills and lesson sessions across a repeat publish', () => {
    const snapshot = createSeedSnapshot(); const data = inputFor(snapshot);
    const lesson = { actual_date: undefined, duration_minutes: 25, notes: 'class date unknown' };
    const publish = () => publishImport(snapshot, { material: { title: 'Power Up 1', level: '1', edition: 'Second Edition' }, unit_title: 'Simulated Unit 8', section_type: 'Language Practice', pages: [data.page], assets: [data.asset], jobs: [data.job], entries: [{ type: 'target_expression', expression: 'Where is the kite?', meaning: '询问物品在哪里', page_id: data.page.id, evidence: 'Where is the kite?' }], lesson });
    publish();
    const counts = { assets: snapshot.assets.length, pages: snapshot.pages.length, skills: snapshot.skills.length, tasks: snapshot.tasks.length, lessons: snapshot.lessons.length, observations: snapshot.observations.length };
    publish();
    expect({ assets: snapshot.assets.length, pages: snapshot.pages.length, skills: snapshot.skills.length, tasks: snapshot.tasks.length, lessons: snapshot.lessons.length, observations: snapshot.observations.length }).toEqual(counts);
    expect(snapshot.lessons.at(-1)).toMatchObject({ date_known: false, actual_date: undefined });
    validateReferences(snapshot);
  });

  it('reuses exact page pixels across another asset and version-audits changed skill content', () => {
    const snapshot = createSeedSnapshot(); const first = inputFor(snapshot);
    first.publish();
    const oldSkill = snapshot.skills.find((item) => item.canonical_expression === 'Where is the kite?')!;
    const second = inputFor(snapshot, 'Where is the kite?', 92);
    second.asset.id = 'asset-simulated-second-file'; second.asset.storage_ref = second.asset.id; second.asset.file_hash = 'hash-second-simulated-file'; second.page.id = 'page-second-simulated-file'; second.page.asset_id = second.asset.id;
    second.page.content_hash = first.page.content_hash;
    second.publish([{ type: 'target_expression', expression: 'Where is the kite?', meaning: '询问风筝的位置（修订）', page_id: second.page.id, evidence: 'Where is the kite? revised' }]);
    expect(snapshot.pages.filter((page) => page.content_hash === first.page.content_hash)).toHaveLength(1);
    expect(snapshot.skills.find((item) => item.id === oldSkill.id)).toMatchObject({ version: 2, goal: '询问风筝的位置（修订）' });
    expect(snapshot.audit.some((row) => row.action === 'skill_version' && row.entity_id === oldSkill.id)).toBe(true);
    const revisedTasks = snapshot.tasks.filter((task) => task.skill_ids.includes(oldSkill.id) && task.version === 2);
    expect(revisedTasks.length).toBeGreaterThan(0);
    expect(revisedTasks[0].prompt).toContain('询问风筝的位置（修订）');
    expect(snapshot.audit.some((row) => row.action === 'source_page_correction')).toBe(true);
    expect(snapshot.assets.filter((asset) => asset.filename === 'simulated-unit-page.png')).toHaveLength(2);
    validateReferences(snapshot);
  });

  it('keeps editions distinct and rejects assigning one file hash to conflicting editions', () => {
    const snapshot = createSeedSnapshot(); const first = inputFor(snapshot); first.publish();
    const other = inputFor(snapshot, 'Where are the balls?');
    expect(() => publishImport(snapshot, { material: { title: 'Power Up 1', level: '1', edition: 'First Edition' }, unit_title: 'Simulated Unit 8', section_type: 'Language Practice', pages: [other.page], assets: [other.asset], jobs: [other.job], entries: [{ type: 'target_expression', expression: 'Where are the balls?', meaning: '询问球的位置', page_id: other.page.id, evidence: 'Where are the balls?' }] })).not.toThrow();
    expect(snapshot.materials.filter((material) => material.title === 'Power Up 1')).toHaveLength(2);
    const conflict = inputFor(snapshot, 'Where are the balls?'); conflict.asset.file_hash = snapshot.assets.find((asset) => asset.filename === 'simulated-unit-page.png')!.file_hash;
    expect(() => publishImport(snapshot, { material: { title: 'Power Up 1', level: '1', edition: 'First Edition' }, unit_title: 'Simulated Unit 8', section_type: 'Language Practice', pages: [conflict.page], assets: [conflict.asset], jobs: [conflict.job], entries: [{ type: 'target_expression', expression: 'Where are the balls?', meaning: '询问球的位置', page_id: conflict.page.id, evidence: 'Where are the balls?' }] })).toThrow(/another textbook edition|另一教材版本/);
  });

  it('rejects entries without a page in the staged import and does not mutate the snapshot', () => {
    const snapshot = createSeedSnapshot(); const before = structuredClone(snapshot); const data = inputFor(snapshot);
    expect(() => data.publish([{ type: 'vocabulary', expression: 'kite', meaning: '风筝', page_id: 'missing-page', evidence: 'kite' }])).toThrow(/有效来源页面/);
    expect(snapshot).toEqual(before);
  });

  it('uses deterministic stable identifiers for equivalent normalized expressions', () => {
    expect(stableId('skill', 'Power Up 1', 'Unit 8', 'target_expression', '  Where   is the KITE? ')).toBe(stableId('skill', 'power up 1', 'unit 8', 'target_expression', 'where is the kite?'));
  });
});
