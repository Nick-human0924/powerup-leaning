import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll, getBlob, loadSnapshot, mergeBackup, mutateSnapshot, saveBlob } from '../src/lib/db';
import { generateTasks, mastery, recordObservation } from '../src/lib/domain';
import { proposeFeedback } from '../src/lib/feedback';
import { recommend } from '../src/lib/recommendations';
import { createSeedSnapshot } from '../src/lib/seed';
import { Observation, validateReferences } from '../src/lib/schema';

const responseFor = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 404, json: async () => body }) as Response;

beforeEach(async () => {
  await clearAll();
  vi.stubGlobal('fetch', vi.fn(async () => responseFor(createSeedSnapshot())));
});

describe('schema and domain evidence rules', () => {
  it('validates the full seed and rejects broken cross references', () => {
    expect(validateReferences(createSeedSnapshot()).skills.length).toBeGreaterThanOrEqual(5);
    const broken = createSeedSnapshot();
    broken.tasks[0].skill_ids = ['missing-skill'];
    expect(() => validateReferences(broken)).toThrow(/Broken reference/);
  });

  it('appends observations and never records hinted or revealed work as independent', () => {
    const snapshot = createSeedSnapshot();
    const first = recordObservation(snapshot, { skill_id: 'PU1-U4-REQUEST', outcome: 'independent', evidence: 'Answered after hint', source: 'parent_report', prompt_shown: true, answer_revealed: false, confidence: 1, verified_by_parent: true, timestamp: '2026-10-10T08:00:00.000Z' });
    const second = recordObservation(snapshot, { skill_id: 'PU1-U4-REQUEST', outcome: 'independent', evidence: 'Answered after seeing answer', source: 'parent_report', prompt_shown: false, answer_revealed: true, confidence: 1, verified_by_parent: true, timestamp: '2026-10-11T08:00:00.000Z' });
    expect([first.outcome, second.outcome]).toEqual(['prompted', 'prompted']);
    expect(snapshot.observations).toHaveLength(2);
    expect(() => Observation.parse({ ...first, outcome: 'independent' })).toThrow(/Independent evidence/);
    expect(() => Observation.parse({ ...first, prompt_shown: false, outcome: 'independent', verified_by_parent: false })).toThrow(/Unverified independent/);
    const suggestion = recordObservation(snapshot, { skill_id: 'PU1-U4-REQUEST', outcome: 'independent', evidence: 'Machine suggestion', source: 'parent_report', prompt_shown: false, answer_revealed: false, confidence: 0.5, verified_by_parent: false });
    expect(suggestion.outcome).toBe('unverified');
  });

  it('keeps unobserved distinct from miss and requires independent evidence on different local dates', () => {
    const snapshot = createSeedSnapshot();
    expect(mastery('PU1-U4-REQUEST', snapshot).status).toBe('not_tested');
    for (const timestamp of ['2026-10-10T08:00:00.000Z', '2026-10-10T14:00:00.000Z']) recordObservation(snapshot, { skill_id: 'PU1-U4-REQUEST', outcome: 'independent', evidence: 'Independent', source: 'parent_report', prompt_shown: false, answer_revealed: false, confidence: 1, verified_by_parent: true, timestamp });
    expect(mastery('PU1-U4-REQUEST', snapshot).status).toBe('emerging');
    recordObservation(snapshot, { skill_id: 'PU1-U4-REQUEST', outcome: 'independent', evidence: 'Independent again', source: 'parent_report', prompt_shown: false, answer_revealed: false, confidence: 1, verified_by_parent: true, timestamp: '2026-10-11T08:00:00.000Z' });
    expect(mastery('PU1-U4-REQUEST', snapshot).status).toBe('stable');
    recordObservation(snapshot, { skill_id: 'PU1-U4-REQUEST', outcome: 'miss', evidence: 'Could not answer', source: 'parent_report', prompt_shown: false, answer_revealed: false, confidence: 1, verified_by_parent: true, timestamp: '2026-10-12T08:00:00.000Z' });
    expect(mastery('PU1-U4-REQUEST', snapshot).status).toBe('needs_practice');
    recordObservation(snapshot, { skill_id: 'PU1-U4-REQUEST', outcome: 'independent', evidence: 'Recovery attempt one', source: 'parent_report', prompt_shown: false, answer_revealed: false, confidence: 1, verified_by_parent: true, timestamp: '2026-10-13T08:00:00.000Z' });
    expect(mastery('PU1-U4-REQUEST', snapshot).status).toBe('emerging');
    recordObservation(snapshot, { skill_id: 'PU1-U4-REQUEST', outcome: 'independent', evidence: 'Recovery attempt two', source: 'parent_report', prompt_shown: false, answer_revealed: false, confidence: 1, verified_by_parent: true, timestamp: '2026-10-14T08:00:00.000Z' });
    expect(mastery('PU1-U4-REQUEST', snapshot).status).toBe('stable');
  });

  it('generates answer-hidden prompts and grammar-appropriate expected responses', () => {
    const snapshot = createSeedSnapshot();
    const vocabulary = generateTasks(snapshot.skills.find((skill) => skill.id === 'PU1-U4-VOCAB-BANANA')!)[0];
    expect(vocabulary.prompt).not.toContain('banana');
    expect(vocabulary.expected_answers).toEqual(['banana']);
    const like = generateTasks(snapshot.skills.find((skill) => skill.id === 'PU1-U4-LIKE-RESP')!)[0];
    expect(like.prompt).not.toContain('Do you like chocolate?');
    expect(like.expected_answers).toEqual(['Yes, I do.', 'No, I don’t.']);
    const offer = generateTasks(snapshot.skills.find((skill) => skill.id === 'PU1-U4-OFFER-RESP')!)[0];
    expect(offer.expected_answers).toEqual(['Yes, please.', 'No, thank you.']);
  });
});

