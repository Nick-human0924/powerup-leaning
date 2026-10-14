import { z } from 'zod';

const id = z.string().min(1);
const iso = z.string().datetime({ offset: true });
const confidence = z.number().min(0).max(1);

export const reviewStatusSchema = z.enum(['pending', 'verified', 'rejected']);
export const outcomeSchema = z.enum(['independent', 'prompted', 'miss', 'not_tested', 'unverified']);
export type Outcome = z.infer<typeof outcomeSchema>;

export const Material = z.object({
  id, title: z.string().min(1), level: z.string().min(1), edition: z.string().min(1),
  publisher: z.string().optional(), created_at: iso,
  source_kind: z.enum(['textbook', 'lesson_material', 'manual']), review_status: reviewStatusSchema,
});
export type Material = z.infer<typeof Material>;

export const SourceAsset = z.object({
  id, material_id: id, filename: z.string().min(1), file_hash: z.string().min(1),
  mime: z.string().min(1), storage_ref: z.string().min(1), uploaded_at: iso,
});
export type SourceAsset = z.infer<typeof SourceAsset>;

export const SourcePage = z.object({
  id, asset_id: id, pdf_page_index: z.number().int().nonnegative().nullable(),
  printed_page_number: z.number().int().positive().nullable(), unit_id: id.optional(),
  printed_page_status: z.enum(['not_present', 'observed_ocr', 'verified_visual', 'inferred_continuity']).optional(),
  ocr_printed_page_candidate: z.number().int().positive().nullable().optional(), printed_page_evidence: z.string().optional(),
  page_preview_ref: z.string().optional(), ocr_status: z.enum(['not_needed', 'pending', 'complete', 'manual_required', 'failed']),
  source_confidence: confidence, content_hash: z.string().optional(), extracted_text: z.string().optional(),
});
export type SourcePage = z.infer<typeof SourcePage>;

export const ReferenceOutline = z.object({
  vocabulary: z.array(z.string().min(1)), expressions: z.array(z.string().min(1)),
  goal: z.string().min(1), source_ref: z.string().min(1),
});
export type ReferenceOutline = z.infer<typeof ReferenceOutline>;

export const Unit = z.object({
  id, material_id: id, title: z.string().min(1), printed_page_range: z.tuple([z.number().int().positive(), z.number().int().positive()]).nullable(),
  source_page_ids: z.array(id), review_status: reviewStatusSchema.default('verified'), order: z.number().int().nonnegative().optional(),
  reference_outline: ReferenceOutline.optional(),
});
export type Unit = z.infer<typeof Unit>;

export const Section = z.object({
  id, unit_id: id, material_id: id, title: z.string().min(1),
  printed_page_range: z.tuple([z.number().int().positive(), z.number().int().positive()]).nullable(),
  source_page_ids: z.array(id), section_type: z.string().min(1), review_status: reviewStatusSchema.default('verified'),
});
export type Section = z.infer<typeof Section>;

export const Skill = z.object({
  id, title: z.string().min(1), unit_id: id, type: z.enum(['vocabulary', 'target_expression', 'communication_goal', 'other']),
  canonical_expression: z.string().optional(), words: z.array(z.string().min(1)).optional(), goal: z.string().min(1),
  source_page_ids: z.array(id), origin: z.enum(['source', 'derived']), review_status: reviewStatusSchema,
  version: z.number().int().positive(), source_evidence: z.string(), confidence,
});
export type Skill = z.infer<typeof Skill>;

export const PracticeTask = z.object({
  id, skill_ids: z.array(id).min(1), prompt: z.string().min(1), parent_instruction: z.string().min(1),
  expected_answers: z.array(z.string().min(1)).min(1), hint_levels: z.array(z.string().min(1)), scenario: z.string().min(1),
  estimated_seconds: z.number().int().positive(), origin: z.enum(['source', 'derived']), source_page_ids: z.array(id),
  version: z.number().int().positive(),
});
export type PracticeTask = z.infer<typeof PracticeTask>;

