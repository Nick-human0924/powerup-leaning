import { describe, expect, it } from 'vitest';
import { isTextbookCurrent, reconcileSeed, TEXTBOOK_REVISION_ID } from '../src/lib/catalog';
import { createSeedSnapshot } from '../src/lib/seed';
import { validateReferences } from '../src/lib/schema';

describe('actual Power Up 1 textbook catalog', () => {
  it('keeps every local source traceable and maps printed p4–89 to real previews', () => {
    const snapshot = validateReferences(createSeedSnapshot());
    expect(snapshot.assets).toHaveLength(9);
    expect(new Set(snapshot.assets.map((asset) => asset.file_hash)).size).toBe(9);
    expect(snapshot.assets.every((asset) => /^[a-f0-9]{64}$/.test(asset.file_hash))).toBe(true);
    expect(snapshot.pages).toHaveLength(90);
    for (const asset of snapshot.assets) {
      expect(snapshot.pages.filter((page) => page.asset_id === asset.id).map((page) => page.pdf_page_index)).toEqual([1,2,3,4,5,6,7,8,9,10]);
    }
    expect(snapshot.pages.filter((page) => page.printed_page_number && page.printed_page_number >= 4).map((page) => page.printed_page_number)).toEqual(Array.from({ length: 86 }, (_, index) => index + 4));
    const p4 = snapshot.pages.find((page) => page.printed_page_number === 4)!;
    expect(p4).toMatchObject({ pdf_page_index: 5, printed_page_status: 'verified_visual', ocr_printed_page_candidate: 3, unit_id: 'PU1-U0-HELLO' });
    expect(p4.page_preview_ref).toMatch(/^\/textbook-pages\/.*\.jpg$/);
    expect(snapshot.pages.find((page) => page.printed_page_number === 9)).toMatchObject({ pdf_page_index: 10, printed_page_status: 'verified_visual', ocr_printed_page_candidate: null });
  });

  it('publishes all eight actual units, sections, vocabulary, expressions, and answer-hidden tasks without inventing lessons', () => {
    const snapshot = createSeedSnapshot();
    expect(isTextbookCurrent(snapshot)).toBe(true);
    expect(snapshot.units.map((unit) => unit.id)).toEqual(['PU1-U0-HELLO','PU1-U1','PU1-U2','PU1-U3','PU1-U4','PU1-U5','PU1-U6','PU1-U7']);
    expect(snapshot.units.every((unit) => unit.review_status === 'verified' && unit.source_page_ids.length > 0)).toBe(true);
    expect(snapshot.sections).toHaveLength(82);
    expect(snapshot.skills).toHaveLength(196);
    expect(snapshot.tasks).toHaveLength(197);
    expect(snapshot.lessons).toEqual([]);
    expect(snapshot.observations).toEqual([]);
    const coreWords = (unitId: string, page: number) => snapshot.skills.filter((skill) => skill.unit_id === unitId && skill.type === 'vocabulary' && skill.source_evidence.startsWith(`Printed p.${page},`)).map((skill) => skill.canonical_expression);
    expect(coreWords('PU1-U1', 7)).toEqual(expect.arrayContaining(['classroom','rubber','pencil','teacher','bag','crayon','desk','chair','book','pen','pencil case']));
    expect(coreWords('PU1-U6', 69)).toEqual(expect.arrayContaining(['tree','train','bus stop','bus','shop','garden','lorry','car','flower','park','motorbike']));
    expect(snapshot.skills.find((skill) => skill.id === 'PU1-U4-REQUEST')?.canonical_expression).toBe('Can I have some chocolate, please?');
    expect(snapshot.tasks.find((task) => task.id === 'task-PU1-U4-REQUEST-WATER-EXT')).toMatchObject({ origin: 'derived', expected_answers: ['Can I have some water, please?'] });
    expect(snapshot.tasks.every((task) => task.parent_instruction.includes('不展示') || task.parent_instruction.includes('不直接念出'))).toBe(true);
  });

  it('repairs a marker-only old client snapshot additively and preserves history and parent edits', () => {
    const incoming = createSeedSnapshot();
    const old = createSeedSnapshot();
    old.assets = [];
    old.pages = [];
    old.sections = [];
    old.jobs = [];
    old.units = old.units.map((unit) => ({ ...unit, source_page_ids: [], review_status: 'pending' as const }));
    old.tasks = [];
    old.skills = old.skills.filter((skill) => skill.id === 'PU1-U4-REQUEST').map((skill) => ({ ...skill, source_page_ids: [], version: 2, goal: '家长自己改过的目标' }));
    old.observations.push({ id: 'keep-observation', skill_id: 'PU1-U4-REQUEST', outcome: 'miss', evidence: '真实历史', source: 'parent_report', prompt_shown: false, answer_revealed: false, confidence: 1, verified_by_parent: true, timestamp: '2026-10-13T08:00:00.000Z' });
    expect(old.audit.some((entry) => entry.id === TEXTBOOK_REVISION_ID)).toBe(true);
    expect(isTextbookCurrent(old)).toBe(false);
    const history = JSON.stringify(old.observations);
    const once = reconcileSeed(old, incoming);
    const twice = reconcileSeed(once, incoming);
    expect(isTextbookCurrent(once)).toBe(true);
    expect(twice).toEqual(once);
    expect(JSON.stringify(once.observations)).toBe(history);
    expect(once.skills.find((skill) => skill.id === 'PU1-U4-REQUEST')).toMatchObject({ version: 2, goal: '家长自己改过的目标', source_page_ids: [] });
    expect(once.audit.filter((entry) => entry.id === TEXTBOOK_REVISION_ID)).toHaveLength(1);
  });
});
