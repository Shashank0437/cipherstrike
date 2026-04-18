import { Suspense } from "react";
import { Protected } from "@/components/Protected";
import { RunScanShell } from "@/components/agentic/RunScanShell";

export default function AgenticLayout({ children }: { children: React.ReactNode }) {
  return (
    <Protected>
      <Suspense fallback={<div className="h-[100dvh] bg-background" aria-hidden />}>
        <RunScanShell>{children}</RunScanShell>
      </Suspense>
    </Protected>
  );
}