export const LessonSession = z.object({
  id, actual_date: z.string().date().optional(), date_known: z.boolean(), duration_minutes: z.number().positive(),
  material_id: id, source_page_ids: z.array(id), skill_ids: z.array(id), notes: z.string(), created_at: iso,
}).superRefine((value, ctx) => {
  if (value.date_known !== Boolean(value.actual_date)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'date_known must match actual_date presence', path: ['date_known'] });
});
export type LessonSession = z.infer<typeof LessonSession>;

export const PracticeSession = z.object({
  id, mode: z.enum(['parent', 'child']), started_at: iso, ended_at: iso.optional(),
  duration_seconds: z.number().int().nonnegative().optional(), task_ids: z.array(id), status: z.enum(['in_progress', 'completed', 'abandoned']),
});
export type PracticeSession = z.infer<typeof PracticeSession>;

export const Observation = z.object({
  id, skill_id: id, practice_session_id: id.optional(), lesson_session_id: id.optional(), outcome: outcomeSchema,
  evidence: z.string(), source: z.enum(['parent_report', 'child_interaction']), prompt_shown: z.boolean(), answer_revealed: z.boolean(),
  confidence, verified_by_parent: z.boolean(), timestamp: iso,
}).superRefine((value, ctx) => {
  if (value.outcome === 'independent' && (value.prompt_shown || value.answer_revealed)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Independent evidence cannot include a shown prompt or answer', path: ['outcome'] });
  }
  if (value.outcome === 'independent' && !value.verified_by_parent) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Unverified independent suggestions must use outcome=unverified', path: ['outcome'] });
  }
});
export type Observation = z.infer<typeof Observation>;

export const ParentNote = z.object({
  id, raw_text: z.string(), transcript: z.string().optional(), media_ref: z.string().optional(),
  transcription_status: z.enum(['not_requested', 'pending', 'complete', 'failed', 'manual_required']),
  consent_status: z.enum(['not_requested', 'granted', 'denied']), linked_observation_ids: z.array(id), created_at: iso,
});
export type ParentNote = z.infer<typeof ParentNote>;

export const AudioAsset = z.object({
  id, note_id: id.optional(), media_ref: z.string().min(1), mime: z.string().min(1), created_at: iso,
  consent_status: z.enum(['not_requested', 'granted', 'denied']), transcription_status: z.enum(['not_requested', 'pending', 'complete', 'failed', 'manual_required']),
});
export type AudioAsset = z.infer<typeof AudioAsset>;

export const ImportJob = z.object({
  id, asset_ids: z.array(id), job_type: z.enum(['material', 'lesson', 'feedback']),
  status: z.enum(['pending', 'processing', 'manual_review', 'published', 'cancelled', 'failed']),
  progress: z.number().min(0).max(1), errors: z.array(z.string()), created_candidate_ids: z.array(id),
  created_at: iso, finished_at: iso.optional(),
});
export type ImportJob = z.infer<typeof ImportJob>;

export const AuditEntry = z.object({ id, timestamp: iso, action: z.string().min(1), entity_id: id, detail: z.string() });
export type AuditEntry = z.infer<typeof AuditEntry>;

