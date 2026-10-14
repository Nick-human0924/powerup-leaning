"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Eye, Lightbulb, Mic, Square, Volume2 } from "lucide-react";
import type { Outcome, Snapshot } from "@/lib/schema";
import { mutateSnapshot } from "@/lib/db";
import { makeId, questionForTask, recordObservation } from "@/lib/domain";
import { recommend } from "@/lib/recommendations";
import type { PracticeMode } from "./types";
import { DurationPicker } from "./HomeView";
import { EmptyState, Overline, StatusPill } from "./ui";
import { publicDemo } from "@/lib/runtime";

type SpeechRecognitionCtor = new () => { lang: string; interimResults: boolean; start():void; stop():void; onresult:((e:{results:ArrayLike<{0:{transcript:string}}>} )=>void)|null; onerror:((e:{error:string})=>void)|null; onend:(()=>void)|null };

export function PracticeView({ snapshot, refresh, mode, setMode, minutes, setMinutes }: { snapshot: Snapshot; refresh:()=>Promise<void>; mode:PracticeMode; setMode:(m:PracticeMode)=>void; minutes:number; setMinutes:(n:number)=>void }) {
  const [queue,setQueue] = useState(() => recommend(snapshot, minutes).map((x) => x.task));
  const [index, setIndex] = useState(0), [hinted, setHinted] = useState(false), [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState(""), [listening, setListening] = useState(false), [speechConsent, setSpeechConsent] = useState(false);
  const [message, setMessage] = useState(""), [saving, setSaving] = useState(false), [done, setDone] = useState(false);
  const startedAt = useRef(new Date()); const sessionId = useRef(makeId("practice"));
  const recognition = useRef<InstanceType<SpeechRecognitionCtor>|null>(null);
  const finalized = useRef(false);
  const exposures=useRef(new Map<string,{hinted:boolean;revealed:boolean}>());
  const mountGeneration = useRef(0);
  const availableTasks=snapshot.tasks.filter(t=>!snapshot.tasks.some(other=>other.version>t.version&&other.skill_ids.some(id=>t.skill_ids.includes(id))));
  const task = queue[index], skill = task && snapshot.skills.find((s) => task.skill_ids.includes(s.id));
  const taskPages = task ? snapshot.pages.filter((p) => task.source_page_ids.includes(p.id)) : [];
  const selectTask = (taskId:string) => {
    const chosen = snapshot.tasks.find((t) => t.id === taskId); if (!chosen) return;
    const next = queue.some((t) => t.id === chosen.id) ? queue : [chosen,...queue];
    setQueue(next); setIndex(next.findIndex((t) => t.id === chosen.id)); resetCard(); const exposure=exposures.current.get(chosen.id);setHinted(exposure?.hinted??false);setRevealed(exposure?.revealed??false);
    void mutateSnapshot((draft) => { const session=draft.sessions.find((s)=>s.id===sessionId.current); if(session&&!session.task_ids.includes(chosen.id))session.task_ids.push(chosen.id); });
  };

  useEffect(() => {
    if (!queue.length) return;
    const generation = ++mountGeneration.current;
    void mutateSnapshot((draft) => { if (!draft.sessions.some((s) => s.id === sessionId.current)) draft.sessions.push({ id: sessionId.current, mode, started_at: startedAt.current.toISOString(), task_ids: queue.map((t) => t.id), status: "in_progress" }); });
    return () => {
      if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel(); recognition.current?.stop();
      setTimeout(() => {
        if (!finalized.current && mountGeneration.current === generation) { const ended = new Date(); void mutateSnapshot((draft) => { const session = draft.sessions.find((s) => s.id === sessionId.current); if (session && session.status === "in_progress") { session.status = "abandoned"; session.ended_at = ended.toISOString(); session.duration_seconds = Math.max(0,Math.round((ended.getTime()-startedAt.current.getTime())/1000)); } }); }
      },0);
    };
  // A practice run intentionally freezes its mode and task queue.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetCard = () => { setHinted(false); setRevealed(false); setTyped(""); setMessage(""); };
  const closeSession = async (status: "completed" | "abandoned") => {
    if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel(); recognition.current?.stop();
    const ended = new Date();
    await mutateSnapshot((draft) => {
      let session = draft.sessions.find((s) => s.id === sessionId.current);
      if (!session) { session = { id: sessionId.current, mode, started_at: startedAt.current.toISOString(), task_ids: queue.slice(0, Math.max(index + 1, 1)).map(t => t.id), status }; draft.sessions.push(session); }
      session.ended_at = ended.toISOString(); session.duration_seconds = Math.max(0, Math.round((ended.getTime() - startedAt.current.getTime()) / 1000)); session.status = status;
    });
    finalized.current = true; setDone(true); await refresh();
  };
  const grade = async (requested: Outcome) => {
    if (!task || !skill) return; setSaving(true);
    const outcome: Outcome = requested === "independent" && (hinted || revealed) ? "prompted" : requested;
    try {
      await mutateSnapshot((draft) => {
        let session = draft.sessions.find((s) => s.id === sessionId.current);
        if (!session) { session = { id: sessionId.current, mode, started_at: startedAt.current.toISOString(), task_ids: queue.map(t => t.id), status: "in_progress" }; draft.sessions.push(session); }
        recordObservation(draft, { skill_id: skill.id, practice_session_id: session.id, outcome, evidence: typed.trim() ? `孩子输入：${typed.trim()}` : `家长手动评分：${outcome}`, source: mode === "child" ? "child_interaction" : "parent_report", prompt_shown: hinted, answer_revealed: revealed, confidence: 1, verified_by_parent: true });
      });
      if (index + 1 >= queue.length) await closeSession("completed"); else { setIndex(index + 1); resetCard(); await refresh(); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "保存失败"); }
    finally { setSaving(false); }
  };
  const speak = () => { if (!task || !("speechSynthesis" in window)) { setMessage("当前浏览器不支持朗读，请直接看题。 "); return; } speechSynthesis.cancel(); const utterance=new SpeechSynthesisUtterance(questionForTask(task,skill));utterance.lang="en-GB";speechSynthesis.speak(utterance); };
  const listen = () => {
    if (!speechConsent) { setMessage("请先确认浏览器语音服务可能联网。也可以直接打字。 "); return; }
    const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { setMessage("当前浏览器不支持语音转文字，请使用键盘输入。 "); return; }
    if (listening) { recognition.current?.stop(); return; }
    const rec = new Ctor(); recognition.current=rec; rec.lang = "en-US"; rec.interimResults = false; rec.onresult = (e) => setTyped(e.results[0][0].transcript); rec.onerror = () => setMessage("没有收到清楚的语音。不会自动记为答错。 "); rec.onend = () => setListening(false); try{setListening(true); rec.start();}catch{setListening(false);setMessage("未能启动语音，请改用文字或手动核对。")}
  };

  if (!queue.length) return <div className="view-stack"><EmptyState title="还没有练习题">发布经过核对的教材知识点后，练习会自动出现在这里。</EmptyState></div>;
  if (done) return <div className="completion-card"><span>✓</span><Overline>SESSION SAVED</Overline><h1>这次练习已保存</h1><p>练习时间按实际经过时间记录，已评分的每一题都已即时写入学习档案。</p></div>;
  return <div className={`view-stack practice-view ${mode}`}>
    <div className="practice-toolbar"><button className="icon-button" onClick={() => void closeSession("abandoned")} aria-label="结束并保存"><ArrowLeft /></button><div className="segmented"><button className="active" disabled>{mode === "parent" ? "家长带练" : "孩子练习"}</button><button disabled>{minutes} 分钟计划</button></div><button className="text-button" onClick={() => void closeSession("abandoned")}>结束</button></div>
    <div className="practice-pickers"><label>指定单元<select value={skill?.unit_id??""} onChange={e=>{const first=availableTasks.find(t=>t.skill_ids.some(id=>snapshot.skills.find(s=>s.id===id)?.unit_id===e.target.value));if(first)selectTask(first.id)}}>{snapshot.units.filter(u=>snapshot.tasks.some(t=>t.skill_ids.some(id=>snapshot.skills.find(s=>s.id===id)?.unit_id===u.id))).map(u=><option key={u.id} value={u.id}>{u.title}</option>)}</select></label><label>换一道题<select value={task?.id??""} onChange={e=>selectTask(e.target.value)}>{availableTasks.map(t=><option key={t.id} value={t.id}>{snapshot.skills.find(s=>t.skill_ids.includes(s.id))?.goal??t.scenario}</option>)}</select></label></div>
    <div className="practice-progress"><div>{queue.map((_,i) => <i key={i} className={i <= index ? "done" : ""} />)}</div><span>{index + 1} / {queue.length}</span></div>
    <article className="task-card">
      <div className="task-meta"><Overline>{mode === "parent" ? (publicDemo?"先让孩子自己想":"先让安哲自己想") : "ONE QUESTION"}</Overline><StatusPill>{task.origin === "derived" ? "基于教材的练习" : "教材练习"} · {taskPages.map(p=>p.printed_page_number?`p.${p.printed_page_number}`:"页码未知").join(" / ")}</StatusPill></div>
      <p className="scenario">{task.scenario}</p><h1>{questionForTask(task,skill)}</h1>
      {questionForTask(task,skill)!==task.prompt&&<p className="instruction">情境：{task.prompt.replace(/^(?:生活)?情境：/u,"")}</p>}
      {mode === "parent" ? <p className="instruction">给家长：{task.parent_instruction}</p> : <button className="listen-button" onClick={speak}><Volume2 /> 听题</button>}
      <div className="assist-actions"><button onClick={() => {setHinted(true);exposures.current.set(task.id,{hinted:true,revealed})}}><Lightbulb />给一点提示</button><button onClick={() => {setRevealed(true);exposures.current.set(task.id,{hinted,revealed:true})}}><Eye />查看参考表达</button></div>
      {hinted && <div className="answer-panel"><small>提示已使用 · 本题最多记为“提示后说出”</small><p>{task.hint_levels[0] ?? "用自己的话再试一次。"}</p></div>}
      {revealed && <div className="answer-panel reveal"><small>参考表达已显示 · 不再记为独立</small>{task.expected_answers.map((x) => <p key={x}>{x}</p>)}</div>}
    </article>
    {mode === "child" && <section className="child-answer"><label htmlFor="child-answer">把听到的回答写下来</label><div className="answer-input"><input id="child-answer" value={typed} onChange={(e)=>setTyped(e.target.value)} placeholder="Type your answer…" /><button className={listening ? "recording" : ""} onClick={listen} aria-label="用语音输入">{listening ? <Square /> : <Mic />}</button></div><label className="check-row"><input type="checkbox" checked={speechConsent} onChange={e=>setSpeechConsent(e.target.checked)} />我知道浏览器语音识别可能使用在线服务，并同意这次使用</label><p>文字或转写只是回答证据，不会自动判断对错。请由家长核对后评分。</p></section>}
    <section className="grading"><strong>{mode === "child" ? "请家长核对这次回答" : (publicDemo?"孩子刚才表现怎样？":"安哲刚才表现怎样？")}</strong><div className="grade-grid"><button disabled={saving} onClick={()=>void grade("independent")}><Check />独立说出</button><button disabled={saving} onClick={()=>void grade("prompted")}><Lightbulb />提示后说出</button><button disabled={saving} onClick={()=>void grade("miss")}>○ 暂时不会</button><button disabled={saving} onClick={()=>void grade("not_tested")}>— 未测</button></div></section>
    {message && <p className="inline-message" role="status">{message}</p>}
  </div>;
}
