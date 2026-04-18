"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { api } from "@/lib/api";
import { ARSENAL_FALLBACK_TOOLS } from "@/lib/arsenal-fallback-tools";
import { AGENTS, getAgentLabel } from "@/lib/agentic-agents";
import { useAuth } from "@/lib/auth-context";
import { renameChatThread } from "@/lib/run-scan-threads";

const WORKSPACE_PROFILE_IMAGE = "/profile-avatar.png";

function emailInitials(email: string | undefined): string {
  if (!email) return "?";
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  const alnum = local.replace(/[^a-zA-Z0-9]/g, "");
  if (alnum.length >= 2) return alnum.slice(0, 2).toUpperCase();
  return (local.slice(0, 2) || "?").toUpperCase();
}

const UI_PREFIX = "hex-chat-ui-";

/** Session id for `/run-scan` workspace — not listed in Recent chats; never persists transcript here. */
export const AGENTIC_WORKSPACE_THREAD_ID = "__workspace__";

type ChatUiState = {
  ran: boolean;
  userMessage: string;
  outputTime: string;
  selectedAgentId: string;
  disabledToolIds: string[];
  /** Set when user picks an agent from @ mention menu — shown as dark-violet chip in composer. */
  mentionComposerAgentId: string | null;
};

function defaultUi(): ChatUiState {
  return {
    ran: false,
    userMessage: "",
    outputTime: "",
    selectedAgentId: "",
    disabledToolIds: [],
    mentionComposerAgentId: null,
  };
}

function loadUi(threadId: string): ChatUiState {
  if (typeof window === "undefined") return defaultUi();
  if (threadId === AGENTIC_WORKSPACE_THREAD_ID) return defaultUi();
  try {
    const raw = sessionStorage.getItem(UI_PREFIX + threadId);
    if (!raw) return defaultUi();
    const p = JSON.parse(raw) as Partial<ChatUiState> & { ran?: boolean };
    const ran = Boolean(p.ran);
    if (!ran) {
      return defaultUi();
    }
    return {
      ran: true,
      userMessage: typeof p.userMessage === "string" ? p.userMessage : "",
      outputTime: typeof p.outputTime === "string" ? p.outputTime : "",
      selectedAgentId: typeof p.selectedAgentId === "string" ? p.selectedAgentId : "",
      disabledToolIds: Array.isArray(p.disabledToolIds) ? p.disabledToolIds.filter((x) => typeof x === "string") : [],
      mentionComposerAgentId: null,
    };
  } catch {
    return defaultUi();
  }
}

/** Persists transcript when `ran`; composer agent/tools are not restored until a run exists (then frozen for that transcript). */
function saveUi(threadId: string, state: ChatUiState) {
  if (typeof window === "undefined") return;
  if (threadId === AGENTIC_WORKSPACE_THREAD_ID) return;
  const payload = state.ran
    ? {
        ran: true,
        userMessage: state.userMessage,
        outputTime: state.outputTime,
        selectedAgentId: state.selectedAgentId,
        disabledToolIds: state.disabledToolIds,
      }
    : { ran: false };
  sessionStorage.setItem(UI_PREFIX + threadId, JSON.stringify(payload));
}

function extractHost(text: string): string {
  const m = text.match(/https?:\/\/([^/\s]+)/i);
  if (m?.[1]) return m[1];
  const m2 = text.match(/\b([a-z0-9][a-z0-9.-]*\.[a-z]{2,})\b/i);
  return m2?.[1] ?? "target";
}

function threadTitleFromPrompt(prompt: string): string {
  const t = prompt.trim();
  if (!t) return "New chat";
  return t.length > 48 ? `${t.slice(0, 48)}…` : t;
}

const STREAM_MAX = 5;

function shouldPersistChatThread(threadId: string) {
  return threadId !== AGENTIC_WORKSPACE_THREAD_ID;
}

const AGENT_MENTION_CHIP_CLASS =
  "inline-flex max-w-full shrink-0 items-center gap-0.5 rounded-md bg-[#4f378b] px-2 py-1 font-mono text-xs font-semibold tracking-tight text-on-primary shadow-sm";

