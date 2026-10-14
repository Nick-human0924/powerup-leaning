"use client";

import Image from "next/image";
import { ArrowRight, BookMarked } from "lucide-react";
import type { Snapshot } from "@/lib/schema";
import { recommend } from "@/lib/recommendations";
import { mastery } from "@/lib/domain";
import type { PracticeMode } from "./types";
import { EmptyState } from "./ui";
import { appPath, publicDemo } from "@/lib/runtime";

export function DurationPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return <div className="duration-picker" aria-label="选择练习时长">{[2,3,5,10].map((n) => <button key={n} onClick={() => onChange(n)} className={value === n ? "active" : ""} aria-pressed={value === n}>{n}<span>分钟</span></button>)}</div>;
}

export function HomeView({ snapshot, minutes, setMinutes, begin, openMaterials }: { snapshot: Snapshot; minutes: number; setMinutes: (n:number)=>void; begin:(m:PracticeMode,n?:number)=>void; openMaterials:()=>void }) {
  const picks = recommend(snapshot, minutes);
  const first = picks[0];
  const unit = first && snapshot.units.find(u=>u.id===first.skill.unit_id);
  const material = unit && snapshot.materials.find(m=>m.id===unit.material_id);
  const sourcePages = first ? snapshot.pages.filter((p) => first.skill.source_page_ids.includes(p.id)) : [];
  const weekAgo = Date.now() - 7 * 86400000;
  const practiced = snapshot.sessions.filter((s) => new Date(s.started_at).getTime() >= weekAgo).reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
  const weekMinutes = Math.round(practiced / 60);
  const weak = snapshot.skills.filter((s) => mastery(s.id,snapshot).status === "needs_practice").slice(0,2);
  return <div className="view-stack home-view design-v2">
    <header className="home-intro"><h1>今天，开口说一点</h1><p>有空就练几分钟，记录每次真实表现。</p></header>
    {first ? <section className="recommend-card">
      <Image className="recommend-art" src={appPath("/visuals/hero-learning-v2.png")} alt="" fill priority quality={80} sizes="(min-width: 700px) 520px, calc(100vw - 36px)" />
      <div className="recommend-shade" aria-hidden="true" />
      <div className="recommend-copy">
        <span className="recommend-label">今日推荐 · {minutes} 分钟</span>
        <h2>{first.skill.goal}</h2>
        <p className="recommend-reason">{first.reason}</p>
        <button className="recommend-source" onClick={openMaterials} aria-label={`查看教材来源：${material?.title} · ${unit?.title} · ${first.skill.title}`}><span>{material?.title.replace(/^Cambridge\s+/u,"")} · {publicDemo?"演示单元":unit?.order===0?"Hello":unit?.order?`Unit ${unit.order}`:unit?.title}</span><span>{publicDemo?"示例卡片":sourcePages.length ? sourcePages.map(p => p.printed_page_number ? `p.${p.printed_page_number}` : `PDF ${p.pdf_page_index ?? "?"}`).join(" / ") : "来源待核对"}</span><ArrowRight /></button>
      </div>
    </section> : <div className="home-empty"><EmptyState title="还没有可推荐的练习">发布一个经过核对的知识点后，这里会显示真实推荐。两种练习方式仍可进入查看。</EmptyState><button className="button secondary" onClick={openMaterials}>去教材页查看</button></div>}
    <section className="quick-start">
      <div className="quick-start-heading"><h2>选一种方式开始</h2><span>约 {minutes} 分钟</span></div>
      <div className="mode-grid">
        <button className="mode-card parent" onClick={() => begin("parent")} aria-label={publicDemo?"我带孩子练，开始家长带练":"我带安哲练，开始家长带练"}><Image className="mode-art" src={appPath("/visuals/parent-guide-v2.png")} alt="" width={120} height={120} quality={80} loading="eager" sizes="(min-width: 700px) 120px, 96px" /><span><strong>{publicDemo?"我带孩子练":"我带安哲练"}</strong><small>先提问，再记录真实表现</small></span><i><ArrowRight /></i></button>
        <button className="mode-card child" onClick={() => begin("child")} aria-label={publicDemo?"孩子自己练，开始自主练习":"安哲自己练，开始自主练习"}><Image className="mode-art" src={appPath("/visuals/child-practice-v2.png")} alt="" width={120} height={120} quality={80} loading="eager" sizes="(min-width: 700px) 120px, 96px" /><span><strong>{publicDemo?"孩子自己练":"安哲自己练"}</strong><small>一次一题，可听题或打字</small></span><i><ArrowRight /></i></button>
      </div>
    </section>
    <section className="home-settings" aria-labelledby="duration-title">
      <div className="quick-start-heading"><h2 id="duration-title">这次练多久？</h2><span>随时可以结束并保存</span></div>
      <DurationPicker value={minutes} onChange={setMinutes} />
    </section>
    <section className="week-card"><div className="week-card-head"><div><strong>本周已练 {weekMinutes} 分钟</strong><p>参考目标 30 分钟，按实际练习时间累计。</p></div><b>{Math.min(100, Math.round(weekMinutes / 30 * 100))}%</b></div><div className="week-meter" aria-label={`本周完成 ${Math.min(100, Math.round(weekMinutes / 30 * 100))}%`}><i style={{ width: `${Math.min(100, weekMinutes / 30 * 100)}%` }} /></div><p>{weak.length?`需要巩固：${weak.map(s=>s.title).join("、")}`:"目前没有已确认的薄弱点；未测内容仍保持未测。"}</p><button onClick={openMaterials}><BookMarked />查看教材范围</button></section>
  </div>;
}
