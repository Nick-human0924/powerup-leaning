import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { emptySnapshot, validateReferences } from '../src/lib/schema';
import { generateTasks, recordObservation, mastery } from '../src/lib/domain';
import { publishImport } from '../src/lib/ingestion';

describe('public checkout without private textbook fixtures',()=>{
  it('accepts an empty catalog without inventing lessons or performance',()=>{
    const catalog=validateReferences(emptySnapshot());
    expect(catalog.skills).toEqual([]);expect(catalog.observations).toEqual([]);expect(catalog.lessons).toEqual([]);
  });
  it('opens and mutates an empty public archive repeatedly without private catalog revisions',async()=>{
    vi.resetModules();
    vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>emptySnapshot()})));
    const {loadSnapshot,mutateSnapshot}=await import('../src/lib/db');
    expect((await loadSnapshot()).skills).toEqual([]);
    expect((await loadSnapshot()).observations).toEqual([]);
    await mutateSnapshot(d=>{d.notes.push({id:'public-synthetic-note',raw_text:'Synthetic setup check',transcription_status:'not_requested',consent_status:'not_requested',linked_observation_ids:[],created_at:'2026-01-01T00:00:00.000Z'});});
    expect((await loadSnapshot()).notes[0].id).toBe('public-synthetic-note');
    vi.unstubAllGlobals();
  });
  it('publishes synthetic manual content into the dynamic registry, then retains hinted evidence',()=>{
    const catalog=emptySnapshot();
    const stamp='2026-01-01T00:00:00.000Z';
    publishImport(catalog,{
      material:{title:'Synthetic practice book',level:'demo',edition:'demo'},
      unit_title:'Synthetic Unit',section_type:'Vocabulary',
      assets:[{id:'synthetic-asset',material_id:'temporary',filename:'synthetic.png',mime:'image/png',file_hash:'a'.repeat(64),storage_ref:'blob:synthetic',uploaded_at:stamp}],
      pages:[{id:'synthetic-page',asset_id:'synthetic-asset',pdf_page_index:null,printed_page_number:1,content_hash:'b'.repeat(64),page_preview_ref:'blob:synthetic',ocr_status:'manual_required',source_confidence:0}],
      jobs:[],entries:[{type:'vocabulary',expression:'sample',meaning:'示例',page_id:'synthetic-page',evidence:'Synthetic example written for testing.'}],
    });
    const result=catalog;
    expect(result.skills).toHaveLength(1);expect(result.tasks.length).toBeGreaterThan(0);expect(result.lessons).toEqual([]);
    const skill=result.skills[0];expect(generateTasks(skill)[0].skill_ids).toContain(skill.id);
    recordObservation(result,{skill_id:skill.id,outcome:'independent',evidence:'Synthetic test response',source:'parent_report',prompt_shown:true,answer_revealed:false,confidence:1,verified_by_parent:true,timestamp:stamp});
    expect(result.observations[0].outcome).toBe('prompted');expect(mastery(skill.id,result).status).toBe('needs_practice');
    expect(validateReferences(result).skills[0].id).toBe(skill.id);
  });
});