/** If `text` starts with `@AgentId` for a known agent, return chip label + body for transcript UI. */
function splitLeadingAgentMention(text: string): { chipText: string; body: string } | null {
  const m = text.match(/^(@[A-Za-z0-9_]+)(?:\s+([\s\S]*))?$/);
  if (!m) return null;
  const rawTag = m[1].slice(1);
  const agent = AGENTS.find((a) => a.id === rawTag || a.name === rawTag);
  if (!agent) return null;
  const body = (m[2] ?? "").replace(/^\s+/, "");
  return { chipText: `@${agent.name}`, body };
}

type ToolRow = { id: string; name: string };

type PickerMode = "mention" | "agents" | "tools" | null;

/** Stitch “Initialize Offensive Sequence” home — kept when no run has been executed yet. */
function WorkspaceHome({ onPickTemplate }: { onPickTemplate: (text: string) => void }) {
  const cards: { icon: string; title: string; sub: string; template: string }[] = [
    {
      icon: "language",
      title: "Recon my domain",
      sub: "Passive OSINT and sub-domain enumeration",
      template: "Run passive OSINT and subdomain enumeration on my authorized domain: ",
    },
    {
      icon: "bug_report",
      title: "Analyze target for CVEs",
      sub: "Version detection and vulnerability mapping",
      template: "Analyze this target for CVEs and version-based exposure: ",
    },
    {
      icon: "code_blocks",
      title: "Craft SQLi Payload",
      sub: "Tailored bypass strings for specific DB engines",
      template: "Craft SQLi bypass payloads for the following context: ",
    },
    {
      icon: "radar",
      title: "Network Scan",
      sub: "Stealth port scanning and service fingerprinting",
      template: "Plan a stealth port scan and service fingerprint for: ",
    },
  ];
  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-2 pb-1">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-container text-primary">
          <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            hub
          </span>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-on-surface">Initialize Offensive Sequence</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-on-surface-variant">
          Deploy specialized agents to perform deep reconnaissance, vulnerability analysis, or automated exploit
          crafting.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {cards.map((c) => (
          <button
            key={c.title}
            type="button"
            onClick={() => onPickTemplate(c.template)}
            className="group flex w-full items-start gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 text-left transition hover:border-primary/60 hover:bg-surface-container-low"
          >
            <div className="rounded-lg bg-surface-container p-2 transition-colors group-hover:bg-primary-container">
              <span className="material-symbols-outlined text-primary">{c.icon}</span>
            </div>
            <div>
              <div className="text-sm font-bold text-on-surface">{c.title}</div>
              <div className="mt-1 text-xs text-on-surface-variant">{c.sub}</div>
            </div>
          </button>
        ))}
      </div>
      <p className="text-center text-xs leading-snug text-on-surface-variant">
        Use <span className="font-semibold text-on-surface">@</span> in the prompt for agents & tools, or the{" "}
        <span className="font-semibold text-on-surface">@ Agent</span> / <span className="font-semibold text-on-surface">+ Tool</span>{" "}
        buttons — then <span className="font-semibold text-on-surface">Execute</span>.
      </p>
    </div>
  );
}

