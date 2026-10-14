"use client";

import { useEffect, useState } from "react";
import { CloudOff, WifiOff } from "lucide-react";
import type { Capabilities } from "./types";

export function useServiceStatus() {
  const [online, setOnline] = useState(true);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    fetch("/api/capabilities").then((r) => r.ok ? r.json() : null).then(setCapabilities).catch(() => setCapabilities(null));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return { online, capabilities };
}

export function OfflineBadge({ online }: { online: boolean }) {
  if (online) return <span className="sr-only" role="status">当前在线</span>;
  return <span className="network-badge offline" role="status"><WifiOff />离线可用</span>;
}

export function ProviderStatus({ capabilities }: { capabilities: Capabilities | null }) {
  const configured = capabilities && (capabilities.vision || capabilities.structuring || capabilities.asr || capabilities.tts);
  return <div className="provider-status"><CloudOff /><div><strong>{configured ? "可选服务已配置 · 尚需实际验证" : "云端识别未配置"}</strong><p>{configured ? `图片识别 ${capabilities?.vision ? "已配置" : "未配置"} · 文本整理 ${capabilities?.structuring ? "已配置" : "未配置"}` : "仍可手动录入、文字反馈和家长评分。系统不会假装完成识别。"}</p></div></div>;
}