describe('parent feedback proposals', () => {
  it('handles negative hint expressions and the required mixed-language sample', () => {
    const proposals = proposeFeedback('banana完全不用提醒，bread提示了才会，water那句话不会', createSeedSnapshot());
    expect(proposals.map(({ skill_id, outcome_suggestion }) => [skill_id, outcome_suggestion])).toEqual([
      ['PU1-U4-VOCAB-BANANA', 'independent'],
      ['PU1-U4-VOCAB-BREAD', 'prompted'],
      ['PU1-U4-REQUEST', 'miss'],
    ]);
  });

  it('marks every candidate unverified when a phrase matches multiple targets', () => {
    const snapshot = createSeedSnapshot();
    const banana = snapshot.skills.find((skill) => skill.id === 'PU1-U4-VOCAB-BANANA')!;
    snapshot.skills.push({ ...banana, id: 'SECOND-BANANA', title: 'banana recognition' });
    const proposals = proposeFeedback('banana会说', snapshot);
    expect(proposals).toHaveLength(2);
    expect(proposals.every((item) => item.outcome_suggestion === 'unverified')).toBe(true);
  });
});

describe('recommendations', () => {
  it('prioritizes recently taught untested skills and applies 1/3/7 day explanations', () => {
    const snapshot = createSeedSnapshot();
    snapshot.lessons.push({ id: 'lesson-1', actual_date: '2026-10-13', date_known: true, duration_minutes: 25, material_id: 'PU1-SE-BOOK', source_page_ids: ['PU1-P49'], skill_ids: ['PU1-U4-REQUEST'], notes: '', created_at: '2026-10-13T08:00:00.000Z' });
    expect(recommend(snapshot, 3, new Date('2026-10-14T08:00:00.000Z'))[0].skill.id).toBe('PU1-U4-REQUEST');
    recordObservation(snapshot, { skill_id: 'PU1-U4-REQUEST', outcome: 'miss', evidence: 'miss', source: 'parent_report', prompt_shown: false, answer_revealed: false, confidence: 1, verified_by_parent: true, timestamp: '2026-10-13T08:00:00.000Z' });
    expect(recommend(snapshot, 3, new Date('2026-10-14T09:00:00.000Z')).find((item) => item.skill.id === 'PU1-U4-REQUEST')?.reason).toContain('1 天');
  });
});

