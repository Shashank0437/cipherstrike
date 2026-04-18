"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

type Msg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    const list = await api<Msg[]>("/chat/messages");
    setMessages(list);
  }

  useEffect(() => {
    void load().catch(() => setMessages([]));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await api<Msg>("/chat/messages", {
        method: "POST",
        json: { content: input.trim() },
      });
      setInput("");
      await load();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div>
        <h1 className="text-2xl font-medium text-[#30323e]">Agentic chat</h1>
        <p className="text-sm text-[#5d5e6c]">Light mode — no agents pinned (connect from workspace).</p>
      </div>
      <div className="mt-6 flex flex-1 flex-col overflow-hidden rounded-xl border border-[#e4e2ef] bg-white">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-[#684cb6] text-white"
                    : "bg-[#f4f2fe] text-[#30323e]"
                }`}
              >
                <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={send} className="border-t border-[#e4e2ef] p-3">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message CipherStrike…"
              className="flex-1 rounded-lg border border-[#b1b1c0] px-3 py-2 text-sm outline-none ring-[#684cb6]/30 focus:ring-2"
            />
            <button
              type="submit"
              disabled={sending}
              className="rounded-lg bg-[#684cb6] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
