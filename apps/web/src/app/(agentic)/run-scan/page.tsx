import { AgenticChatView, AGENTIC_WORKSPACE_THREAD_ID } from "@/components/agentic/AgenticChatView";

export default function AgenticWorkspacePage() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AgenticChatView
        key={AGENTIC_WORKSPACE_THREAD_ID}
        threadId={AGENTIC_WORKSPACE_THREAD_ID}
        workspaceLayout
      />
    </div>
  );
}
