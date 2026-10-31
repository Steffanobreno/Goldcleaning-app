"use client";
import { useState, useTransition } from "react";
import { blobToDataUrl, resizeImage } from "@/lib/resize-image";
import { addVisitPhotosAction, deleteVisitPhotoAction } from "../photo-actions";

type Photo = { id: string; kind: "before" | "after" | "other" };
const KINDS = [["before", "Before"], ["after", "After"], ["other", "Other"]] as const;

/** Before and after photos of the cleaning: pick them on the phone, they are shrunk and saved with the visit. */
export function VisitPhotos({ appointmentId, photos }: { appointmentId: string; photos: Photo[] }) {
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>(photos.some((p) => p.kind === "before") ? "after" : "before");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function pick(files: FileList | null) {
    setError(null);
    const picked = [...(files ?? [])].slice(0, 8);
    if (!picked.length) return;
    try {
      const urls = await Promise.all(picked.map(async (f) => blobToDataUrl(await resizeImage(f, 1100, 0.8))));
      start(async () => {
        const r = await addVisitPhotosAction(appointmentId, kind, urls);
        if (r.error) setError(r.error);
      });
    } catch {
      setError("One of the photos could not be read. Try another one.");
    }
  }

  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <li key={p.id} className="relative">
              <a href={`/api/visit-photos/${p.id}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- a photo served by the app */}
                <img src={`/api/visit-photos/${p.id}`} alt={`${p.kind} photo`} loading="lazy" className="aspect-square w-full rounded-xl object-cover" />
              </a>
              <span className="absolute left-1 top-1 rounded-full bg-navy/85 px-2 py-0.5 text-[10px] font-bold uppercase text-white">{p.kind}</span>
              <button type="button" aria-label="Delete this photo" disabled={pending}
                onClick={() => { if (window.confirm("Delete this photo?")) start(async () => { await deleteVisitPhotoAction(appointmentId, p.id); }); }}
                className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-surface text-xs text-danger shadow ring-1 ring-line">✕</button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <select aria-label="Kind of photo" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}
          className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-semibold">
          {KINDS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <label className="flex-1 cursor-pointer rounded-xl border border-dashed border-line px-4 py-2.5 text-center text-sm font-semibold text-navy">
          {pending ? "Saving…" : "Add photos"}
          <input type="file" accept="image/*" multiple capture={undefined} className="sr-only" disabled={pending}
            onChange={(e) => { void pick(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
