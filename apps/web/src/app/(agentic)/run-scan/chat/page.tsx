import { Suspense } from "react";
import { ChatThreadParam } from "./ChatThreadParam";

export default function AgenticChatPage() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Suspense fallback={<div className="min-h-0 flex-1 bg-background" aria-hidden />}>
        <ChatThreadParam />
      </Suspense>
    </div>
  );
}
