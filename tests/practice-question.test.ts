import { describe, expect, it } from 'vitest';
import { createSeedSnapshot } from '../src/lib/seed';
import { questionForTask } from '../src/lib/domain';

describe('askable source questions', () => {
  const seed=createSeedSnapshot();
  it('asks one English question for age rather than a Chinese meta instruction', () => {
    const skill=seed.skills.find(s=>s.id==='PU1-U0-HELLO-ASK-AGE')!;
    const task=seed.tasks.find(t=>t.skill_ids.includes(skill.id))!;
    expect(questionForTask(task,skill)).toBe('How old are you?');
    expect(questionForTask(task,skill)).not.toContain(task.expected_answers[0]);
  });
  it('never shows the request answer even when the task substitutes water for chocolate', () => {
    const skill=seed.skills.find(s=>s.id==='PU1-U4-REQUEST')!;
    for(const task of seed.tasks.filter(t=>t.skill_ids.includes(skill.id))) {
      expect(questionForTask(task,skill)).not.toMatch(/Can I have/i);
      expect(questionForTask(task,skill)).not.toContain(task.expected_answers[0]);
    }
  });
});
