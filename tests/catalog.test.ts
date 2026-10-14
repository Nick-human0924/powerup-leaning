import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it, vi } from 'vitest';
import { CATALOG_REVISION_ID, TEXTBOOK_REVISION_ID, isCatalogCurrent, isTextbookCurrent, reconcileSeed, sortUnits } from '../src/lib/catalog';
import { createSeedSnapshot } from '../src/lib/seed';
import type { Snapshot } from '../src/lib/schema';

function oldUnit4Snapshot(): Snapshot {
  const snapshot = createSeedSnapshot();
  snapshot.units = snapshot.units.filter((unit) => unit.id === 'PU1-U4').map((unit) => ({ ...unit, order: undefined, reference_outline: undefined }));
  snapshot.pages = snapshot.pages.map((page) => page.unit_id && page.unit_id !== 'PU1-U4' ? ({ ...page, unit_id: undefined }) : page);
  snapshot.sections = snapshot.sections.filter((section) => section.unit_id === 'PU1-U4');
  snapshot.skills = snapshot.skills.filter((skill) => skill.unit_id === 'PU1-U4' && ['PU1-U4-VOCAB-BANANA', 'PU1-U4-VOCAB-BREAD', 'PU1-U4-LIKE-RESP', 'PU1-U4-REQUEST', 'PU1-U4-OFFER-RESP'].includes(skill.id));
  const skillIds = new Set(snapshot.skills.map((skill) => skill.id));
  snapshot.tasks = snapshot.tasks.filter((task) => task.skill_ids.every((id) => skillIds.has(id))).slice(0, 3);
  snapshot.audit = snapshot.audit.filter((entry) => entry.id !== CATALOG_REVISION_ID && entry.id !== TEXTBOOK_REVISION_ID);
  snapshot.observations.push({ id: 'history-observation', skill_id: 'PU1-U4-REQUEST', outcome: 'prompted', evidence: '保留这条历史', source: 'parent_report', prompt_shown: true, answer_revealed: false, confidence: 1, verified_by_parent: true, timestamp: '2026-10-01T08:00:00.000Z' });
  snapshot.notes.push({ id: 'history-note', raw_text: '原始家长反馈', transcription_status: 'not_requested', consent_status: 'not_requested', linked_observation_ids: ['history-observation'], created_at: '2026-10-01T08:00:00.000Z' });
  snapshot.lessons.push({ id: 'history-lesson', actual_date: '2026-09-30', date_known: true, duration_minutes: 25, material_id: 'PU1-SE-BOOK', source_page_ids: [snapshot.skills.find((skill) => skill.id === 'PU1-U4-REQUEST')!.source_page_ids[0]], skill_ids: ['PU1-U4-REQUEST'], notes: '真实旧课次', created_at: '2026-09-30T08:00:00.000Z' });
  const edited = snapshot.skills.find((skill) => skill.id === 'PU1-U4-REQUEST')!;
  edited.version = 2;
  edited.goal = '家长修改后的目标，不能被种子覆盖';
  return snapshot;
}

