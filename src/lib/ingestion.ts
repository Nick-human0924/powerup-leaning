import type { Snapshot, SourceAsset, SourcePage, ImportJob, Skill, Material, Unit, Section } from './schema';
import { saveBlob, getBlob } from './db';
import { generateTasks, makeId } from './domain';
import { z } from 'zod';

const normalize=(s:string)=>s.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
export function stableId(prefix:string,...parts:string[]):string {
  // Stable identity; cryptographic SHA256 is used for file and page content separately.
  const text=parts.map(normalize).join('|');let a=2166136261,b=5381;
  for(const char of text){a=Math.imul(a^char.charCodeAt(0),16777619);b=Math.imul(b,33)^char.charCodeAt(0);}
  return `${prefix}_${(a>>>0).toString(16)}${(b>>>0).toString(16)}`;
}
export async function sha256(blob:Blob):Promise<string>{
  const data=await blob.arrayBuffer();const hash=await crypto.subtle.digest('SHA-256',data);
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function abort(signal?:AbortSignal){if(signal?.aborted)throw new DOMException('导入已取消','AbortError');}
async function ensureQuota(bytes:number){if(typeof navigator!=='undefined'&&navigator.storage?.estimate){const {usage=0,quota=Infinity}=await navigator.storage.estimate();if(quota-usage<bytes*1.3)throw Error('本机存储空间不足，请先导出备份并清理附件。');}}
function canvasBlob(canvas:HTMLCanvasElement):Promise<Blob>{return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('无法生成页预览')),'image/jpeg',.85));}

/** Inspect locally only. Text extraction is never confused with semantic parsing. */
export async function inspectFiles(files:File[],snapshot:Snapshot,onProgress:(job:ImportJob)=>void,signal?:AbortSignal):Promise<{jobs:ImportJob[],assets:SourceAsset[],pages:SourcePage[],duplicates:string[]}> {
  const result:{jobs:ImportJob[],assets:SourceAsset[],pages:SourcePage[],duplicates:string[]}={jobs:[],assets:[],pages:[],duplicates:[]};
  for(const file of files){
    abort(signal);const now=new Date().toISOString();const job={id:makeId('job'),asset_ids:[],job_type:'material',status:'processing',progress:0,errors:[],created_candidate_ids:[],created_at:now} as ImportJob;
    result.jobs.push(job);onProgress({...job});
    try{
      if(!/\.(pdf|jpg|jpeg|png)$/i.test(file.name))throw Error('仅支持 PDF / JPG / PNG');
      if(file.size>100*1024*1024)throw Error('单文件超过100MB，请拆成10页左右的小文件');
      await ensureQuota(file.size);const hash=await sha256(file);abort(signal);
      if(snapshot.assets.some(x=>x.file_hash===hash)||result.assets.some(x=>x.file_hash===hash)){result.duplicates.push(file.name);job.status='published';job.progress=1;job.finished_at=new Date().toISOString();onProgress({...job});continue;}
      const assetId=`asset_${hash}`;const asset={id:assetId,material_id:'pending',filename:file.name,file_hash:hash,mime:file.type||(/\.pdf$/i.test(file.name)?'application/pdf':'image/jpeg'),storage_ref:assetId,uploaded_at:now} as SourceAsset;
      await saveBlob(assetId,file);job.asset_ids=[assetId];result.assets.push(asset);
      if(asset.mime==='application/pdf'){
        const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
        const loading=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())});
        const onAbort=()=>{void loading.destroy();};signal?.addEventListener('abort',onAbort,{once:true});
        try{const pdf=await loading.promise;
          for(let index=1;index<=pdf.numPages;index++){
            abort(signal);const page=await pdf.getPage(index);const text=(await page.getTextContent()).items.map(item=>'str' in item?item.str:'').join(' ').trim();
            const view=page.getViewport({scale:1});const viewport=page.getViewport({scale:Math.min(1.4,1000/view.width)});
            const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);const context=canvas.getContext('2d');if(!context)throw Error('浏览器无法创建教材预览');
            await page.render({canvas,canvasContext:context,viewport}).promise;const preview=await canvasBlob(canvas);const pageHash=await sha256(preview);const id=`page_${hash}_${index}`;await saveBlob(`preview_${id}`,preview);
            result.pages.push({id,asset_id:assetId,pdf_page_index:index,printed_page_number:null,unit_id:undefined,page_preview_ref:`preview_${id}`,ocr_status:text.replace(/\s/g,'').length>=30?'complete':'manual_required',source_confidence:0,content_hash:pageHash,extracted_text:text} as SourcePage);
            canvas.width=0;canvas.height=0;page.cleanup();job.progress=index/pdf.numPages*.95;onProgress({...job});
          }
        }finally{signal?.removeEventListener('abort',onAbort);await loading.destroy();}
      }else{
        // Validate image decoding; retain source pixel content, not generated artwork.
        const bitmap=await createImageBitmap(file);bitmap.close();
        result.pages.push({id:`page_${hash}_1`,asset_id:assetId,pdf_page_index:null,printed_page_number:null,page_preview_ref:assetId,ocr_status:'manual_required',source_confidence:0,content_hash:hash,extracted_text:''} as SourcePage);
      }
      abort(signal);job.status='manual_review';job.progress=1;job.created_candidate_ids=result.pages.filter(p=>p.asset_id===assetId).map(p=>p.id);job.finished_at=new Date().toISOString();onProgress({...job});
    }catch(error){job.status=signal?.aborted?'cancelled':'failed';job.errors.push(error instanceof Error?error.message:String(error));job.finished_at=new Date().toISOString();onProgress({...job});if(signal?.aborted)break;}
  }
  // Failed files never become publishable; their jobs remain inspectable.
  const valid=new Set(result.jobs.filter(j=>j.status==='manual_review').flatMap(j=>j.asset_ids));
  result.assets=result.assets.filter(a=>valid.has(a.id));result.pages=result.pages.filter(p=>valid.has(p.asset_id));
  return result;
}

