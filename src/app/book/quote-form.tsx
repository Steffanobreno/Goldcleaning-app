"use client";
import { useState, useTransition } from "react";
import { blobToDataUrl, resizeImage } from "@/lib/resize-image";
import { requestQuoteAction } from "./actions";
import { useT } from "@/components/i18n";

// Airbnb turnovers and offices are quoted by hand: this short form replaces the rest of the
// booking page. Photos are optional, shrunk in the browser before they are sent.

const field = "w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-navy";
const MAX_PHOTOS = 5;

export function QuoteForm({ serviceId, office, businessPhone }: { serviceId: string; office: boolean; businessPhone: string }) {
  const { t, serverMessage } = useT();
  const [v, setV] = useState({
    firstName: "", lastName: "", email: "", phone: "", city: "", zip: "",
    bedrooms: "", fullBaths: "", squareFeet: "", frequency: "", message: "", website: "",
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  async function addPhotos(files: FileList | null) {
    setPhotoError(null);
    const room = MAX_PHOTOS - photos.length;
    const picked = [...(files ?? [])].slice(0, room);
    try {
      const urls = await Promise.all(picked.map(async (f) => blobToDataUrl(await resizeImage(f, 1200))));
      setPhotos([...photos, ...urls]);
    } catch {
      setPhotoError(t("One of the photos could not be read. Try another one."));
    }
  }

  if (sent) {
    return (
      <div className="card space-y-3 p-6 text-center">
        <p className="text-4xl" aria-hidden>✨</p>
        <h2 className="font-serif text-2xl font-bold">{t("Thank you, {name}!", { name: v.firstName })}</h2>
        <p>{t("We received your request and will get back to you within 24 hours with a quote, or to set up a quick visit.")}</p>
        <p className="text-sm text-muted">{t("Questions? Call or text us at {phone}.", { phone: businessPhone })}</p>
      </div>
    );
  }

  return (
    <section className="space-y-3" aria-label={t("Quote request")}>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">2 · {office ? t("Tell us about your office") : t("Tell us about your place")}</h2>
      <p className="text-sm text-muted">{office ? t("Every office is different, so we quote by hand. We usually reply within a day.") : t("Every host is different, so we quote by hand. We usually reply within a day.")}</p>
      <div className="grid grid-cols-2 gap-2">
        <input className={field} aria-label={t("First name")} placeholder={t("First name")} autoComplete="given-name" value={v.firstName} onChange={set("firstName")} />
        <input className={field} aria-label={t("Last name")} placeholder={t("Last name")} autoComplete="family-name" value={v.lastName} onChange={set("lastName")} />
      </div>
      <input className={field} aria-label={t("Email")} placeholder={t("Email")} type="email" autoComplete="email" value={v.email} onChange={set("email")} />
      <input className={field} aria-label={t("Phone")} placeholder={t("Phone")} type="tel" inputMode="tel" autoComplete="tel" value={v.phone} onChange={set("phone")} />
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <input className={field} aria-label={t("City")} placeholder={t("City")} value={v.city} onChange={set("city")} />
        <input className={field} aria-label={t("ZIP")} placeholder={t("ZIP")} inputMode="numeric" maxLength={5} value={v.zip}
          onChange={(e) => setV({ ...v, zip: e.target.value.replace(/\D/g, "") })} />
      </div>
      {office ? (
        <input className={field} aria-label={t("Square feet (about)")} placeholder={t("Square feet (about)")} inputMode="numeric" value={v.squareFeet}
          onChange={(e) => setV({ ...v, squareFeet: e.target.value.replace(/\D/g, "") })} />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <input className={field} aria-label={t("Bedrooms")} placeholder={t("Bedrooms")} inputMode="numeric" value={v.bedrooms}
            onChange={(e) => setV({ ...v, bedrooms: e.target.value.replace(/\D/g, "") })} />
          <input className={field} aria-label={t("Bathrooms")} placeholder={t("Bathrooms")} inputMode="numeric" value={v.fullBaths}
            onChange={(e) => setV({ ...v, fullBaths: e.target.value.replace(/\D/g, "") })} />
        </div>
      )}
      <select className={field} aria-label={t("How often")} value={v.frequency} onChange={set("frequency")}>
        <option value="">{t("How often?")}</option>
        {(office ? ["One-time", "Weekly", "Twice a week", "Every 2 weeks", "Monthly"] : ["Between every guest", "Weekly", "Every 2 weeks", "Monthly", "One-time"]).map(
          (f) => <option key={f} value={f}>{t(f)}</option>,
        )}
      </select>
      <textarea className={`${field} min-h-28`} aria-label={t("Tell us what you need")} placeholder={t("Tell us what you need")} value={v.message} onChange={set("message")} />
      <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={v.website} onChange={set("website")} />

      <div className="space-y-2">
        <p className="text-sm font-medium">{t("Photos (optional, up to {n})", { n: MAX_PHOTOS })}</p>
        {photos.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <li key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of a data URL */}
                <img src={p} alt={t("Photo {n}", { n: i + 1 })} className="h-20 w-20 rounded-xl object-cover" />
                <button type="button" aria-label={t("Remove photo {n}", { n: i + 1 })} onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-navy text-xs text-white">✕</button>
              </li>
            ))}
          </ul>
        )}
        {photos.length < MAX_PHOTOS && (
          <label className="block cursor-pointer rounded-xl border border-dashed border-line px-4 py-3 text-center text-sm font-semibold text-navy">
            {t("Add photos")}
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
          </label>
        )}
        {photoError && <p className="text-sm text-danger">{photoError}</p>}
      </div>

      {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
      <button type="button" disabled={pending}
        className="w-full rounded-full bg-gold px-4 py-3.5 text-base font-bold text-navy disabled:opacity-40"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const r = await requestQuoteAction({
              serviceId, firstName: v.firstName, lastName: v.lastName, email: v.email, phone: v.phone, city: v.city, zip: v.zip,
              bedrooms: num(v.bedrooms), fullBaths: num(v.fullBaths), squareFeet: num(v.squareFeet), frequency: v.frequency,
              message: v.message, photos, website: v.website,
            });
            if ("ok" in r) setSent(true);
            else setError(serverMessage(r.error));
          });
        }}>
        {pending ? t("Sending…") : t("Request a quote")}
      </button>
    </section>
  );
}
