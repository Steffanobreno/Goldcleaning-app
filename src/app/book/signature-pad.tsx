"use client";
import { useEffect, useRef } from "react";

// Sign with a finger (or mouse). Reports the drawing as a PNG data URL after each stroke,
// or null once cleared.
export function SignaturePad({ onChange }: { onChange: (png: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const inked = useRef(false);

  useEffect(() => {
    const c = canvas.current!;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#132039";
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  return (
    <div className="space-y-1">
      <div className="relative">
        <canvas
          ref={canvas}
          aria-label="Draw your signature here"
          className="h-40 w-full touch-none rounded-2xl border-2 border-dashed border-line bg-bg"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = true;
            const ctx = e.currentTarget.getContext("2d")!;
            const [x, y] = point(e);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 0.1, y + 0.1);
            ctx.stroke();
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = e.currentTarget.getContext("2d")!;
            const [x, y] = point(e);
            ctx.lineTo(x, y);
            ctx.stroke();
          }}
          onPointerUp={(e) => {
            if (!drawing.current) return;
            drawing.current = false;
            inked.current = true;
            onChange(e.currentTarget.toDataURL("image/png"));
          }}
        />
        <span className="pointer-events-none absolute bottom-3 left-4 right-4 border-t border-muted/40 pt-1 text-xs text-muted">
          Sign above
        </span>
      </div>
      <button
        type="button"
        className="text-sm font-semibold text-brand"
        onClick={() => {
          const c = canvas.current!;
          c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
          inked.current = false;
          onChange(null);
        }}
      >
        Clear signature
      </button>
    </div>
  );
}
