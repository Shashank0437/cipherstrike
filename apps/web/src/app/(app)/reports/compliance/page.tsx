"use client";

import { useLayoutEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy route: compliance export UI lives on `/analytics#compliance-export`. */
export default function ComplianceReportRedirectPage() {
  const router = useRouter();
  useLayoutEffect(() => {
    router.replace("/analytics#compliance-export");
  }, [router]);
  return (
    <div className="p-6 text-sm text-[#52525b]" role="status">
      Redirecting to Analytics…
    </div>
  );
}
