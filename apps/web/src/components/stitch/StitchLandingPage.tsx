import Link from "next/link";
import { LandingAuthLink, LandingHeroPrimaryCta } from "@/components/stitch/LandingAuthCta";

/**
 * Google Stitch — CipherStrike marketing landing (project 3983447513859599936).
 * Ported from `public/stitch-landing.html` for pixel-aligned Tailwind + working Next.js links.
 * Preview: https://stitch.withgoogle.com/preview/3983447513859599936?node-id=8f6abae9a75c49d8969ac7a231fc16f2
 */
const HERO_TEXTURE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBDVCqaAwavljXHCv6iy-HTkq_EFklP46KElPDexQUolB-7JQg-qUCDs1HGgESCJT5z4J-Iz3gcqrgYcCYHAEPP7Td8Yl7ItHXCYtWDp3gLVGn_yySXd245kX_mLVsof3x4yc8IEdzMUQ-C34-ugoq-eg8UhgICh1_CIglXcVDHRvz0vuCGaZTHvnJI7El2ZZ6Tc_BrKlzJeF2qB6K36Ufa0eKzfI2lw0_FD5NclVXkbkw0ZDWuKo-3VIb0UA_c3AfW-cacCE3uoWI";

const BENTO_IMG =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBD9_3nqUvwaNm5hsc9ZxCunIpk2Fcm0OoPO44ySHM011EGqMJNbZ-gNXtk_nQ8LUDn_Ng78lYJqXGFTrtsNe6ckFuQmqGd7zhPnNSQXb6d1p7rf4kAva4d1__IxiCizP3qUCDDSUTMXxfKbODLAiaxjCLKjugojf2kfxQLiQU3bcbeQ562Ccw_6E0KbOKWlCI1A3DE-besDEJPTAGmsbmjr1SRIAVQ_CoJJGlxMA9GXAUpGG_wS112kUWOL6p-XXwIeFJjd2WHFqA";

const TOOL_CHIPS: { icon: string; label: string }[] = [
  { icon: "search", label: "NMAP" },
  { icon: "database", label: "SQLMAP" },
  { icon: "shield", label: "METASPLOIT" },
  { icon: "wifi", label: "AIRCRACK-NG" },
  { icon: "key", label: "JOHN" },
  { icon: "language", label: "BURPSUITE" },
  { icon: "lan", label: "WIRESHARK" },
];

function ToolMarqueeRow({ rowKey }: { rowKey: string }) {
  return (
    <>
      {TOOL_CHIPS.map((t) => (
        <div
          key={`${rowKey}-${t.label}`}
          className="flex shrink-0 cursor-default items-center gap-3 rounded-full border border-outline-variant bg-surface px-6 py-3 transition-colors hover:border-primary/50"
        >
          <span className="material-symbols-outlined text-primary">{t.icon}</span>
          <span className="font-bold tracking-tighter">{t.label}</span>
        </div>
      ))}
    </>
  );
}

