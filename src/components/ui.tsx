import type { ReactNode } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { publicDemo } from "@/lib/runtime";

export function Overline({ children }: { children: ReactNode }) {
  const labels: Record<string, string> = {
    "SESSION SAVED": "练习已保存",
    "FEEDBACK SAVED": "反馈已保存",
    "ONE QUESTION": "一次一题",
    "QUICK NOTE": "反馈记录",
    "LEARNING LOG": "学习记录",
    "THIS WEEK": "本周回顾",
  };
  return <div className="overline">{typeof children === "string" ? (labels[children] ?? children) : children}</div>;
}

export function SectionTitle({ eyebrow, title, aside }: { eyebrow?: string; title: ReactNode; aside?: ReactNode }) {
  return (
    <div className="section-title">
      <div>{eyebrow && <Overline>{eyebrow}</Overline>}<h2>{title}</h2></div>
      {aside && <div className="section-aside">{aside}</div>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty-state"><div className="empty-mark">A</div><strong>{title}</strong><p>{children}</p></div>;
}

export function LoadingState() {
  return <div className="state-card" role="status"><LoaderCircle className="spin" />{publicDemo?"正在打开演示档案…":"正在打开安哲的学习档案…"}</div>;
}

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <div className="state-card error" role="alert"><AlertCircle /><div><strong>暂时打不开学习档案</strong><p>{message}</p><button className="button secondary" onClick={retry}>重新尝试</button></div></div>;
}

export function StatusPill({ tone = "neutral", children }: { tone?: "good" | "warm" | "neutral" | "danger"; children: ReactNode }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}
