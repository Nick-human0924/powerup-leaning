import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPublicDemoSnapshot } from '../scripts/public-curriculum.mjs';
import { isPublicCatalogCurrent, reconcilePublicSeed } from '../src/lib/public-catalog';
import { snapshotSchema, validateReferences, type Snapshot } from '../src/lib/schema';
import oldPublicSeed from './fixtures/public-demo-v1.json';

function legacy(): Snapshot {
  const seed = validateReferences(snapshotSchema.parse(structuredClone(oldPublicSeed)));
  seed.observations = [{id:'old-evidence',skill_id:'DEMO-SKILL-WATER',outcome:'not_tested',evidence:'尚未观察，不能当成不会',source:'parent_report',prompt_shown:false,answer_revealed:false,confidence:1,verified_by_parent:true,timestamp:'2026-10-15T00:00:00.000Z'}];
  seed.notes = [{id:'old-note',raw_text:'完全不用提示，原话待核对',linked_observation_ids:['old-evidence'],transcription_status:'not_requested',consent_status:'not_requested',created_at:'2026-10-15T00:00:00.000Z'}];
  seed.skills[0].goal = '保留用户编辑';
  return validateReferences(seed);
}

afterEach(() => {vi.unstubAllGlobals();vi.unstubAllEnvs();});

describe('public curriculum release', () => {
  it('contains eight ordered units with executable original tasks and no private history', () => {
    const seed = validateReferences(createPublicDemoSnapshot('/powerup-leaning'));
    expect(isPublicCatalogCurrent(seed)).toBe(true);
    expect(seed.units.map(unit => unit.order)).toEqual([0,1,2,3,4,5,6,7]);
    for(const unit of seed.units){
      const skills = seed.skills.filter(skill => skill.unit_id === unit.id);
      expect(skills.length).toBeGreaterThanOrEqual(8);
      for(const skill of skills) expect(seed.tasks.some(task => task.skill_ids.includes(skill.id) && task.prompt && task.expected_answers.length)).toBe(true);
      expect(unit.printed_page_range).toBeNull();
    }
    for(const key of ['lessons','sessions','observations','notes','audio'] as const) expect(seed[key]).toEqual([]);
    expect(JSON.stringify(seed)).not.toMatch(/Pupil_s Book|textbook-pages|local-file:|PU1-U/u);
  });

  it('upgrades v1 without deleting or rewriting evidence, notes or edited skills and is idempotent', () => {
    const old = legacy();
    old.units.push({...old.units[0],id:'locally-imported-unit',title:'用户后来导入的内容',order:undefined});
    const upgraded = reconcilePublicSeed(old, createPublicDemoSnapshot());
    expect(upgraded.units).toHaveLength(9);
    expect(upgraded.units.at(-1)?.id).toBe('locally-imported-unit');
    expect(upgraded.observations).toEqual(old.observations);
    expect(upgraded.notes).toEqual(old.notes);
    expect(upgraded.assets.find(asset=>asset.id==='DEMO-ASSET-CARD')).toEqual(old.assets[0]);
    expect(upgraded.skills.find(skill => skill.id === old.skills[0].id)?.goal).toBe('保留用户编辑');
    expect(upgraded.units.find(unit => unit.id === 'DEMO-UNIT-DAILY')?.order).toBe(4);
    expect(reconcilePublicSeed(upgraded, createPublicDemoSnapshot())).toEqual(upgraded);
    expect(old.units).toHaveLength(2);
  });

  it('rejects incomplete or history-bearing public releases', () => {
    const incoming = createPublicDemoSnapshot();
    incoming.notes.push(legacy().notes[0]);
    incoming.notes[0].linked_observation_ids=[];
    expect(() => reconcilePublicSeed(legacy(), incoming)).toThrow(/personal history/);
    expect(() => reconcilePublicSeed(legacy(), legacy())).toThrow(/incomplete/);
  });

  it('loads the public database upgrade from the latest transaction without losing a concurrent record', async () => {
    vi.stubEnv('NEXT_PUBLIC_PUBLIC_DEMO','true');
    vi.resetModules();
    const raw = new Dexie('english-companion-public-demo');
    raw.version(1).stores({snapshots:'&key',blobs:'&id'});
    await raw.table('snapshots').put({key:'current',value:legacy()});
    let release!: (value:Response)=>void;
    const pending = new Promise<Response>(resolve => {release=resolve;});
    vi.stubGlobal('fetch',vi.fn(()=>pending));
    const {loadSnapshot}=await import('../src/lib/db');
    const loading=loadSnapshot();
    await vi.waitFor(()=>expect(fetch).toHaveBeenCalledOnce());
    const row=await raw.table('snapshots').get('current');
    row.value.observations.push({...row.value.observations[0],id:'concurrent',outcome:'prompted',prompt_shown:true});
    await raw.table('snapshots').put(row);
    release({ok:true,json:async()=>createPublicDemoSnapshot()} as Response);
    const upgraded=await loading;
    expect(upgraded.units).toHaveLength(8);
    expect(upgraded.observations.map(row=>row.id)).toEqual(['old-evidence','concurrent']);
    raw.close();
  });

  it('keeps the v1 public archive usable when the new catalog cannot be fetched', async () => {
    vi.stubEnv('NEXT_PUBLIC_PUBLIC_DEMO','true');
    vi.resetModules();
    const raw = new Dexie('english-companion-public-demo');
    raw.version(1).stores({snapshots:'&key',blobs:'&id'});
    await raw.table('snapshots').put({key:'current',value:legacy()});
    raw.close();
    vi.stubGlobal('fetch',vi.fn(async()=>{throw Error('offline');}));
    const {loadSnapshot}=await import('../src/lib/db');
    const loaded=await loadSnapshot();
    expect(loaded.units).toHaveLength(1);
    expect(loaded.observations).toEqual(legacy().observations);
    expect(isPublicCatalogCurrent(loaded)).toBe(false);
  });
});
