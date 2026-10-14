import type { Outcome, Snapshot } from './schema';

export type FeedbackProposal = { skill_id: string; outcome_suggestion: Outcome; source_phrase: string; confidence: number };

function inferOutcome(phrase: string): Outcome {
  if (/(没测|未测|没问|没有测试|没练|跳过|没考)/.test(phrase)) return 'not_tested';
  if (/(提示|提醒|引导|示范)(后|了|过)?.*(仍|还|也)?(不会|答错|答不出|说不出)/.test(phrase)) return 'miss';
  const noHint = /(完全)?不(用|需要)(我)?(提醒|提示)|没(有)?(提醒|提示)|完全没(有)?(提示|提醒)/.test(phrase);
  const withoutNoHint = phrase.replace(/(完全)?不(用|需要)(我)?(提醒|提示)|没(有)?(提醒|提示)|完全没(有)?(提示|提醒)/g, '');
  if (/(提示|提醒|引导|跟读|说了句首|才(会|能|说)|示范|教了)/.test(withoutNoHint)) return 'prompted';
  if (/(不会|答错|没答|没说|回答不上|说不出|卡住|不知道|没记住)/.test(withoutNoHint)) return 'miss';
  if (noHint || /(自己|独立|主动|直接(回答|说)|完整说出|自己答|会回答|答得出|能回答|能说)/.test(phrase)) return 'independent';
  return 'unverified';
}

const normalize = (value: string) => value.toLocaleLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, ' ').trim();
const meaningful = (value: string) => normalize(value).split(/\s+/).filter((token) => token.length > 1);

function matchesFor(phrase: string, snapshot: Snapshot): string[] {
  const haystack = normalize(phrase);
  const sentenceReference = /那(句)?话/.test(phrase);
  const matches = new Set<string>();
  for (const skill of snapshot.skills.filter((item) => item.review_status !== 'rejected')) {
    const meaning=skill.type==='vocabulary'?(skill.goal.match(/说出(.+)的英文/)?.[1]||skill.goal):undefined;
    const direct = [skill.title, skill.canonical_expression, ...(skill.words ?? []), meaning].filter((item): item is string => Boolean(item));
    if ((!sentenceReference || skill.type !== 'vocabulary') && direct.some((alias) => {
      const needle = normalize(alias);
      return needle.length >= 2 && haystack.includes(needle);
    })) matches.add(skill.id);
    if (skill.type === 'target_expression') {
      const grammarCues = meaningful(skill.canonical_expression ?? '').filter((token) => !['some', 'please', 'chocolate', 'cream'].includes(token));
      if (grammarCues.length >= 3 && grammarCues.slice(0, 3).every((token) => haystack.includes(token))) matches.add(skill.id);
      if (sentenceReference) {
        const taskTokens = snapshot.tasks.filter((task) => task.skill_ids.includes(skill.id)).flatMap((task) => [...task.expected_answers, task.prompt]).flatMap(meaningful);
        if (taskTokens.some((token) => token.length >= 3 && haystack.includes(token))) matches.add(skill.id);
      }
    }
  }
  return [...matches];
}

export function proposeFeedback(text: string, snapshot: Snapshot): FeedbackProposal[] {
  const phrases = text.split(/[，,。；;！!？?\n]+/).map((part) => part.trim()).filter(Boolean);
  const proposals: FeedbackProposal[] = [];
  for (const phrase of phrases) {
    const matches = matchesFor(phrase, snapshot);
    if (!matches.length) continue;
    const ambiguous = matches.length > 1;
    const inferred = inferOutcome(phrase);
    for (const skill_id of matches) {
      proposals.push({ skill_id, outcome_suggestion: ambiguous ? 'unverified' : inferred, source_phrase: phrase, confidence: ambiguous || inferred === 'unverified' ? 0.45 : 0.88 });
    }
  }
  return proposals;
}
