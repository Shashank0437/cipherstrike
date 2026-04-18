import { Public_Sans } from "next/font/google";

/**
 * Stitch "Session Report Details (Light)" shell — same screen family as
 * bcf0c4f7d8294f289ee68e7e2a73a266 (Public Sans, bg-zinc-50 main canvas).
 */
const publicSans = Public_Sans({
  subsets: ["latin"],
  display: "swap",
});

export default function SessionReportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`-mx-6 min-h-full bg-zinc-50 px-6 pb-12 pt-2 text-[#30323e] ${publicSans.className}`}
    >
      {children}
    </div>
  );
}