describe('IndexedDB persistence and backup safety', () => {
  it('fails visibly when the initial seed is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => responseFor({}, false)));
    await expect(loadSnapshot()).rejects.toThrow(/could not be loaded/);
  });

  it('serializes concurrent read-modify-write operations without dropping either change', async () => {
    await loadSnapshot();
    await Promise.all([
      mutateSnapshot((draft) => { draft.audit.push({ id: 'a', timestamp: '2026-10-14T01:00:00.000Z', action: 'one', entity_id: 'snapshot', detail: '' }); }),
      mutateSnapshot((draft) => { draft.audit.push({ id: 'b', timestamp: '2026-10-14T01:00:01.000Z', action: 'two', entity_id: 'snapshot', detail: '' }); }),
    ]);
    const auditIds = (await loadSnapshot()).audit.map((item) => item.id);
    expect(auditIds).toEqual(expect.arrayContaining(['a', 'b']));
    expect(auditIds.filter((id) => id === 'a' || id === 'b')).toHaveLength(2);
  });

  it('rolls back malformed backup and cross-reference mutations atomically', async () => {
    const before = await loadSnapshot();
    const malformed = createSeedSnapshot();
    malformed.observations.push({ id: 'bad', skill_id: 'missing', outcome: 'miss', evidence: '', source: 'parent_report', prompt_shown: false, answer_revealed: false, confidence: 1, verified_by_parent: true, timestamp: '2026-10-14T00:00:00.000Z' });
    await expect(mergeBackup(malformed)).rejects.toThrow(/Broken reference/);
    await expect(mutateSnapshot((draft) => { draft.tasks[0].skill_ids = ['missing']; })).rejects.toThrow(/Broken reference/);
    expect(await loadSnapshot()).toEqual(before);
  });

  it('migrates real V2/V3 fields idempotently and keeps raw notes and observations', async () => {
    const legacy = { schema_version: '0.3.0', lesson_links: [{ date: '2026-10-01', start: 45, end: 49, created_at: '2026-10-01T10:00:00.000Z' }], practice_sessions: [{ id: 'pr_1', mode: 'parent', started_at: '2026-10-02T10:00:00.000Z', completed_at: '2026-10-02T10:03:00.000Z', observations: [{ skill_id: 'PU1-U4-REQUEST', outcome: 'prompted', hint_was_shown: true, answer_revealed: false, comment: 'manual score' }] }], raw_parent_notes: [{ id: 'pn_1', created_at: '2026-10-03T10:00:00.000Z', source: 'parent_text_input', text: '原始家长反馈', observations: [] }] };
    const once = await mergeBackup(legacy);
    const twice = await mergeBackup(legacy);
    expect(twice.lessons).toHaveLength(once.lessons.length);
    expect(twice.sessions).toHaveLength(once.sessions.length);
    expect(twice.observations).toHaveLength(once.observations.length);
    expect(twice.notes.find((note) => note.raw_text === '原始家长反馈')).toBeTruthy();
    expect(twice.observations.find((item) => item.skill_id === 'PU1-U4-REQUEST')?.outcome).toBe('prompted');
  });

  it('preserves unknown legacy skill evidence and upgrades hinted independent results', async () => {
    const legacy = { schema_version: '0.2.0', lesson_links: [], practice_sessions: [{ id: 'unknowns', mode: 'parent', observations: [
      { skill_id: 'OLD-UNMAPPED-SKILL', target: '旧版自由表达', reference_expression: 'A legacy phrase', source_page: 88, outcome: 'independent', hint_was_shown: false, answer_revealed: false, comment: '原记录不能丢' },
      { skill_id: 'PU1-U4-REQUEST', outcome: 'independent', hint_was_shown: true, answer_revealed: false, comment: '提示后完成' },
    ] }], raw_parent_notes: [] };
    const migrated = await mergeBackup(legacy);
    const placeholder = migrated.skills.find((skill) => skill.id === 'OLD-UNMAPPED-SKILL');
    expect(placeholder).toMatchObject({ review_status: 'pending', goal: '原始未知知识点待核对', source_page_ids: [] });
    const unknown = migrated.observations.find((item) => item.skill_id === 'OLD-UNMAPPED-SKILL');
    expect(unknown).toMatchObject({ outcome: 'unverified', verified_by_parent: false, confidence: 0 });
    expect(unknown?.evidence).toContain('[旧结果:independent]');
    expect(migrated.observations.find((item) => item.skill_id === 'PU1-U4-REQUEST')?.outcome).toBe('prompted');
    expect(migrated.audit.some((entry) => entry.action === 'legacy_unknown_skill_preserved')).toBe(true);
    expect(migrated.audit.some((entry) => entry.action === 'legacy_unknown_date')).toBe(true);
  });

  it('stores blobs separately from snapshot JSON', async () => {
    await saveBlob('audio-1', new Blob(['private'], { type: 'audio/webm' }));
    expect(await (await getBlob('audio-1'))?.text()).toBe('private');
    expect(JSON.stringify(await loadSnapshot())).not.toContain('private');
  });
});
