import Link from "next/link";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";

export default function DocsPage() {
  return (
    <div className="w-full min-w-0 max-w-none space-y-8 font-sans text-on-surface">
      <PageBreadcrumbs items={[{ label: "Sessions", href: "/history" }, { label: "Documentation" }]} />
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Documentation</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-on-surface">CipherStrike operator guide</h1>
        <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
          Product flows align with the Google Stitch shell: Session History, session reports, tool arsenal, and GTM
          exports (monthly summary, SOC 2 evidence) on Analytics. Use Sessions to review runs; Analytics for rollups
          and exports; Tools to configure scans.
        </p>
      </div>
      <ul className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-6 text-sm shadow-sm">
        <li className="flex gap-2">
          <span className="text-primary">→</span>
          <Link href="/history" className="font-medium text-primary hover:underline">
            Session History
          </Link>
          — search, filter, PDF and terminal actions per row.
        </li>
        <li className="flex gap-2">
          <span className="text-primary">→</span>
          <Link href="/analytics" className="font-medium text-primary hover:underline">
            Analytics
          </Link>
          — workspace metrics and activity pulse.
        </li>
        <li className="flex gap-2">
          <span className="text-primary">→</span>
          <span>
            On Analytics:{" "}
            <Link href="/analytics#monthly-executive-summary" className="font-medium text-primary hover:underline">
              Monthly summary
            </Link>
            ,{" "}
            <Link href="/analytics#compliance-export" className="font-medium text-primary hover:underline">
              Compliance export
            </Link>
            .
          </span>
        </li>
      </ul>
    </div>
  );
}
