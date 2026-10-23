"use client";
import { useRef, useState, useTransition } from "react";
import { resizeImage } from "@/lib/resize-image";
import { savePetPhotoAction } from "./actions";

/** "Add photo" / "Change photo" for a pet: shrinks the picture on the phone, then saves it. */
export function PetPhotoUpload({ petId, hasPhoto }: { petId: string; hasPhoto: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-1">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Pet photo"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setError(null);
          startTransition(async () => {
            try {
              const form = new FormData();
              form.set("photo", await resizeImage(file), "photo.jpg");
              const res = await savePetPhotoAction(petId, form);
              if (res.error) setError(res.error);
            } catch {
              setError("Could not read that photo. Try another one.");
            }
          });
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={pending}
        className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-brand"
      >
        {pending ? "Saving photo…" : hasPhoto ? "Change photo" : "Add photo"}
      </button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
