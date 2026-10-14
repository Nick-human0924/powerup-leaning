import { describe,it,expect } from 'vitest';
import { createSeedSnapshot } from '../src/lib/seed';
import { proposeFeedback } from '../src/lib/feedback';
import { recommend } from '../src/lib/recommendations';
import { recordObservation } from '../src/lib/domain';
import { previewImportDiff,publishImport } from '../src/lib/ingestion';

describe('final integration reliability',()=>{
 it('matches Chinese vocabulary meanings dynamically and does not invert no-hint language',()=>{
  const candidates=proposeFeedback('香蕉完全不用提醒，面包提示了才会',createSeedSnapshot());
  expect(candidates.map(c=>c.outcome_suggestion)).toEqual(['independent','prompted']);
 });
 it('unknown class dates are described honestly and new taught targets enter recommendation',()=>{
  const s=createSeedSnapshot();const skill=s.skills.find(x=>x.id==='PU1-U4-VOCAB-BREAD')!;
  s.lessons.push({id:'unknown-lesson',date_known:false,duration_minutes:25,material_id:s.materials[0].id,source_page_ids:skill.source_page_ids,skill_ids:[skill.id],notes:'家长明确关联',created_at:'2026-10-14T00:00:00Z'});
  const pick=recommend(s,3,new Date('2026-10-14T08:00:00Z'))[0];
  expect(pick.skill.id).toBe(skill.id);expect(pick.reason).toMatch(/未知或较早/);expect(pick.reason).not.toMatch(/最近课次/);
 });
 it('same-day independent attempts do not trigger seven-day spacing',()=>{
  const s=createSeedSnapshot();for(const time of ['2026-10-10T08:00:00Z','2026-10-10T09:00:00Z'])recordObservation(s,{skill_id:'PU1-U4-REQUEST',outcome:'independent',evidence:'家长确认',source:'parent_report',prompt_shown:false,answer_revealed:false,confidence:1,verified_by_parent:true,timestamp:time});
  const result=recommend(s,10,new Date('2026-10-14T09:00:00Z'),'PU1-U4').find(x=>x.skill.id==='PU1-U4-REQUEST');expect(result?.reason).toContain('3 天');
 });
 it('import review previews existing revisions without mutating history',()=>{
  const s=createSeedSnapshot();const before=structuredClone(s);const unit=s.units.find(x=>x.id==='PU1-U4')!;const diff=previewImportDiff(s,{material:s.materials[0],unit_title:unit.title,section_type:'Vocabulary',pages:[],assets:[],jobs:[],entries:[{type:'vocabulary',expression:'bread',meaning:'新核对含义',page_id:'PU1-P45',evidence:'bread'}]});
  expect(diff[0]).toMatchObject({kind:'modified',expression:'bread'});expect(s).toEqual(before);
 });
 it('a skill revision generates a current practice version and keeps every old task reference',()=>{
  const s=createSeedSnapshot();const before=s.tasks.map(t=>t.id);const vocab=s.skills.find(x=>x.id==='PU1-U4-VOCAB-BREAD')!;const unit=s.units.find(x=>x.id==='PU1-U4')!;const page=s.pages.find(x=>x.id===vocab.source_page_ids[0])!;const asset=s.assets.find(x=>x.id===page.asset_id)!;
  publishImport(s,{material:s.materials[0],unit_title:unit.title,section_type:'Vocabulary',pages:[page],assets:[asset],jobs:[],entries:[{type:'vocabulary',expression:'bread',meaning:'说出面包的英文，然后再试一次',page_id:page.id,evidence:'bread'}]});
  expect(s.tasks.filter(t=>t.skill_ids.includes(vocab.id)).some(t=>t.version===2)).toBe(true);expect(before.every(id=>s.tasks.some(t=>t.id===id))).toBe(true);
  s.lessons.push({id:'lesson-bread',date_known:false,duration_minutes:25,material_id:s.materials[0].id,source_page_ids:vocab.source_page_ids,skill_ids:[vocab.id],notes:'明确关联',created_at:'2026-10-14T00:00:00Z'});
  const pick=recommend(s,3)[0];expect(pick.task.version).toBe(2);expect(pick.task.scenario).toBe(vocab.goal);
 });
});
