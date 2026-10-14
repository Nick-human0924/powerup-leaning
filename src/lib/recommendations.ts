import type { PracticeTask, Skill, Snapshot } from './schema';

export type Recommendation = { task: PracticeTask; skill: Skill; reason: string };

const DAY = 86_400_000;

export function recommend(snapshot: Snapshot, minutes: number, now = new Date(), unitId?: string): Recommendation[] {
  const eligible = snapshot.skills.filter((skill) => skill.review_status === 'verified' && (!unitId || skill.unit_id === unitId));
  const taughtSkills = new Set(snapshot.lessons.flatMap((lesson) => lesson.skill_ids));
  const recentSkills = new Set(snapshot.lessons.filter(lesson=>lesson.actual_date && Math.abs(now.getTime()-new Date(lesson.actual_date+'T12:00:00').getTime())<=7*DAY).flatMap(lesson=>lesson.skill_ids));
  const ranked = eligible.map((skill) => {
    const observations = snapshot.observations.filter((item) => item.skill_id === skill.id && item.verified_by_parent).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const measured = observations.filter((item) => !['not_tested', 'unverified'].includes(item.outcome));
    const latest = measured[0];
    let score = 10;
    let reason = '尚未测过，可以先做一次轻量检查。';
    if (!latest && taughtSkills.has(skill.id)) { score = recentSkills.has(skill.id)?100:85; reason = recentSkills.has(skill.id)?'最近课次涉及这个目标，目前尚未测过。':'已关联课次的目标，尚未测过；授课日期可能未知或较早。'; }
    else if (latest) {
      const elapsedDays = Math.max(0, (now.getTime() - new Date(latest.timestamp).getTime()) / DAY);
      if (latest.outcome === 'miss') { score = elapsedDays >= 1 ? 95 : 72; reason = '上次暂时不会，按 1 天间隔安排巩固。'; }
      else if (latest.outcome === 'prompted') { score = elapsedDays >= 1 ? 90 : 68; reason = '上次需要提示，按 1 天间隔再次尝试。'; }
      else {
        const latestSetback=measured.findIndex(item=>item.outcome==='prompted'||item.outcome==='miss');
        const streak=latestSetback<0?measured:measured.slice(0,latestSetback);
        const independentDays=new Set(streak.filter(item=>item.outcome==='independent').map(item=>new Date(item.timestamp).toLocaleDateString('en-CA'))).size;
        const interval = independentDays >= 2 ? 7 : 3;
        score = elapsedDays >= interval ? 70 + Math.min(elapsedDays, 20) : -20 + elapsedDays;
        reason = `上次独立完成，按 ${interval} 天间隔复习。`;
      }
    }
    const task = snapshot.tasks.filter(candidate=>candidate.skill_ids.includes(skill.id)).sort((a,b)=>b.version-a.version)[0];
    return task ? { task, skill, reason, score } : undefined;
  }).filter((item): item is Recommendation & { score: number } => Boolean(item));

  ranked.sort((a, b) => b.score - a.score || a.task.id.localeCompare(b.task.id));
  const targetCount = Math.max(1, Math.min(4, Math.floor(Math.max(1, minutes) / 1.25)));
  const budgetSeconds = Math.max(60, minutes * 60);
  const selected: Recommendation[] = [];
  let seconds = 0;
  for (const item of ranked) {
    if (selected.length >= targetCount) break;
    if (selected.length && seconds + item.task.estimated_seconds > budgetSeconds) continue;
    selected.push({ task: item.task, skill: item.skill, reason: item.reason });
    seconds += item.task.estimated_seconds;
  }
  return selected;
}
