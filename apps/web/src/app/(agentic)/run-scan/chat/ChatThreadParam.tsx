"use client";

import { useSearchParams } from "next/navigation";
import { AgenticChatView } from "@/components/agentic/AgenticChatView";

export function ChatThreadParam() {
  const t = useSearchParams().get("t");
  if (!t) return null;
  return <AgenticChatView key={t} threadId={t} />;
}
