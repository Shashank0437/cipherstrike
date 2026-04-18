/**
 * Stitch "Session History (Light)" — background + text base from
 * user-stitch get_screen (project 3983447513859599936, screen 42231ff58600435e95177bfe85135f0c).
 */
export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative -mx-6 -mt-0 min-h-full bg-[#fafafa] px-6 pb-12 pt-2 text-[#09090b]">
      {children}
    </div>
  );
}
