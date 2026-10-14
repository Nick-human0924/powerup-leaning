import { createSeedSnapshot } from './seed';
import { snapshotSchema, validateReferences, type Observation, type Snapshot } from './schema';

const clone = <T>(value: T): T => structuredClone(value);
const asIso = (value: unknown, fallback: string) => {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return fallback;
};
const safeId = (prefix: string, value: unknown, index: number) => `${prefix}-${String(value ?? index).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)}`;

function legacyOutcome(value: unknown, promptShown = false, answerRevealed = false): Observation['outcome'] {
  if (value === 'skip' || value === 'not_tested') return 'not_tested';
  if (value === 'independent') return promptShown || answerRevealed ? 'prompted' : 'independent';
  if (value === 'prompted' || value === 'miss' || value === 'unverified') return value;
  return 'unverified';
}

export function migrateBackup(input: unknown, base: Snapshot = createSeedSnapshot()): Snapshot {
  if (typeof input !== 'object' || input === null) throw new Error('Backup must be an object');
  const raw = input as Record<string, unknown>;
  if (raw.schema_version === '1.0.0') return validateReferences(snapshotSchema.parse(raw));
  if (raw.schema_version !== '0.2.0' && raw.schema_version !== '0.3.0') throw new Error(`Unsupported backup schema: ${String(raw.schema_version)}`);
  if (!Array.isArray(raw.lesson_links) || !Array.isArray(raw.practice_sessions) || !Array.isArray(raw.raw_parent_notes)) throw new Error('Legacy backup is missing required arrays');

  const result = clone(validateReferences(base));
  const fallbackTime = '2000-01-01T00:00:00.000Z';
  const addAudit = (id: string, action: string, entity_id: string, detail: string, timestamp = fallbackTime) => {
    if (!result.audit.some((entry) => entry.id === id)) result.audit.push({ id, timestamp, action, entity_id, detail });
  };
  const timestampOrFallback = (value: unknown, fallback: string, entityId: string, field: string) => {
    if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
    addAudit(`legacy-unknown-date-${entityId}-${field}`, 'legacy_unknown_date', entityId, `旧版记录缺少有效 ${field}；使用 ${fallback} 作为未知日期占位，不能视为真实发生日期。`);
    return fallback;
  };
  const ensureLegacySkill = (requestedId: string, old: Record<string, unknown>, contextId: string) => {
    const existing = result.skills.find((skill) => skill.id === requestedId);
    if (existing) return { skillId: existing.id, wasUnknown: existing.unit_id === 'LEGACY-PENDING-UNIT' && existing.review_status === 'pending' };
    let material = result.materials[0];
    if (!material) {
      material = { id: 'LEGACY-PENDING-MATERIAL', title: '旧版未识别教材', level: '未知', edition: '未知', created_at: fallbackTime, source_kind: 'manual', review_status: 'pending' };
      result.materials.push(material);
    }
    const unitId = 'LEGACY-PENDING-UNIT';
    if (!result.units.some((unit) => unit.id === unitId)) result.units.push({ id: unitId, material_id: material.id, title: '旧版未知知识点（待核对）', printed_page_range: null, source_page_ids: [], review_status: 'pending' });
    const skillId = requestedId || safeId('legacy-unknown-skill', contextId, 0);
    const target = String(old.target ?? old.reference_expression ?? old.canonical_expression ?? skillId);
    const page = old.source_page == null ? '未知' : String(old.source_page);
    result.skills.push({ id: skillId, title: target, unit_id: unitId, type: 'other', canonical_expression: target === skillId ? undefined : target, goal: '原始未知知识点待核对', source_page_ids: [], origin: 'derived', review_status: 'pending', version: 1, source_evidence: `旧版记录迁移；原教材页 ${page}；没有可验证的原页图片。`, confidence: 0 });
    addAudit(`legacy-skill-map-${safeId('id', skillId, 0)}`, 'legacy_unknown_skill_preserved', skillId, `保留旧技能 ${skillId} 为待核对占位；未伪造教材来源。`);
    return { skillId, wasUnknown: true };
  };

  raw.lesson_links.forEach((entry, index) => {
    if (typeof entry !== 'object' || !entry) throw new Error(`Malformed lesson_links[${index}]`);
    const row = entry as Record<string, unknown>;
    if (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) throw new Error(`Malformed lesson date at index ${index}`);
    const start = Number(row.start), end = Number(row.end);
    if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) throw new Error(`Malformed lesson page range at index ${index}`);
    const source_page_ids = result.pages.filter((page) => page.printed_page_number !== null && page.printed_page_number >= start && page.printed_page_number <= end).map((page) => page.id);
    const id = safeId('legacy-lesson', `${row.date}-${start}-${end}`, index);
    if (!result.lessons.some((item) => item.id === id)) result.lessons.push({ id, actual_date: row.date, date_known: true, duration_minutes: 25, material_id: result.materials[0]?.id ?? '', source_page_ids, skill_ids: result.skills.filter((skill) => skill.source_page_ids.some((pageId) => source_page_ids.includes(pageId))).map((skill) => skill.id), notes: '从旧版家长手动页码关联迁移；不代表整页目标均已教授。', created_at: asIso(row.created_at, `${row.date}T00:00:00.000Z`) });
  });

  raw.practice_sessions.forEach((entry, sessionIndex) => {
    if (typeof entry !== 'object' || !entry) throw new Error(`Malformed practice_sessions[${sessionIndex}]`);
    const row = entry as Record<string, unknown>;
    if (!Array.isArray(row.observations)) throw new Error(`Legacy session ${sessionIndex} has no observations array`);
    const sessionId = safeId('legacy-session', row.id, sessionIndex);
    const startedKnown = typeof row.started_at === 'string' && !Number.isNaN(Date.parse(row.started_at));
    const endedKnown = typeof row.completed_at === 'string' && !Number.isNaN(Date.parse(row.completed_at));
    const started = timestampOrFallback(row.started_at, fallbackTime, sessionId, 'started_at');
    const ended = timestampOrFallback(row.completed_at, started, sessionId, 'completed_at');
    const prepared = row.observations.map((item, observationIndex) => {
      if (typeof item !== 'object' || !item) throw new Error(`Malformed observation ${sessionIndex}:${observationIndex}`);
      const old = item as Record<string, unknown>;
      return { old, ...ensureLegacySkill(String(old.skill_id ?? ''), old, `${sessionId}-${observationIndex}`) };
    });
    const skillIds = [...new Set(prepared.map((item) => item.skillId))];
    const task_ids = result.tasks.filter((task) => task.skill_ids.some((skillId) => skillIds.includes(skillId))).map((task) => task.id);
    if (!result.sessions.some((item) => item.id === sessionId)) result.sessions.push({ id: sessionId, mode: row.mode === 'kid' || row.mode === 'child' ? 'child' : 'parent', started_at: started, ended_at: ended, duration_seconds: startedKnown && endedKnown ? Math.max(0, Math.round((Date.parse(ended) - Date.parse(started)) / 1000)) : undefined, task_ids, status: 'completed' });
    prepared.forEach(({ old, skillId, wasUnknown }, observationIndex) => {
      const id = safeId('legacy-observation', `${sessionId}-${observationIndex}`, observationIndex);
      const promptShown = old.hint_was_shown === true, answerRevealed = old.answer_revealed === true;
      const originalOutcome = String(old.outcome ?? '未知');
      const outcome = wasUnknown ? 'unverified' : legacyOutcome(old.outcome, promptShown, answerRevealed);
      const originalEvidence = String(old.original_clause ?? old.comment ?? old.spoken_answer_transcript ?? '旧版成人手动评分');
      if (!result.observations.some((item) => item.id === id)) result.observations.push({ id, skill_id: skillId, practice_session_id: sessionId, outcome, evidence: wasUnknown ? `[旧结果:${originalOutcome}] ${originalEvidence}` : originalEvidence, source: 'parent_report', prompt_shown: promptShown, answer_revealed: answerRevealed, confidence: wasUnknown ? 0 : 1, verified_by_parent: !wasUnknown, timestamp: ended });
      if (!wasUnknown && old.outcome === 'independent' && outcome === 'prompted') addAudit(`legacy-hint-upgrade-${id}`, 'legacy_hint_invariant_upgrade', id, '旧版 independent 记录曾显示提示或答案，迁移为 prompted。', ended);
    });
  });

  raw.raw_parent_notes.forEach((entry, noteIndex) => {
    if (typeof entry !== 'object' || !entry) throw new Error(`Malformed raw_parent_notes[${noteIndex}]`);
    const row = entry as Record<string, unknown>;
    const noteId = safeId('legacy-note', row.id, noteIndex);
    const created = timestampOrFallback(row.created_at, fallbackTime, noteId, 'created_at');
    const linked: string[] = [];
    const embedded = Array.isArray(row.observations) ? row.observations : [];
    embedded.forEach((entryObservation, observationIndex) => {
      if (typeof entryObservation !== 'object' || !entryObservation) throw new Error(`Malformed note observation ${noteIndex}:${observationIndex}`);
      const old = entryObservation as Record<string, unknown>;
      const { skillId, wasUnknown } = ensureLegacySkill(String(old.skill_id ?? ''), old, `${noteId}-${observationIndex}`);
      const observationId = safeId('legacy-note-observation', `${noteId}-${observationIndex}`, observationIndex);
      const promptShown = old.hint_was_shown === true, answerRevealed = old.answer_revealed === true;
      const outcome = wasUnknown ? 'unverified' : legacyOutcome(old.outcome, promptShown, answerRevealed);
      const evidence = String(old.original_clause ?? row.text ?? '');
      if (!result.observations.some((item) => item.id === observationId)) result.observations.push({ id: observationId, skill_id: skillId, outcome, evidence: wasUnknown ? `[旧结果:${String(old.outcome ?? '未知')}] ${evidence}` : evidence, source: 'parent_report', prompt_shown: promptShown, answer_revealed: answerRevealed, confidence: wasUnknown ? 0 : 1, verified_by_parent: !wasUnknown, timestamp: created });
      if (!wasUnknown && old.outcome === 'independent' && outcome === 'prompted') addAudit(`legacy-hint-upgrade-${observationId}`, 'legacy_hint_invariant_upgrade', observationId, '旧版 independent 记录曾显示提示或答案，迁移为 prompted。', created);
      linked.push(observationId);
    });
    if (!result.notes.some((item) => item.id === noteId)) result.notes.push({ id: noteId, raw_text: String(row.text ?? row.raw_text ?? ''), transcript: row.source === 'parent_voice_speech_transcript' ? String(row.text ?? '') : undefined, transcription_status: row.source === 'parent_voice_speech_transcript' ? 'complete' : 'not_requested', consent_status: 'not_requested', linked_observation_ids: linked, created_at: created });
  });

  const auditId = `migration-${String(raw.schema_version).replace(/\./g, '-')}`;
  if (!result.audit.some((entry) => entry.id === auditId)) result.audit.push({ id: auditId, timestamp: fallbackTime, action: 'migrate_legacy_backup', entity_id: 'snapshot', detail: `Migrated ${raw.schema_version} records without embedded audio.` });
  return validateReferences(result);
}
