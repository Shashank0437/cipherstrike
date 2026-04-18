/**
 * Renders Stitch `get_screen` HTML exports from `public/` for pixel-accurate UI.
 * Use `fill` when the frame sits inside RunScanShell so height follows the flex column.
 */
export function StitchAgenticFrame({
  src,
  title,
  fill,
}: {
  src: string;
  title: string;
  /** When true, iframe fills parent (e.g. RunScanShell main column) instead of full viewport height. */
  fill?: boolean;
}) {
  return (
    <iframe
      title={title}
      src={src}
      className={
        fill
          ? "block h-full min-h-0 w-full max-w-full flex-1 border-0"
          : "block h-[100dvh] w-full max-w-full border-0"
      }
    />
  );
}
