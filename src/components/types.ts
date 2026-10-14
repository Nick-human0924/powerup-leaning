import type { Snapshot } from "@/lib/schema";

export type TabKey = "home" | "materials" | "practice" | "feedback" | "records";
export type PracticeMode = "parent" | "child";
export type SnapshotState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: Snapshot };

export type Capabilities = {
  vision: boolean;
  structuring: boolean;
  asr: boolean;
  tts: boolean;
};