describe('reference catalog reconciliation', () => {
  it('upgrades the old Unit 4 seed additively, in natural order, without touching histories', () => {
    const old = oldUnit4Snapshot();
    const incoming = createSeedSnapshot();
    const histories = JSON.stringify({ observations: old.observations, notes: old.notes, lessons: old.lessons });
    const upgraded = reconcileSeed(old, incoming);
    expect(upgraded.units.map((unit) => unit.id)).toEqual(['PU1-U0-HELLO', 'PU1-U1', 'PU1-U2', 'PU1-U3', 'PU1-U4', 'PU1-U5', 'PU1-U6', 'PU1-U7']);
    expect(upgraded.units.find((unit) => unit.id === 'PU1-U3')?.review_status).toBe('verified');
    expect(upgraded.units.find((unit) => unit.id === 'PU1-U3')?.reference_outline?.vocabulary).toContain('cow');
    expect(upgraded.skills).toHaveLength(incoming.skills.length);
    expect(upgraded.tasks).toHaveLength(incoming.tasks.length);
    expect(upgraded.skills.find((skill) => skill.id === 'PU1-U4-REQUEST')).toMatchObject({ version: 2, goal: '家长修改后的目标，不能被种子覆盖' });
    expect(JSON.stringify({ observations: upgraded.observations, notes: upgraded.notes, lessons: upgraded.lessons })).toBe(histories);
  });

  it('is idempotent after catalog-v2 and sorts later imported units naturally after known units', () => {
    const once = reconcileSeed(oldUnit4Snapshot(), createSeedSnapshot());
    const twice = reconcileSeed(once, createSeedSnapshot());
    expect(twice).toEqual(once);
    expect(twice.audit.filter((entry) => entry.id === CATALOG_REVISION_ID)).toHaveLength(1);
    const imported = { ...twice.units[0], id: 'custom-unit', title: 'Later import', order: undefined };
    expect(sortUnits([...twice.units, imported]).at(-1)?.id).toBe('custom-unit');
  });

  it('repairs a catalog-v2 snapshot whose older schema stripped order and outlines', () => {
    const stripped = createSeedSnapshot();
    stripped.units = stripped.units.map((unit) => ({ ...unit, order: undefined, reference_outline: undefined }));
    expect(stripped.audit.some((entry) => entry.id === CATALOG_REVISION_ID)).toBe(true);
    expect(isCatalogCurrent(stripped)).toBe(false);
    const repaired = reconcileSeed(stripped, createSeedSnapshot());
    expect(isCatalogCurrent(repaired)).toBe(true);
    expect(repaired.units.find((unit) => unit.id === 'PU1-U3')?.reference_outline?.expressions).toContain('He’s a nice cat.');
    expect(repaired.audit.filter((entry) => entry.id === CATALOG_REVISION_ID)).toHaveLength(1);
    expect(isTextbookCurrent(repaired)).toBe(true);
  });

  it('re-reads the latest IndexedDB snapshot after awaiting the catalog response', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('andy-english-companion');
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
    });
    const setup = new Dexie('andy-english-companion');
    setup.version(1).stores({ snapshots: '&key', blobs: '&id' });
    await setup.table('snapshots').put({ key: 'current', value: oldUnit4Snapshot() });
    setup.close();
    let release!: (value: Response) => void;
    const response = new Promise<Response>((resolve) => { release = resolve; });
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(() => response));
    const { loadSnapshot } = await import('../src/lib/db');
    const loading = loadSnapshot();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    const writer = new Dexie('andy-english-companion');
    writer.version(1).stores({ snapshots: '&key', blobs: '&id' });
    const row = await writer.table('snapshots').get('current');
    row.value.observations.push({ id: 'concurrent-observation', skill_id: 'PU1-U4-REQUEST', outcome: 'miss', evidence: '另一个窗口刚写入', source: 'parent_report', prompt_shown: false, answer_revealed: false, confidence: 1, verified_by_parent: true, timestamp: '2026-10-14T10:00:00.000Z' });
    await writer.table('snapshots').put(row);
    writer.close();
    release({ ok: true, status: 200, json: async () => createSeedSnapshot() } as Response);
    const upgraded = await loading;
    expect(upgraded.observations.some((item) => item.id === 'concurrent-observation')).toBe(true);
    expect(isCatalogCurrent(upgraded)).toBe(true);
  });

  it('keeps an existing local snapshot usable when the catalog refresh is offline', async () => {
    const rawDb = new Dexie('andy-english-companion');
    rawDb.version(1).stores({ snapshots: '&key', blobs: '&id' });
    const old = oldUnit4Snapshot();
    await rawDb.table('snapshots').put({ key: 'current', value: old });
    rawDb.close();
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const { loadSnapshot } = await import('../src/lib/db');
    const loaded = await loadSnapshot();
    expect(loaded.observations).toEqual(old.observations);
    expect(loaded.units.map((unit) => unit.id)).toEqual(['PU1-U4']);
    expect(loaded.audit.some((entry) => entry.id === CATALOG_REVISION_ID)).toBe(false);
  });
});