export interface PublishInput {
  material:{title:string,level:string,edition:string};unit_title:string;section_type:string;
  pages:SourcePage[];assets:SourceAsset[];jobs:ImportJob[];
  entries:Array<{type:'vocabulary'|'target_expression';expression:string;meaning:string;page_id:string;evidence:string}>;
  lesson?:{actual_date?:string;duration_minutes:number;notes:string};
}
export function previewImportDiff(s:Snapshot,input:PublishInput):Array<{expression:string;kind:'new'|'unchanged'|'modified';before?:string;after:string}>{
 const material=s.materials.find(m=>normalize(m.title)===normalize(input.material.title)&&normalize(m.level)===normalize(input.material.level)&&normalize(m.edition)===normalize(input.material.edition));
 const unit=material&&s.units.find(u=>u.material_id===material.id&&normalize(u.title)===normalize(input.unit_title));
 return input.entries.map(e=>{const old=unit&&s.skills.find(k=>k.unit_id===unit.id&&k.type===e.type&&normalize(k.canonical_expression||k.title)===normalize(e.expression));return {expression:e.expression,kind:old?(old.goal===e.meaning&&old.source_evidence===e.evidence?'unchanged':'modified'):'new',before:old?.goal,after:e.meaning};});
}
const entrySchema=z.object({type:z.enum(['vocabulary','target_expression']),expression:z.string().trim().min(1).max(500),meaning:z.string().trim().min(1).max(1000),page_id:z.string().min(1),evidence:z.string().trim().min(1).max(5000)});
export function publishImport(s:Snapshot,input:PublishInput):void {
  const identity=z.object({title:z.string().trim().min(1),level:z.string().trim().min(1),edition:z.string().trim().min(1)}).parse(input.material);
  if(!input.unit_title.trim())throw Error('请核对单元名称');if(!input.pages.length)throw Error('没有可发布的新页面');
  const entries=z.array(entrySchema).min(1).parse(input.entries);const pageIds=new Set(input.pages.map(p=>p.id));
  if(entries.some(e=>!pageIds.has(e.page_id)))throw Error('知识点缺少有效来源页面');
  if(input.pages.some(p=>p.printed_page_number!=null&&(!Number.isInteger(p.printed_page_number)||p.printed_page_number<0)))throw Error('印刷页码须为非负整数；未知请留空');
  const now=new Date().toISOString();const mid=stableId('material',identity.title,identity.level,identity.edition);const uid=stableId('unit',mid,input.unit_title);
  let material=s.materials.find(m=>normalize(m.title)===normalize(identity.title)&&normalize(m.level)===normalize(identity.level)&&normalize(m.edition)===normalize(identity.edition));
  if(!material){material={id:mid,...identity,created_at:now,source_kind:'textbook',review_status:'verified'} as Material;s.materials.push(material);}
  const actualMid=material.id;let unit=s.units.find(u=>u.material_id===actualMid&&normalize(u.title)===normalize(input.unit_title));
  if(!unit){unit={id:uid,material_id:actualMid,title:input.unit_title.trim(),printed_page_range:null,source_page_ids:[],review_status:'verified'} as Unit;s.units.push(unit);}
  for(const asset of input.assets){const previous=s.assets.find(a=>a.file_hash===asset.file_hash);if(previous&&previous.material_id!==actualMid)throw Error('同一文件已归属另一教材版本，请核对书名与版本');if(!previous)s.assets.push({...asset,material_id:actualMid});}
  const remap=new Map<string,string>();
  for(const page of input.pages){
    // Repeated pages across files: reuse exact pixel hash only within same book edition.
    const old=s.pages.find(p=>p.id===page.id||(page.content_hash&&p.content_hash===page.content_hash&&s.assets.find(a=>a.id===p.asset_id)?.material_id===actualMid));
    if(old){remap.set(page.id,old.id);if(old.printed_page_number!==page.printed_page_number){s.audit.push({id:makeId('audit'),timestamp:now,action:'source_page_correction',entity_id:old.id,detail:JSON.stringify({before:old.printed_page_number,after:page.printed_page_number})});old.printed_page_number=page.printed_page_number;}if(!unit.source_page_ids.includes(old.id))unit.source_page_ids.push(old.id);}
    else{remap.set(page.id,page.id);s.pages.push({...page,unit_id:unit.id,ocr_status:page.ocr_status==='manual_required'?'complete':page.ocr_status,source_confidence:1});unit.source_page_ids.push(page.id);}
  }
  const nums=s.pages.filter(p=>unit!.source_page_ids.includes(p.id)).map(p=>p.printed_page_number).filter((p):p is number=>p!=null);unit.printed_page_range=nums.length?[Math.min(...nums),Math.max(...nums)]:null;
  const sectionId=stableId('section',unit.id,input.section_type);let section=s.sections.find(x=>x.id===sectionId);
  if(!section){section={id:sectionId,unit_id:unit.id,material_id:actualMid,title:input.section_type||'教材页',section_type:input.section_type||'unknown',printed_page_range:unit.printed_page_range,source_page_ids:[],review_status:'verified'} as Section;s.sections.push(section);}
  for(const p of unit.source_page_ids)if(!section.source_page_ids.includes(p))section.source_page_ids.push(p);
  const created:string[]=[];
  for(const entry of entries){
    const pageId=remap.get(entry.page_id)!;const sid=stableId('skill',actualMid,unit.id,entry.type,entry.expression);
    let skill=s.skills.find(k=>k.id===sid||(k.unit_id===unit!.id&&k.type===entry.type&&normalize(k.canonical_expression||k.title)===normalize(entry.expression)));
    if(skill){
      if(skill.goal!==entry.meaning||!skill.source_page_ids.includes(pageId)||skill.source_evidence!==entry.evidence){
        s.audit.push({id:makeId('audit'),timestamp:now,action:'skill_version',entity_id:skill.id,detail:JSON.stringify({previous:skill,reason:'家长核对增量教材'})});
        skill.version++;skill.goal=entry.meaning;skill.source_evidence=entry.evidence;if(!skill.source_page_ids.includes(pageId))skill.source_page_ids.push(pageId);
        const regenerated=generateTasks(skill);for(const task of regenerated)if(!s.tasks.some(t=>t.id===task.id))s.tasks.push(task);
      }
    }else{
      skill={id:sid,unit_id:unit.id,title:entry.expression,type:entry.type,canonical_expression:entry.expression,words:entry.type==='vocabulary'?[entry.expression]:[],goal:entry.meaning,source_page_ids:[pageId],origin:'source',review_status:'verified',version:1,source_evidence:entry.evidence,confidence:1} as Skill;
      s.skills.push(skill);s.tasks.push(...generateTasks(skill));created.push(sid);
    }
  }
  if(input.lesson){
    if(input.lesson.actual_date&&!/^\d{4}-\d{2}-\d{2}$/.test(input.lesson.actual_date))throw Error('授课日期格式应为 YYYY-MM-DD，未知请留空');
    if(!Number.isFinite(input.lesson.duration_minutes)||input.lesson.duration_minutes<=0||input.lesson.duration_minutes>240)throw Error('课时长度应在1–240分钟之间');
    const ids=[...new Set([...remap.values()])];const lessonId=stableId('lesson',actualMid,input.lesson.actual_date||'unknown',...ids.sort());
    if(!s.lessons.some(l=>l.id===lessonId))s.lessons.push({id:lessonId,actual_date:input.lesson.actual_date||undefined,date_known:!!input.lesson.actual_date,duration_minutes:input.lesson.duration_minutes,material_id:actualMid,source_page_ids:ids,skill_ids:s.skills.filter(k=>k.source_page_ids.some(p=>ids.includes(p))).map(k=>k.id),notes:input.lesson.notes,created_at:now});
  }
  for(const job of input.jobs){const published={...job,asset_ids:job.asset_ids.filter(id=>s.assets.some(a=>a.id===id)),status:job.status==='failed'||job.status==='cancelled'?job.status:'published',progress:1,created_candidate_ids:created,finished_at:now} as ImportJob;const idx=s.jobs.findIndex(j=>j.id===job.id);if(idx<0)s.jobs.push(published);else s.jobs[idx]=published;}
  s.audit.push({id:makeId('audit'),timestamp:now,action:'material_publish',entity_id:actualMid,detail:`已核对 ${entries.length} 项；新增 ${created.length} 项；历史观察保留`});
}

export async function previewUrl(ref?:string|null):Promise<string|undefined>{if(!ref)return undefined;if(ref.startsWith('/'))return ref;const blob=await getBlob(ref);return blob?URL.createObjectURL(blob):undefined;}
