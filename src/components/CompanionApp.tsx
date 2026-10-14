"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, ClipboardList, Home, MessageCircleMore, Play } from "lucide-react";
import { loadSnapshot } from "@/lib/db";
import { FeedbackView } from "./FeedbackView";
import { HomeView } from "./HomeView";
import { MaterialsView } from "./MaterialsView";
import { PracticeView } from "./PracticeView";
import { RecordsView } from "./RecordsView";
import { ErrorState, LoadingState } from "./ui";
import { OfflineBadge, useServiceStatus } from "./ServiceStatus";
import type { PracticeMode, SnapshotState, TabKey } from "./types";
import { publicDemo } from "@/lib/runtime";

const tabs = [
  ["home", "今日", Home], ["materials", "教材", BookOpen], ["practice", "练习", Play],
  ["feedback", "反馈", MessageCircleMore], ["records", "记录", ClipboardList],
] as const;

export function CompanionApp() {
  const [tab, setTab] = useState<TabKey>("home");
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("parent");
  const [minutes, setMinutes] = useState(3);
  const [today, setToday] = useState("");
  const [state, setState] = useState<SnapshotState>({ status: "loading" });
  const { online, capabilities } = useServiceStatus();
  const refresh = useCallback(async () => {
    setState((current) => current.status === "ready" ? current : { status: "loading" });
    try { setState({ status: "ready", data: await loadSnapshot() }); }
    catch (error) { setState((current) => current.status === "ready" ? current : { status: "error", message: error instanceof Error ? error.message : "未知错误" }); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const update=()=>setToday(new Intl.DateTimeFormat("zh-CN",{month:"numeric",day:"numeric",weekday:"short"}).format(new Date()));
    update();const timer=setInterval(update,60_000);return()=>clearInterval(timer);
  },[]);

  const begin = (mode: PracticeMode, duration = minutes) => { setPracticeMode(mode); setMinutes(duration); setTab("practice"); };
  return (
    <div className="app-shell">
      <header className="masthead"><button className="brand" onClick={() => setTab("home")} aria-label="返回今日"><span className="brand-mark">A</span><strong>{publicDemo?"英语小课堂":"安哲英语"}</strong></button><div className="masthead-meta"><time>{today}</time><OfflineBadge online={online} /></div></header>
      <main className="app-main">
        {publicDemo && <p className="public-demo-note" role="note">公开演示 · 使用示例内容，记录仅存于当前浏览器</p>}
        {state.status === "loading" && <LoadingState />}
        {state.status === "error" && <ErrorState message={state.message} retry={refresh} />}
        {state.status === "ready" && <>
          {tab === "home" && <HomeView snapshot={state.data} minutes={minutes} setMinutes={setMinutes} begin={begin} openMaterials={() => setTab("materials")} />}
          {tab === "materials" && <MaterialsView snapshot={state.data} refresh={refresh} capabilities={capabilities} />}
          {tab === "practice" && <PracticeView snapshot={state.data} refresh={refresh} mode={practiceMode} setMode={setPracticeMode} minutes={minutes} setMinutes={setMinutes} />}
          {tab === "feedback" && <FeedbackView snapshot={state.data} refresh={refresh} capabilities={capabilities} />}
          {tab === "records" && <RecordsView snapshot={state.data} refresh={refresh} capabilities={capabilities} />}
        </>}
      </main>
      <nav className="bottom-nav" aria-label="主要页面">{tabs.map(([key,label,Icon]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)} aria-current={tab === key ? "page" : undefined}><Icon /><span>{label}</span></button>)}</nav>
    </div>
  );
}
