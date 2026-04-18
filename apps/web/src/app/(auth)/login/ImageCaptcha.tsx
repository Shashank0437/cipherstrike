"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import { IconRefresh } from "./LoginIcons";

const W = 200;
const H = 40;

function randomCharSet(): string {
  const pool = "ABCDEFGHJKMNPQRSTUVWXYZ2346789";
  return Array.from({ length: 5 }, () => pool[Math.floor(Math.random() * pool.length)]).join(
    "",
  );
}

type ImageCaptchaProps = {
  value: string;
  cells: string[];
  onCellChange: (i: number, v: string) => void;
  onRequestNew: () => void;
};

export function ImageCaptcha({ value, cells, onCellChange, onRequestNew }: ImageCaptchaProps) {
  const row: string[] =
    Array.isArray(cells) && cells.length === 5 ? cells : ["", "", "", "", ""];
  const ref = useRef<HTMLCanvasElement | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const groupId = useId();

  const draw = useCallback(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    c.width = W;
    c.height = H;
    const grd = ctx.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, "#e8edf3");
    grd.addColorStop(1, "#f0f4f8");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
    for (let n = 0; n < 6; n++) {
      ctx.strokeStyle = `rgba(90, 66, 171, ${0.08 + Math.random() * 0.1})`;
      ctx.lineWidth = 0.6 + Math.random() * 0.8;
      ctx.beginPath();
      ctx.moveTo(Math.random() * W, Math.random() * H);
      ctx.bezierCurveTo(
        Math.random() * W,
        Math.random() * H,
        Math.random() * W,
        Math.random() * H,
        Math.random() * W,
        Math.random() * H,
      );
      ctx.stroke();
    }
    for (let n = 0; n < 40; n++) {
      ctx.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`;
      ctx.beginPath();
      ctx.arc(
        Math.random() * W,
        Math.random() * H,
        0.4 + Math.random() * 0.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    const chars = value.split("");
    const font = "600 16px system-ui, -apple-system, sans-serif";
    for (let i = 0; i < chars.length; i++) {
      ctx.save();
      const x = 16 + i * 34;
      const y = H / 2 + 5;
      ctx.translate(x, y);
      ctx.rotate((Math.random() * 0.4 - 0.2) * Math.PI);
      ctx.fillStyle = `hsl(${250 + (i * 7) % 20}, ${35 + (i % 3) * 10}%, ${22 + (i * 2) % 8}%)`;
      ctx.font = font;
      ctx.fillText(chars[i] ?? "", 0, 0);
      ctx.restore();
    }
  }, [value]);

  useEffect(() => {
    draw();
  }, [draw]);

  function onChange(i: number, raw: string) {
    const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-1);
    onCellChange(i, c);
    if (c && i < 4) inputRefs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !row[i] && i > 0) inputRefs.current[i - 1]?.focus();
  }

  return (
    <div className="space-y-3" role="group" aria-labelledby={`${groupId}-label`}>
      <p id={`${groupId}-label`} className="sr-only">
        Enter the five characters shown in the image, one per box, from left to right.
      </p>
      <div className="flex items-center gap-2">
        <canvas
          ref={ref}
          className="h-10 w-full min-w-0 max-w-[200px] shrink rounded-md border border-slate-200/90 bg-slate-50"
          width={W}
          height={H}
          aria-hidden
        />
        <button
          type="button"
          onClick={onRequestNew}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-md border border-slate-200/90 bg-white px-2.5 text-[0.7rem] font-semibold text-[#5b3fa9] transition hover:border-slate-300 hover:bg-slate-50/80"
          title="New code"
        >
          <span className="inline-flex size-3.5 shrink-0 text-current">
            <IconRefresh size={14} />
          </span>
          <span className="hidden min-[360px]:inline">New</span>
        </button>
      </div>
      <div
        className="grid w-full max-w-xs grid-cols-5 gap-2"
        id={`${groupId}-boxes`}
        aria-label="Captcha code"
      >
        {row.map((ch, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="text"
            maxLength={1}
            value={ch}
            onChange={(e) => onChange(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            className="h-10 w-10 min-w-0 place-self-center rounded border border-slate-200/90 bg-slate-50/90 text-center text-sm font-semibold text-slate-900 tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none ring-offset-0 transition focus:border-[#5b3fa9] focus:ring-1 focus:ring-[#5b3fa9]/30 sm:h-10 sm:w-10"
            style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            name={`captcha-${i}`}
            id={`captcha-box-${i}`}
            aria-label={`Character ${i + 1} of 5`}
          />
        ))}
      </div>
    </div>
  );
}

export { randomCharSet as generateCaptchaString };
