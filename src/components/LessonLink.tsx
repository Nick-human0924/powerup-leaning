"use client";
import { useState } from 'react';
import type { Snapshot, Unit } from '@/lib/schema';
import { mutateSnapshot } from '@/lib/db';
import { stableId } from '@/lib/ingestion';

export function LessonLink({snapshot,unit,refresh}:{snapshot:Snapshot;unit:Unit;refresh:()=>Promise<void>}){
 const pages=snapshot.pages.filter(p=>unit.source_page_ids.includes(p.id));
 const [selected,setSelected]=useState<string[]>([]),[known,setKnown]=useState(false),[date,setDate]=useState(''),[duration,setDuration]=useState(25),[notes,setNotes]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 if(!pages.length)return null;
 const save=async()=>{if(!selected.length){setMessage('请明确选择这次真正上过的页面。');return}if(known&&!date){setMessage('请填写实际日期，或取消日期已知。');return}setBusy(true);try{await mutateSnapshot(d=>{const id=stableId('lesson',unit.material_id,known?date:'unknown',...selected.toSorted());if(d.lessons.some(l=>l.id===id)){setMessage('同样页面与日期的课次已存在，无需重复保存。');return}d.lessons.push({id,actual_date:known?date:undefined,date_known:known,duration_minutes:duration,material_id:unit.material_id,source_page_ids:selected,skill_ids:d.skills.filter(s=>s.source_page_ids.some(p=>selected.includes(p))).map(s=>s.id),notes,created_at:new Date().toISOString()});setMessage('课次已关联；掌握状态仍只依据练习证据。');});await refresh();}catch(e){setMessage(e instanceof Error?e.message:'保存失败')}finally{setBusy(false)}};
 return <details className="lesson-box"><summary>关联一次实际外教课</summary><p>只选确实上过的页。没有日期就保留未知，不使用上传时间。</p><div className="button-row">{pages.map(p=><label className="check-row" key={p.id}><input type="checkbox" checked={selected.includes(p.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,p.id]:v.filter(x=>x!==p.id))}/>{p.printed_page_number?`p.${p.printed_page_number}`:'页码未知'}</label>)}</div><label className="check-row"><input type="checkbox" checked={known} onChange={e=>setKnown(e.target.checked)}/>授课日期已知</label>{known&&<label>这次实际日期<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>}<label>课时分钟<input type="number" min="1" max="240" value={duration} onChange={e=>setDuration(Number(e.target.value))}/></label><label>这次课备注<input value={notes} onChange={e=>setNotes(e.target.value)}/></label><button className="button secondary" disabled={busy} onClick={()=>void save()}>保存课次关联</button>{message&&<p role="status">{message}</p>}</details>
}
