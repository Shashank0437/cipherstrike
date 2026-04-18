import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";

export default function SupportPage() {
  return (
    <div className="w-full min-w-0 max-w-none space-y-8 font-sans text-on-surface">
      <PageBreadcrumbs items={[{ label: "Sessions", href: "/history" }, { label: "Support" }]} />
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Support</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-on-surface">We’re here to help</h1>
        <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
          For enterprise pilots, SLA questions, or integration with your SIEM and identity stack, reach out through
          your success channel. Include session IDs and timestamps when reporting scan issues so we can trace logs
          quickly.
        </p>
      </div>
      <div className="rounded-xl border border-outline-variant bg-gradient-to-br from-primary-container/40 to-surface-container-lowest p-6 shadow-sm">
        <h2 className="text-sm font-bold text-on-surface">Before you write in</h2>
        <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-on-surface-variant">
          <li>Confirm API and web app are on the same auth session (try sign out / sign in).</li>
          <li>
            For empty Session History, use seed demo or{" "}
            <code className="rounded bg-surface-container px-1">/history?demo=reset</code> in development.
          </li>
          <li>PDF exports require a valid session and report record — open the session detail once to materialize data.</li>
        </ul>
      </div>
    </div>
  );
}
