"use client";

import { useLayoutEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy route: monthly report UI lives on `/analytics#monthly-executive-summary`. */
export default function MonthlyReportRedirectPage() {
  const router = useRouter();
  useLayoutEffect(() => {
    router.replace("/analytics#monthly-executive-summary");
  }, [router]);
  return (
    <div className="p-6 text-sm text-[#52525b]" role="status">
      Redirecting to Analytics…
    </div>
  );
}
