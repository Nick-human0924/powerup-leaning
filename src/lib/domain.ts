import { Observation, PracticeTask, type Skill, type Snapshot } from './schema';
import { publicDemo } from './runtime';

export function makeId(prefix = 'id'): string {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${uuid}`;
}

/** Show one askable question without exposing a model answer from source text. */
export function questionForTask(task: PracticeTask, skill?: Skill): string {
  if (!/^(生活情境|用英文说出|情境：|家长)/u.test(task.prompt)) return task.prompt;
  if (skill?.type === 'vocabulary') {
    const cue = skill.goal.replace(/^说出[“「]/u, '').replace(/[”」]$/u, '');
    return `How do you say “${cue}” in English?`;
  }
  const question = skill?.canonical_expression?.split(/\s*\/\s*/u)[0]?.trim();
  const normalized = (text: string) => text.toLowerCase().replace(/[’‘]/gu, "'").replace(/[\s.,!?]/gu, '');
  if (/^Can I /i.test(question ?? '')) return 'Ask for it politely.';
  if (question?.endsWith('?') && !task.expected_answers.some(answer => normalized(answer) === normalized(question))) return question;
  return 'Tell me about it in English.';
}

const localDay = (timestamp: string) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function mastery(skillId: string, snapshot: Snapshot): { status: string; label: string; reason: string } {
  const observations = snapshot.observations.filter((item) => item.skill_id === skillId && item.verified_by_parent && item.outcome !== 'unverified').sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  if (!observations.length || observations.every((item) => item.outcome === 'not_tested')) {
    return { status: 'not_tested', label: '尚未测过', reason: '还没有家长确认的表现证据。' };
  }
  const measured = observations.filter((item) => item.outcome !== 'not_tested');
  const latest = measured.at(-1);
  if (!latest) return { status: 'not_tested', label: '尚未测过', reason: '现有记录均为未测试。' };
  if (latest.outcome === 'miss') return { status: 'needs_practice', label: '需要巩固', reason: '最近一次确认记录为暂时不会。' };
  if (latest.outcome === 'prompted') return { status: 'needs_practice', label: '需要巩固', reason: '最近一次需要提示后才能完成。' };
  const lastSetback = measured.findLastIndex((item) => item.outcome === 'miss' || item.outcome === 'prompted');
  const independentDays = new Set(measured.slice(lastSetback + 1).filter((item) => item.outcome === 'independent').map((item) => localDay(item.timestamp)));
  if (independentDays.size >= 2) return { status: 'stable', label: '稳定掌握', reason: `已在 ${independentDays.size} 个不同日期独立完成。` };
  return { status: 'emerging', label: '初步掌握', reason: '已有一次独立表现，还需要在另一天再次确认。' };
}

export function recordObservation(snapshot: Snapshot, input: Omit<Observation, 'id' | 'timestamp'> & { timestamp?: string }): Observation {
  if (!snapshot.skills.some((skill) => skill.id === input.skill_id)) throw new Error(`Unknown skill: ${input.skill_id}`);
  let outcome = input.outcome;
  if (outcome === 'independent' && (input.prompt_shown || input.answer_revealed)) outcome = 'prompted';
  if (outcome === 'independent' && !input.verified_by_parent) outcome = 'unverified';
  const observation = Observation.parse({ ...input, outcome, id: makeId('obs'), timestamp: input.timestamp ?? new Date().toISOString() });
  snapshot.observations.push(observation);
  return observation;
}

function stableHash(text: string): string {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  return (value >>> 0).toString(36);
}

export function generateTasks(skill: Skill): PracticeTask[] {
  const expression = skill.canonical_expression ?? skill.words?.join(', ') ?? skill.title;
  const canonical = expression.toLocaleLowerCase().replace(/[’']/g, '');
  let prompt = skill.type === 'vocabulary' ? `用英文说出：${skill.goal}` : `Try this situation: ${skill.goal}`;
  let expectedAnswers = [expression];
  let parentInstruction = '先描述情境，不展示参考答案；需要时再逐级给提示。';
  if (/^do you like\b/.test(canonical)) {
    prompt = publicDemo?'家长问一个真实的喜好问题，让孩子按自己的想法回答。':'家长问一个真实的喜好问题，让安哲按自己的想法回答。';
    expectedAnswers = ['Yes, I do.', 'No, I don’t.'];
    parentInstruction = '先选一种熟悉的食物，用 Do you like…? 提问；不要先说参考回答。';
  } else if (/^would you like\b/.test(canonical)) {
    prompt = publicDemo?'家长提供一种食物，让孩子礼貌接受或拒绝。':'家长提供一种食物，让安哲礼貌接受或拒绝。';
    expectedAnswers = ['Yes, please.', 'No, thank you.'];
    parentInstruction = '用 Would you like…? 提问；接受或拒绝都可以，不要先说参考回答。';
  } else if (/^can i have\b/.test(canonical)) {
    prompt = publicDemo?'情境：孩子想要一样食物或饮品，请他礼貌开口请求。':'情境：安哲想要一样食物或饮品，请他礼貌开口请求。';
    parentInstruction = '只交代想要什么，不直接念出目标英语句。';
  }
  return [PracticeTask.parse({
    id: `task-${skill.id}-${stableHash(`${skill.version}|${expression}`)}`,
    skill_ids: [skill.id], prompt, parent_instruction: parentInstruction,
    expected_answers: expectedAnswers, hint_levels: [expectedAnswers[0].split(/\s+/).slice(0, Math.max(1, Math.ceil(expectedAnswers[0].split(/\s+/).length / 2))).join(' ') + '…'],
    scenario: skill.goal, estimated_seconds: 45, origin: 'derived', source_page_ids: skill.source_page_ids, version: skill.version,
  })];
}