export const snapshotSchema = z.object({
  schema_version: z.literal('1.0.0'), materials: z.array(Material), assets: z.array(SourceAsset), pages: z.array(SourcePage),
  units: z.array(Unit), sections: z.array(Section), skills: z.array(Skill), tasks: z.array(PracticeTask), lessons: z.array(LessonSession),
  sessions: z.array(PracticeSession), observations: z.array(Observation), notes: z.array(ParentNote), audio: z.array(AudioAsset),
  jobs: z.array(ImportJob), audit: z.array(AuditEntry),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

export function emptySnapshot(): Snapshot {
  return { schema_version: '1.0.0', materials: [], assets: [], pages: [], units: [], sections: [], skills: [], tasks: [], lessons: [], sessions: [], observations: [], notes: [], audio: [], jobs: [], audit: [] };
}

export function validateReferences(snapshot: Snapshot): Snapshot {
  const parsed = snapshotSchema.parse(snapshot);
  const ids = <T extends { id: string }>(rows: T[]) => new Set(rows.map((row) => row.id));
  const unique = (label: string, rows: { id: string }[]) => {
    const set = ids(rows); if (set.size !== rows.length) throw new Error(`Duplicate ${label} id`); return set;
  };
  const materials = unique('material', parsed.materials), assets = unique('asset', parsed.assets), pages = unique('page', parsed.pages);
  const units = unique('unit', parsed.units), skills = unique('skill', parsed.skills), tasks = unique('task', parsed.tasks);
  const lessons = unique('lesson', parsed.lessons), sessions = unique('session', parsed.sessions), observations = unique('observation', parsed.observations);
  unique('section', parsed.sections); unique('note', parsed.notes); unique('audio', parsed.audio); unique('job', parsed.jobs); unique('audit', parsed.audit);
  const requireRef = (ok: boolean, detail: string) => { if (!ok) throw new Error(`Broken reference: ${detail}`); };
  parsed.assets.forEach((x) => requireRef(materials.has(x.material_id), `asset ${x.id} -> material ${x.material_id}`));
  parsed.pages.forEach((x) => { requireRef(assets.has(x.asset_id), `page ${x.id} -> asset ${x.asset_id}`); if (x.unit_id) requireRef(units.has(x.unit_id), `page ${x.id} -> unit ${x.unit_id}`); });
  parsed.units.forEach((x) => { requireRef(materials.has(x.material_id), `unit ${x.id} -> material ${x.material_id}`); x.source_page_ids.forEach((v) => requireRef(pages.has(v), `unit ${x.id} -> page ${v}`)); });
  parsed.sections.forEach((x) => { requireRef(units.has(x.unit_id) && materials.has(x.material_id), `section ${x.id}`); x.source_page_ids.forEach((v) => requireRef(pages.has(v), `section ${x.id} -> page ${v}`)); });
  parsed.skills.forEach((x) => { requireRef(units.has(x.unit_id), `skill ${x.id} -> unit ${x.unit_id}`); x.source_page_ids.forEach((v) => requireRef(pages.has(v), `skill ${x.id} -> page ${v}`)); });
  parsed.tasks.forEach((x) => { x.skill_ids.forEach((v) => requireRef(skills.has(v), `task ${x.id} -> skill ${v}`)); x.source_page_ids.forEach((v) => requireRef(pages.has(v), `task ${x.id} -> page ${v}`)); });
  parsed.lessons.forEach((x) => { requireRef(materials.has(x.material_id), `lesson ${x.id} -> material ${x.material_id}`); x.source_page_ids.forEach((v) => requireRef(pages.has(v), `lesson ${x.id} -> page ${v}`)); x.skill_ids.forEach((v) => requireRef(skills.has(v), `lesson ${x.id} -> skill ${v}`)); });
  parsed.sessions.forEach((x) => x.task_ids.forEach((v) => requireRef(tasks.has(v), `session ${x.id} -> task ${v}`)));
  parsed.observations.forEach((x) => { requireRef(skills.has(x.skill_id), `observation ${x.id} -> skill ${x.skill_id}`); if (x.practice_session_id) requireRef(sessions.has(x.practice_session_id), `observation ${x.id} -> session ${x.practice_session_id}`); if (x.lesson_session_id) requireRef(lessons.has(x.lesson_session_id), `observation ${x.id} -> lesson ${x.lesson_session_id}`); });
  parsed.notes.forEach((x) => x.linked_observation_ids.forEach((v) => requireRef(observations.has(v), `note ${x.id} -> observation ${v}`)));
  parsed.jobs.forEach((x) => x.asset_ids.forEach((v) => requireRef(assets.has(v), `job ${x.id} -> asset ${v}`)));
  return parsed;
}