export function AgenticChatView({
  threadId,
  workspaceLayout,
}: {
  threadId: string;
  workspaceLayout?: boolean;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [profileImgFailed, setProfileImgFailed] = useState(false);
  const profileInitials = useMemo(() => emailInitials(user?.email), [user?.email]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const pickerModeRef = useRef<PickerMode>(null);
  /** First mount with a saved transcript — show all blocks at once (no staged reveal). */
  const restoredSkipStreamRef = useRef(loadUi(threadId).ran);
  const prevRanRef = useRef<boolean | null>(null);

  const [input, setInput] = useState("");
  const [ran, setRan] = useState(() => loadUi(threadId).ran);
  const [userMessage, setUserMessage] = useState(() => loadUi(threadId).userMessage);
  const [outputTime, setOutputTime] = useState(() => loadUi(threadId).outputTime);
  const [selectedAgentId, setSelectedAgentId] = useState(() => loadUi(threadId).selectedAgentId);
  const [disabledToolIds, setDisabledToolIds] = useState(() => loadUi(threadId).disabledToolIds);
  const [mentionComposerAgentId, setMentionComposerAgentId] = useState<string | null>(
    () => loadUi(threadId).mentionComposerAgentId,
  );
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [mentionFilter, setMentionFilter] = useState("");
  const [streamPhase, setStreamPhase] = useState(() => (loadUi(threadId).ran ? STREAM_MAX : 0));

  useEffect(() => {
    pickerModeRef.current = pickerMode;
  }, [pickerMode]);

  useEffect(() => {
    if (!ran) {
      setStreamPhase(0);
      prevRanRef.current = false;
      return;
    }

    if (restoredSkipStreamRef.current) {
      restoredSkipStreamRef.current = false;
      setStreamPhase(STREAM_MAX);
      prevRanRef.current = true;
      return;
    }

    const wasInactive = prevRanRef.current === false;
    prevRanRef.current = true;
    if (!wasInactive) return;

    setStreamPhase(0);
    const delays = [120, 480, 900, 1320, 1780];
    const ids = delays.map((ms, i) =>
      window.setTimeout(() => {
        setStreamPhase(i + 1);
      }, ms),
    );
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [ran]);

  const effectiveTools = useMemo(() => (tools.length > 0 ? tools : ARSENAL_FALLBACK_TOOLS), [tools]);

  const host = useMemo(() => extractHost(userMessage), [userMessage]);

  const userBubbleMention = useMemo(() => splitLeadingAgentMention(userMessage), [userMessage]);

  const enabledTools = useMemo(
    () => effectiveTools.filter((t) => !disabledToolIds.includes(t.id)),
    [effectiveTools, disabledToolIds],
  );

  const enabledToolLabel = useMemo(() => {
    if (!effectiveTools.length) return "Loading…";
    if (enabledTools.length === 0) return "None";
    if (enabledTools.length === effectiveTools.length) return "All tools";
    return enabledTools.map((t) => t.name).join(", ");
  }, [enabledTools, effectiveTools]);

  useEffect(() => {
    void api<ToolRow[]>("/tools")
      .then((list) => {
        setTools(list.map((t) => ({ id: t.id, name: t.name })));
      })
      .catch(() => setTools([]));
  }, []);

  useEffect(() => {
    const ids = new Set(effectiveTools.map((t) => t.id));
    setDisabledToolIds((prev) => prev.filter((id) => ids.has(id)));
  }, [effectiveTools]);

  /** Workspace handoff + ensure bootstrap wins over lazy init for new thread */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("hex-chat-bootstrap");
      if (raw) {
        const data = JSON.parse(raw) as {
          threadId?: string;
          prompt?: string;
          selectedAgentId?: string;
          disabledToolIds?: unknown;
        };
        if (data.threadId === threadId && data.prompt?.trim()) {
          sessionStorage.removeItem("hex-chat-bootstrap");
          const prompt = data.prompt.trim();
          const time = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          const bootAgent =
            typeof data.selectedAgentId === "string" && data.selectedAgentId.trim()
              ? data.selectedAgentId.trim()
              : "";
          const bootDisabled = Array.isArray(data.disabledToolIds)
            ? data.disabledToolIds.filter((x): x is string => typeof x === "string")
            : [];
          restoredSkipStreamRef.current = true;
          setUserMessage(prompt);
          setRan(true);
          setOutputTime(time);
          setInput("");
          setSelectedAgentId(bootAgent);
          setDisabledToolIds(bootDisabled);
          saveUi(threadId, {
            ran: true,
            userMessage: prompt,
            outputTime: time,
            selectedAgentId: bootAgent,
            disabledToolIds: bootDisabled,
            mentionComposerAgentId: null,
          });
          if (shouldPersistChatThread(threadId)) {
            renameChatThread(threadId, threadTitleFromPrompt(prompt));
            window.dispatchEvent(new Event("hex-threads-changed"));
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, [threadId]);

  useEffect(() => {
    if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveUi(threadId, {
        ran,
        userMessage,
        outputTime,
        selectedAgentId,
        disabledToolIds,
        mentionComposerAgentId,
      });
      saveTimer.current = undefined;
    }, 0);
    return () => {
      if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current);
    };
  }, [threadId, ran, userMessage, outputTime, selectedAgentId, disabledToolIds, mentionComposerAgentId]);

  const syncMentionFromValue = useCallback((value: string, cursor: number) => {
    const before = value.slice(0, cursor);
    const m = before.match(/@([a-zA-Z0-9_]*)$/);
    if (m) {
      setPickerMode("mention");
      setMentionFilter(m[1] ?? "");
    } else {
      setMentionFilter("");
      setPickerMode((pm) => (pm === "mention" ? null : pm));
    }
  }, []);

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const v = e.target.value;
      setInput(v);
      const pos = e.target.selectionStart ?? v.length;
      syncMentionFromValue(v, pos);
    },
    [syncMentionFromValue],
  );

  const pickAgent = useCallback(
    (agentId: string, fromMention: boolean) => {
      setSelectedAgentId(agentId);
      if (fromMention) {
        setMentionComposerAgentId(agentId);
        if (textareaRef.current) {
          const el = textareaRef.current;
          const pos = el.selectionStart ?? input.length;
          const before = input.slice(0, pos);
          const after = input.slice(pos);
          const newBefore = before.replace(/@[a-zA-Z0-9_]*$/, "");
          const next = newBefore + after;
          const newPos = newBefore.length;
          setInput(next);
          setPickerMode(null);
          requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(newPos, newPos);
          });
        } else {
          setPickerMode(null);
        }
      } else {
        setMentionComposerAgentId(null);
        setPickerMode(null);
      }
    },
    [input],
  );

  const toggleToolDisabled = useCallback((toolId: string) => {
    setDisabledToolIds((prev) =>
      prev.includes(toolId) ? prev.filter((x) => x !== toolId) : [...prev, toolId],
    );
  }, []);

  const composedPrompt = useMemo(() => {
    const body = input.trim();
    const tag =
      mentionComposerAgentId != null ? `@${getAgentLabel(mentionComposerAgentId)}` : "";
    return [tag, body].filter(Boolean).join(" ").trim();
  }, [input, mentionComposerAgentId]);

  const onExecute = useCallback(() => {
    const msg = composedPrompt;
    if (!msg) return;

    if (threadId === AGENTIC_WORKSPACE_THREAD_ID) {
      const newId = crypto.randomUUID();
      sessionStorage.setItem(
        "hex-chat-bootstrap",
        JSON.stringify({
          threadId: newId,
          prompt: msg,
          selectedAgentId,
          disabledToolIds,
        }),
      );
      setInput("");
      setMentionComposerAgentId(null);
      setPickerMode(null);
      router.push(`/run-scan/chat?t=${encodeURIComponent(newId)}`);
      return;
    }

    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setUserMessage(msg);
    setRan(true);
    setOutputTime(time);
    setInput("");
    setMentionComposerAgentId(null);
    setPickerMode(null);
    saveUi(threadId, {
      ran: true,
      userMessage: msg,
      outputTime: time,
      selectedAgentId,
      disabledToolIds,
      mentionComposerAgentId: null,
    });
    if (shouldPersistChatThread(threadId)) {
      renameChatThread(threadId, threadTitleFromPrompt(msg));
      window.dispatchEvent(new Event("hex-threads-changed"));
    }
  }, [composedPrompt, threadId, selectedAgentId, disabledToolIds, router]);

  const mf = mentionFilter.toLowerCase();
  const filteredAgents = useMemo(
    () =>
      AGENTS.filter(
        (a) =>
          !mf ||
          a.name.toLowerCase().includes(mf) ||
          a.id.toLowerCase().includes(mf) ||
          a.description.toLowerCase().includes(mf),
      ),
    [mf],
  );
  const filteredTools = useMemo(
    () =>
      effectiveTools.filter(
        (t) =>
          !mf || t.id.toLowerCase().includes(mf) || t.name.toLowerCase().includes(mf),
      ),
    [mf, effectiveTools],
  );

  const renderPickerContent = () => {
    if (pickerMode === "tools") {
      return (
        <div className="max-h-72 overflow-y-auto p-2">
          <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-outline">
            Arsenal tools — all on by default; uncheck to exclude
          </p>
          <ul className="space-y-1">
            {effectiveTools.map((t) => {
              const on = !disabledToolIds.includes(t.id);
              return (
                <li key={t.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-container">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleToolDisabled(t.id)}
                      className="rounded border-outline-variant text-primary focus:ring-primary"
                    />
                    <span className="font-medium text-on-surface">{t.name}</span>
                    <span className="truncate text-xs text-on-surface-variant">{t.id}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      );
    }

    if (pickerMode === "agents") {
      return (
        <div className="max-h-72 overflow-y-auto p-2">
          <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-outline">
            Select one agent for this run
          </p>
          <ul className="space-y-0.5">
            {AGENTS.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => pickAgent(a.id, false)}
                  className={
                    selectedAgentId === a.id
                      ? "w-full rounded-md border border-primary/30 bg-primary-container px-2 py-2 text-left text-sm font-semibold text-on-primary-container"
                      : "w-full rounded-md px-2 py-2 text-left text-sm text-on-surface hover:bg-surface-container"
                  }
                >
                  <span className="font-mono text-xs font-bold text-primary">{a.name}</span>
                  <span className="mt-0.5 block text-xs text-on-surface-variant">{a.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (pickerMode === "mention") {
      return (
        <div className="grid max-h-[min(24rem,50vh)] grid-cols-1 divide-y divide-outline-variant sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="min-h-0 max-h-[min(24rem,50vh)] overflow-y-auto p-2">
            <p className="sticky top-0 bg-surface-container-lowest px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-primary">
              Agents
            </p>
            <ul className="space-y-0.5">
              {filteredAgents.length === 0 ? (
                <li className="px-2 py-1 text-xs text-on-surface-variant">No matching agents</li>
              ) : (
                filteredAgents.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => pickAgent(a.id, true)}
                      className="w-full rounded-md px-2 py-1.5 text-left hover:bg-surface-container"
                    >
                      <span className="font-mono text-xs font-semibold text-primary">{a.name}</span>
                      <span className="mt-0.5 block text-[11px] text-on-surface-variant">{a.description}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="min-h-0 max-h-[min(24rem,50vh)] overflow-y-auto p-2">
            <p className="sticky top-0 bg-surface-container-lowest px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-primary">
              Tools
            </p>
            <p className="mb-1 px-2 text-[11px] text-on-surface-variant">Tap to toggle off/on for this run</p>
            <ul className="space-y-0.5">
              {filteredTools.length === 0 ? (
                <li className="px-2 py-1 text-xs text-on-surface-variant">No matching tools</li>
              ) : (
                filteredTools.map((t) => {
                  const on = !disabledToolIds.includes(t.id);
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => toggleToolDisabled(t.id)}
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-container"
                      >
                        <span className="text-sm font-medium text-on-surface">{t.name}</span>
                        <span
                          className={
                            on
                              ? "text-[10px] font-bold uppercase text-tertiary"
                              : "text-[10px] font-bold uppercase text-outline"
                          }
                        >
                          {on ? "On" : "Off"}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <main className="flex h-full min-h-0 w-full min-w-0 flex-col bg-background">
      {workspaceLayout ? (
        <>
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-outline-variant bg-surface-container-lowest px-4 py-2.5 sm:px-6">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-lg font-bold tracking-tight text-on-surface">CipherStrike</span>
              <span className="hidden text-outline sm:inline" aria-hidden>
                |
              </span>
              <span className="text-base font-semibold tracking-tight text-on-surface">Agentic Workspace</span>
              <span className="text-[11px] leading-snug text-on-surface-variant sm:text-xs">
                · CipherStrike v1.0.0 — Offensive AI Subsystem
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-high px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-on-surface sm:px-3">
                <span className="h-2 w-2 shrink-0 rounded-full bg-tertiary" aria-hidden />
                System health: Nominal
              </div>
              <div
                className="relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full border border-outline-variant bg-primary shadow-sm ring-2 ring-background"
                title={user?.email ?? "Account"}
                role="img"
                aria-label={user?.email ? `Signed in as ${user.email}` : "Account"}
              >
                {!profileImgFailed ? (
                  <Image
                    src={WORKSPACE_PROFILE_IMAGE}
                    alt=""
                    width={36}
                    height={36}
                    className="h-full w-full object-cover"
                    onError={() => setProfileImgFailed(true)}
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[11px] font-bold uppercase text-on-primary">
                    {profileInitials}
                  </span>
                )}
              </div>
            </div>
          </header>
        </>
      ) : null}

      <div
        className={
          ran
            ? "terminal-scroll mx-auto w-full max-w-4xl flex-1 min-h-0 space-y-8 overflow-y-auto p-8"
            : "terminal-scroll mx-auto w-full max-w-4xl shrink-0 overflow-y-auto px-6 pb-1 pt-4 sm:px-8"
        }
      >
        {!ran ? (
          <WorkspaceHome onPickTemplate={(text) => setInput((prev) => (prev ? `${prev}\n${text}` : text))} />
        ) : (
          <>
            {streamPhase >= 1 ? (
              <div className="agentic-stream-chunk flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-surface-container-highest">
                  <span className="material-symbols-outlined text-sm text-secondary">person</span>
                </div>
                <div className="space-y-2">
                  {userBubbleMention ? (
                    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-2 leading-relaxed">
                      <span className={AGENT_MENTION_CHIP_CLASS}>{userBubbleMention.chipText}</span>
                      {userBubbleMention.body ? (
                        <span className="min-w-0 max-w-full whitespace-pre-wrap text-on-surface">
                          {userBubbleMention.body}
                        </span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed text-on-surface">{userMessage}</p>
                  )}
                  <p className="text-xs text-on-surface-variant">
                    Agent: <span className="font-mono font-semibold text-primary">{getAgentLabel(selectedAgentId)}</span>
                    {" · "}
                    Tools: <span className="font-medium text-on-surface">{enabledToolLabel}</span>
                  </p>
                </div>
              </div>
            ) : null}

            {streamPhase >= 2 ? (
              <div className="agentic-stream-chunk flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary">
                  <span
                    className="material-symbols-outlined text-sm text-on-primary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    smart_toy
                  </span>
                </div>
                <div className="w-full space-y-4">
                  <div className="flex items-center gap-2 font-mono text-xs font-semibold text-primary">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                    {selectedAgentId.trim()
                      ? `${getAgentLabel(selectedAgentId)} thinking...`
                      : "Orchestrator thinking..."}
                  </div>

                  {streamPhase >= 3 ? (
                    <div className="agentic-stream-chunk overflow-hidden rounded-lg border border-outline-variant bg-surface-container-low p-4 font-mono text-xs text-on-surface-variant">
                      <div className="mb-2 flex items-center gap-2 border-b border-outline-variant pb-2 text-on-surface">
                        <span className="material-symbols-outlined text-[14px]">psychology</span>
                        <span className="font-bold">INTERNAL_LOGS</span>
                      </div>
                      <div className="space-y-1">
                        <p>
                          <span className="font-bold text-tertiary">[STRATEGY]</span> Analyzing target: {host}
                        </p>
                        <p>
                          <span className="font-bold text-tertiary">[RESOLVING]</span> Identified login endpoint at
                          /api/v1/auth/login
                        </p>
                        <p>
                          <span className="font-bold text-tertiary">[SELECTION]</span>{" "}
                          {enabledTools.length
                            ? `Arming tools: ${enabledTools.map((t) => t.name).join(", ")}`
                            : "No tools selected — dry analysis only"}
                        </p>
                        <p>
                          <span className="font-bold text-tertiary">[PRE-FLIGHT]</span> Checking network routes and proxy
                          rotation...
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {streamPhase >= 4 ? (
                    <div className="agentic-stream-chunk rounded-r-lg border border-outline-variant border-l-4 border-l-primary bg-surface-container p-6 shadow-sm">
                      <div className="mb-4 flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary">security_update_warning</span>
                        <h4 className="font-bold text-on-surface">Human-in-the-loop: Authorization Required</h4>
                      </div>
                      <p className="mb-6 text-on-surface-variant">
                        Confirm execution of{" "}
                        <code className="rounded bg-surface-container-highest px-1 font-mono text-on-surface">SQLMap</code>{" "}
                        with payload{" "}
                        <code className="rounded bg-surface-container-highest px-1 font-mono text-on-surface">
                          --dbms=mysql --level=3
                        </code>{" "}
                        on {host}?
                      </p>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          className="flex items-center gap-2 rounded-md bg-primary px-6 py-2 font-bold text-on-primary transition hover:opacity-90"
                        >
                          <span className="material-symbols-outlined text-sm">verified_user</span>
                          Authorize
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-outline-variant px-6 py-2 font-semibold text-on-surface transition hover:bg-surface-container-high"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {streamPhase >= 5 ? (
              <div className="agentic-stream-chunk flex items-start gap-4 pb-24">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-surface-container-high">
                  <span className="material-symbols-outlined text-sm text-tertiary">terminal</span>
                </div>
                <div className="w-full">
                  <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 font-mono text-[13px] leading-relaxed shadow-sm">
                    <div className="mb-4 flex items-center justify-between font-semibold text-outline">
                      <span>Output: sqlmap_runner.sh</span>
                      <span>{outputTime || "—"}</span>
                    </div>
                    <p className="text-tertiary">[INFO] testing connection to the target URL</p>
                    <p className="text-on-surface">checking if the target is protected by some kind of WAF/IPS</p>
                    <p className="text-on-surface-variant">[WARNING] target URL appears to be behind Cloudflare</p>
                    <p className="text-tertiary">[INFO] testing if the target URL is stable</p>
                    <p className="text-on-surface">testing if HTTP parameter &apos;username&apos; is dynamic</p>
                    <p className="text-on-surface">confirming that HTTP parameter &apos;username&apos; is dynamic</p>
                    <p className="font-bold text-error">[CRITICAL] found vulnerable parameter: username (POST)</p>
                    <div className="mt-4 flex gap-4 border-t border-outline-variant pt-4">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-tertiary" />
                        <span className="text-xs font-semibold text-on-surface-variant">Injectable: Yes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        <span className="text-xs font-semibold text-on-surface-variant">Type: Boolean-based blind</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div
        className={
          ran
            ? "shrink-0 border-t border-outline-variant/70 bg-background px-4 py-5 sm:px-6"
            : "shrink-0 border-t border-outline-variant/70 bg-background px-4 pb-5 pt-4 sm:px-6"
        }
      >
        <div className="mx-auto max-w-4xl">
          {selectedAgentId ? (
            <div className="mb-2 flex flex-wrap gap-2 px-1">
              <span className="inline-flex items-center gap-1 rounded-full border border-outline-variant/80 bg-surface-container-high/50 px-2.5 py-1 text-[11px] font-medium text-on-surface">
                <span className="text-outline">Agent</span>
                <span className="font-mono text-primary">{getAgentLabel(selectedAgentId)}</span>
              </span>
              <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-outline-variant/80 bg-surface-container-high/50 px-2.5 py-1 text-[11px] font-medium text-on-surface">
                <span className="shrink-0 text-outline">Tools</span>
                <span className="truncate text-on-surface-variant">{enabledToolLabel}</span>
              </span>
            </div>
          ) : null}

          <div className="relative rounded-lg border border-outline-variant bg-surface-container-low p-1.5 transition-colors focus-within:border-primary/40 focus-within:bg-surface sm:p-2">
            {pickerMode ? (
              <div className="absolute bottom-full left-0 right-0 z-20 mb-1.5 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-sm">
                <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container px-2 py-1.5">
                  <span className="text-xs font-bold text-on-surface">
                    {pickerMode === "mention" && "@ Agents & tools"}
                    {pickerMode === "agents" && "Agents"}
                    {pickerMode === "tools" && "Tools"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPickerMode(null)}
                    className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high"
                    aria-label="Close"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
                {renderPickerContent()}
              </div>
            ) : null}

            {mentionComposerAgentId ? (
              <div className="flex flex-wrap gap-1.5 border-b border-outline-variant/40 px-2 pb-2 pt-1">
                <span className={`${AGENT_MENTION_CHIP_CLASS} pl-2 pr-1`}>
                  @{getAgentLabel(mentionComposerAgentId)}
                  <button
                    type="button"
                    onClick={() => {
                      setMentionComposerAgentId(null);
                      setSelectedAgentId("");
                    }}
                    className="rounded p-0.5 text-on-primary/90 transition hover:bg-white/15 hover:text-on-primary"
                    aria-label="Remove agent mention"
                  >
                    <span className="material-symbols-outlined text-[16px] leading-none">close</span>
                  </button>
                </span>
              </div>
            ) : null}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setPickerMode(null);
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!pickerModeRef.current) onExecute();
                }
              }}
              onClick={(e) => {
                const el = e.currentTarget;
                syncMentionFromValue(el.value, el.selectionStart ?? el.value.length);
              }}
              onKeyUp={(e) => {
                const el = e.currentTarget;
                syncMentionFromValue(el.value, el.selectionStart ?? el.value.length);
              }}
              onSelect={(e) => {
                const el = e.currentTarget;
                const v = el.value;
                const pos = el.selectionStart ?? v.length;
                syncMentionFromValue(v, pos);
              }}
              className="terminal-scroll w-full resize-none border-0 bg-transparent p-3 font-sans text-on-surface outline-none placeholder:text-outline"
              placeholder="Enter offensive security prompt or tactical objective… Type @ for agents & tools"
              rows={mentionComposerAgentId ? 2 : 3}
              aria-label="Chat prompt"
            />
            <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-outline-variant/50 px-1.5 pb-1 pt-2 sm:gap-3 sm:px-2">
              <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-surface-container-high/60 p-0.5 sm:gap-2 sm:p-1">
                <span className="flex shrink-0 items-center gap-1 px-2 py-1 text-xs font-bold text-primary">
                  <span className="material-symbols-outlined text-sm">neurology</span>
                  GPT-4o
                </span>
                <div className="mx-0.5 hidden h-4 w-px shrink-0 bg-outline-variant sm:block" />
                <button
                  type="button"
                  onClick={() => setPickerMode((m) => (m === "agents" ? null : "agents"))}
                  className={
                    pickerMode === "agents"
                      ? "flex shrink-0 items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary"
                      : "flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-bold text-on-surface-variant transition hover:bg-primary/10 hover:text-primary"
                  }
                >
                  <span className="material-symbols-outlined text-sm">person_search</span>
                  @ Agent
                </button>
                <button
                  type="button"
                  onClick={() => setPickerMode((m) => (m === "tools" ? null : "tools"))}
                  className={
                    pickerMode === "tools"
                      ? "flex shrink-0 items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary"
                      : "flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-bold text-on-surface-variant transition hover:bg-primary/10 hover:text-primary"
                  }
                >
                  <span className="material-symbols-outlined text-sm">build</span>
                  + Tool
                </button>
              </div>
              <button
                type="button"
                onClick={onExecute}
                disabled={!composedPrompt}
                title={!composedPrompt ? "Type a prompt (optional: @ Agent / + Tool first)" : undefined}
                className={
                  !composedPrompt
                    ? "ml-auto flex shrink-0 cursor-not-allowed items-center gap-2 rounded-lg bg-outline-variant px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-on-surface-variant opacity-70"
                    : "ml-auto flex shrink-0 items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-on-primary transition hover:opacity-90"
                }
              >
                Execute
                <span className="material-symbols-outlined text-sm">bolt</span>
              </button>
            </div>
          </div>
          <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-wider text-outline">
            HexStrike Agentic Framework v2.4.0-stable
          </p>
        </div>
      </div>
    </main>
  );
}