export function StitchLandingPage() {
  return (
    <main className="bg-background font-sans text-on-background antialiased selection:bg-primary selection:text-on-primary">
      <section className="relative flex min-h-[min(921px,100dvh)] items-center justify-center overflow-hidden px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1e1b4b_0%,transparent_70%)] opacity-30" />
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-10"
          style={{ backgroundImage: `url('${HERO_TEXTURE}')`, backgroundSize: "cover" }}
        />
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-high px-3 py-1">
              <span className="flex h-2 w-2 rounded-full bg-tertiary" />
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">System: Online</span>
            </div>
            <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tighter text-on-surface md:text-7xl">
              Autonomous <br />
              <span className="text-primary">Offensive Security</span>
            </h1>
            <p className="max-w-lg text-xl leading-relaxed text-on-surface-variant">
              Orchestrate 147+ security tools via 12 specialized agents. Automate penetration testing at the speed of
              thought.
            </p>
            <div className="flex flex-wrap gap-4">
              <LandingHeroPrimaryCta className="inline-flex items-center justify-center rounded bg-primary px-8 py-4 text-lg font-bold text-on-primary shadow-[0_0_20px_rgba(167,139,250,0.3)] transition-all hover:opacity-90" />
            </div>
          </div>
          <div className="group relative">
            <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-primary/20 to-tertiary/20 opacity-50 blur-xl transition duration-1000 group-hover:opacity-100 group-hover:duration-200" />
            <div className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container shadow-2xl">
              <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container-high px-4 py-2">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-error/40" />
                  <div className="h-3 w-3 rounded-full bg-primary/40" />
                  <div className="h-3 w-3 rounded-full bg-tertiary/40" />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">
                  cipherstrike-v2.0 // core-agent-network
                </span>
              </div>
              <div className="min-h-[350px] space-y-3 p-6 font-mono text-sm">
                <div className="flex gap-3">
                  <span className="text-primary">root@cipherstrike:~$</span>
                  <span className="text-on-surface">initialize --agent-cluster=shadow-ops --targets=internal.lan</span>
                </div>
                <div className="text-tertiary">[SUCCESS] Cluster &quot;Shadow Ops&quot; synchronized. 12 agents active.</div>
                <div className="border-l border-outline-variant pl-4 text-[#a1a1aa]">
                  [INFO] Recon-Agent: Scanning subnet 192.168.1.0/24... <br />
                  [INFO] Recon-Agent: 14 open ports identified on primary target. <br />
                  [INFO] Exploit-Agent: Vulnerability CVE-2024-21626 detected. <br />
                  [INFO] Orchestrator: Queuing Metasploit payload injection...
                </div>
                <div className="flex items-center justify-between rounded border border-outline-variant bg-surface-container-lowest p-3">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary">analytics</span>
                    <span className="text-xs text-on-surface">Compromise Probability: 94.2%</span>
                  </div>
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-container">
                    <div className="h-full w-[94%] bg-primary" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden border-y border-outline-variant bg-surface-container-low py-12">
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-10 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-on-surface-variant">
            Trusted by modern security operations
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-16 gap-y-8 grayscale opacity-50 transition-all hover:grayscale-0 hover:opacity-100">
            {[
              { icon: "verified_user", name: "SENTINEL" },
              { icon: "token", name: "VOIDSEC" },
              { icon: "hive", name: "CIPHERSTRIKE" },
              { icon: "layers", name: "PHANTOM.IO" },
              { icon: "radar", name: "NETSTRIKE" },
            ].map((b) => (
              <div key={b.name} className="flex items-center gap-2">
                <span className="material-symbols-outlined text-3xl">{b.icon}</span>
                <span className="text-xl font-black tracking-tighter">{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-on-surface md:text-5xl">
            Precision-Engineered <span className="text-primary">Intelligence</span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-on-surface-variant">
            A unified platform designed for elite security researchers and red teams.
          </p>
        </div>
        <div className="grid auto-rows-[280px] grid-cols-1 gap-4 md:grid-cols-12">
          <div className="flex flex-col justify-between rounded-xl border border-outline-variant bg-surface-container p-8 md:col-span-8 md:row-span-2">
            <div>
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded border border-primary/20 bg-primary/10">
                <span className="material-symbols-outlined text-3xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  hub
                </span>
              </div>
              <h3 className="mb-4 text-2xl font-bold text-on-surface">Multi-role architecture</h3>
              <p className="max-w-md text-lg text-on-surface-variant">
                12 specialized task runners work in concert. Recon, analysis, exploitation, and post-ex are handled by
                dedicated modules tuned for each security domain.
              </p>
            </div>
            <div className="relative mt-8 aspect-video w-full overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote Stitch asset */}
              <img src={BENTO_IMG} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="grid grid-cols-3 gap-8">
                  {[
                    { c: "border-primary text-primary", i: "visibility" },
                    { c: "border-tertiary text-tertiary", i: "bolt" },
                    { c: "border-error text-error", i: "target" },
                  ].map((x) => (
                    <div
                      key={x.i}
                      className={`flex h-16 w-16 items-center justify-center rounded-full border bg-background/80 backdrop-blur ${x.c}`}
                    >
                      <span className="material-symbols-outlined">{x.i}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center rounded-xl border border-outline-variant bg-surface-container p-8 text-center md:col-span-4 md:row-span-2">
            <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-tertiary/20 bg-tertiary/10">
              <span className="material-symbols-outlined text-4xl text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>
                psychology
              </span>
            </div>
            <h3 className="mb-4 text-2xl font-bold text-on-surface">Human-in-the-Loop</h3>
            <p className="text-lg text-on-surface-variant">
              Automation without loss of control. Review run plans, authorize critical exploits, and pivot the strategy
              in real-time through the terminal console.
            </p>
            <div className="mt-12 space-y-3">
              {[
                { t: "Agent-01 Plan", s: "Pending", sc: "text-tertiary bg-tertiary/10" },
                { t: "Shell Access", s: "Restricted", sc: "text-error bg-error/10" },
                { t: "CVE Analysis", s: "Ready", sc: "text-tertiary bg-tertiary/10" },
              ].map((r) => (
                <div
                  key={r.t}
                  className="flex h-10 items-center justify-between rounded border border-outline-variant bg-surface-container-high px-4"
                >
                  <span className="font-mono text-xs text-on-surface">{r.t}</span>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${r.sc}`}>{r.s}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center gap-12 overflow-hidden rounded-xl border border-outline-variant bg-surface-container p-8 md:col-span-12 md:flex-row">
            <div className="flex-1">
              <div className="mb-4 inline-flex items-center gap-2 text-tertiary">
                <span className="material-symbols-outlined">update</span>
                <span className="text-sm font-bold uppercase tracking-wider">Zero-Day Intel</span>
              </div>
              <h3 className="mb-2 text-2xl font-bold text-on-surface">Real-time CVE Analysis</h3>
              <p className="max-w-lg text-on-surface-variant">
                Instantly map discovered services to the latest CVE databases. The platform parses vulnerability reports
                in milliseconds to identify actionable attack paths.
              </p>
            </div>
            <div className="h-full w-full flex-1 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest p-4 font-mono text-[10px] text-tertiary">
              <div className="animate-pulse">Analyzing kernel modules...</div>
              <div className="mt-2 text-on-surface-variant">&gt; Search: Linux Kernel 6.5.0-x</div>
              <div className="mt-2 rounded border border-tertiary/30 bg-tertiary/5 p-2">
                <div className="flex justify-between font-bold">
                  <span>CVE-2024-1086</span>
                  <span className="text-error">CRITICAL 9.8</span>
                </div>
                <div className="mt-1 opacity-80">Use-after-free vulnerability in the Netfilter...</div>
                <div className="mt-2 cursor-pointer underline">Generate Exploit Script</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden border-y border-outline-variant bg-surface-container-low py-24">
        <div className="mx-auto mb-16 max-w-6xl px-6 text-center">
          <h2 className="mb-4 text-3xl font-bold text-on-surface md:text-4xl">
            Weaponized <span className="text-primary">Arsenal</span>
          </h2>
          <p className="mx-auto max-w-xl text-on-surface-variant">
            Direct integration with 147+ industry-standard security tools. No wrappers, pure binary execution via
            unified orchestration.
          </p>
        </div>
        <div className="stitch-marquee-container relative py-4">
          <div className="absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-surface-container-low to-transparent" />
          <div className="absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-surface-container-low to-transparent" />
          <div className="stitch-marquee-content gap-12">
            <ToolMarqueeRow rowKey="a" />
            <ToolMarqueeRow rowKey="b" />
          </div>
        </div>
        <div className="mt-16 flex justify-center">
          <Link href="/tools" className="inline-flex items-center gap-2 font-bold text-primary hover:underline">
            View all 147 integrated tools
            <span className="material-symbols-outlined">arrow_forward</span>
          </Link>
        </div>
      </section>

      <footer className="border-t border-outline-variant bg-surface-container-lowest px-6 pt-24 pb-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-24 grid grid-cols-2 gap-12 md:grid-cols-4 lg:grid-cols-6">
            <div className="col-span-2">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-primary">
                  <span className="material-symbols-outlined text-on-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                    security
                  </span>
                </div>
                <span className="text-2xl font-black tracking-tighter text-on-surface uppercase">CipherStrike</span>
              </div>
              <p className="max-w-xs leading-relaxed text-on-surface-variant">
                The world&apos;s most advanced autonomous offensive security platform. Built for red teams by red teams.
              </p>
              <div className="mt-8 flex gap-4">
                {["alternate_email", "groups", "code"].map((ic) => (
                  <span
                    key={ic}
                    className="flex h-10 w-10 cursor-default items-center justify-center rounded border border-outline-variant text-on-surface-variant transition-all hover:border-primary hover:text-primary"
                  >
                    <span className="material-symbols-outlined">{ic}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-xs font-bold tracking-widest text-on-surface uppercase">Platform</h4>
              <ul className="space-y-2 text-sm text-on-surface-variant">
                <li>
                  <LandingAuthLink href="/login" signedInHref="/history" className="hover:text-primary">
                    Autonomous operations
                  </LandingAuthLink>
                </li>
                <li>
                  <Link href="/tools" className="hover:text-primary">
                    Tool Integration
                  </Link>
                </li>
                <li>
                  <span className="cursor-default hover:text-primary">CVE Database</span>
                </li>
                <li>
                  <span className="cursor-default hover:text-primary">Cloud Runner</span>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-xs font-bold tracking-widest text-on-surface uppercase">Resources</h4>
              <ul className="space-y-2 text-sm text-on-surface-variant">
                <li>
                  <LandingAuthLink href="/login?next=/docs" signedInHref="/docs" className="hover:text-primary">
                    Documentation
                  </LandingAuthLink>
                </li>
                <li>
                  <span className="cursor-default hover:text-primary">Security Blog</span>
                </li>
                <li>
                  <span className="cursor-default hover:text-primary">API Reference</span>
                </li>
                <li>
                  <span className="cursor-default hover:text-primary">Community</span>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-xs font-bold tracking-widest text-on-surface uppercase">Company</h4>
              <ul className="space-y-2 text-sm text-on-surface-variant">
                <li>
                  <span className="cursor-default hover:text-primary">About Us</span>
                </li>
                <li>
                  <span className="cursor-default hover:text-primary">Careers</span>
                </li>
                <li>
                  <span className="cursor-default hover:text-primary">Legal</span>
                </li>
                <li>
                  <span className="cursor-default hover:text-primary">Privacy Policy</span>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-xs font-bold tracking-widest text-on-surface uppercase">Status</h4>
              <div className="inline-flex items-center gap-2 rounded-full bg-tertiary/10 px-3 py-1 text-[10px] font-bold tracking-wider text-tertiary uppercase">
                <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-tertiary" />
                All Systems Operational
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-between gap-4 border-t border-outline-variant pt-8 md:flex-row">
            <p className="text-xs text-on-surface-variant">© 2026 CipherStrike. All rights reserved.</p>
            <div className="flex gap-8 text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">
              <span className="cursor-default transition-colors hover:text-on-surface">Term of Service</span>
              <span className="cursor-default transition-colors hover:text-on-surface">Security Disclosure</span>
              <span className="cursor-default transition-colors hover:text-on-surface">Responsible disclosure</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
