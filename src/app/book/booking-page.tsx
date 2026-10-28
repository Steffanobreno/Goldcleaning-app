"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { money } from "@/lib/format";
import { ACCESS_METHODS } from "@/lib/home-options";
import { FREQUENCIES, FREQUENCY_LABEL, quote, totalCents, type Catalog, type Frequency } from "@/lib/pricing";
import type { DaySlots } from "@/lib/booking";
import { MonthCalendar } from "./month-calendar";
import { ExtrasGrid } from "./extras-grid";
import { PriceSummary } from "./price-summary";
import { QuoteForm } from "./quote-form";
import { checkCouponAction, requestBookingAction, saveDraftAction, slotsAction, type Contact } from "./actions";

// The Clover-style booking page: one scrolling page, in order: service, frequency, home,
// extras, contact, day and time, address, access, review. The price bar at the bottom follows
// every choice. Contact comes before the date so a booking left halfway can be followed up.

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const pill = (on: boolean) =>
  `w-full rounded-full border px-4 py-3 text-center font-semibold transition ${on ? "border-navy bg-navy text-white" : "border-line bg-surface text-ink"}`;
const field = "w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-navy";

function Section({ n, title, children, id }: { n: number; title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-4 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
        {n} · {title}
      </h2>
      {children}
    </section>
  );
}

export function BookingPage({ initialCatalog, today, businessPhone, initialPhone = "" }: {
  initialCatalog: Catalog; today: string; businessPhone: string; initialPhone?: string;
}) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const services = catalog.services;
  const [serviceId, setServiceId] = useState(services.find((s) => s.pricing === "rate")?.id ?? "");
  const service = services.find((s) => s.id === serviceId);
  const offered = FREQUENCIES.filter((f) => service?.rates[f]);
  const [frequency, setFrequency] = useState<Frequency>("one_time");
  const freq = offered.includes(frequency) ? frequency : (offered[0] ?? "one_time");
  const [home, setHome] = useState({ bedrooms: 1, fullBaths: 1, halfBaths: 0 });
  const [qty, setQty] = useState<Record<string, number>>({});
  const [contact, setContact] = useState<Contact>({ firstName: "", lastName: "", email: "", phone: initialPhone });
  const [contactDone, setContactDone] = useState(false);
  const [days, setDays] = useState<DaySlots[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [address, setAddress] = useState({ line: "", apt: "", city: "", zip: "" });
  const [access, setAccess] = useState({ method: "", code: "", parking: "", pets: "", notes: "" });
  const [website, setWebsite] = useState(""); // honeypot
  const [promo, setPromo] = useState("");
  const [applied, setCoupon] = useState<{ code: string; label: string; savingCents: number; atSubtotal: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const top = useRef<HTMLDivElement>(null);

  const isQuote = service?.pricing === "quote";
  const extras = Object.entries(qty).filter(([, n]) => n > 0).map(([id, n]) => ({ serviceId: id, qty: n }));
  const choice = { serviceId, frequency: freq, home, extras };
  const q = !isQuote && service ? quote(catalog, choice) : null;
  const priced = q && !("error" in q) ? q : null;
  const subtotal = priced ? totalCents(priced.lines) : 0;
  // A promo code takes its amount off; the server works it out again.
  // A percent coupon depends on the price, so a change to the home or extras asks for the code again.
  const coupon = applied && applied.atSubtotal === subtotal ? applied : null;
  const saving = coupon ? Math.min(coupon.savingCents, subtotal) : 0;
  const total = subtotal - saving;
  const shownLines = priced ? (coupon && saving ? [...priced.lines, { kind: "coupon" as const, serviceId: null, label: coupon.label, qty: 1, unitCents: -saving, amountCents: -saving }] : priced.lines) : [];
  const homeLabel = `${home.bedrooms === 0 ? "Studio" : `${home.bedrooms} bd`} / ${home.fullBaths} ba${home.halfBaths ? ` / ${home.halfBaths} half` : ""}`;
  const title = service ? `${service.name.replace(/ Clean(ing)?$/, "")} · ${FREQUENCY_LABEL[freq]} · ${homeLabel}` : "";

  const contactOk =
    contact.firstName.trim() !== "" && /^\S+@\S+\.\S+$/.test(contact.email.trim()) && contact.phone.replace(/\D/g, "").length >= 10;
  const day = days?.find((d) => d.date === date) ?? null;
  const zipOk = /^\d{5}$/.test(address.zip.trim());
  const ready = !!priced && contactOk && !!start && address.line.trim() !== "" && address.city.trim() !== "" && zipOk && access.method !== "";

  const draft = (step: string, extra: Partial<Parameters<typeof saveDraftAction>[0]> = {}) => {
    if (contactOk) void saveDraftAction({ contact, step, choice, ...extra });
  };

  // The visit length depends on the bedrooms, so the open times are fetched again when they change.
  const bedrooms = home.bedrooms;
  useEffect(() => {
    if (!contactDone) return;
    let live = true;
    slotsAction(bedrooms).then((r) => {
      if (!live) return;
      setDays(r.days ?? []);
      setSlotsError(r.error ?? null);
      if (r.days && start && !r.days.some((d) => d.times.some((t) => t.value === start))) setStart(null);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the bedrooms change the visit length
  }, [bedrooms, contactDone]);

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await requestBookingAction({ contact, choice, start: start!, address, access, shownTotalCents: total, couponCode: coupon?.code, website });
      if ("ok" in r) {
        setDone(r.when);
        top.current?.scrollIntoView({ behavior: "smooth" });
        return;
      }
      setError(r.error);
      if (r.catalog) setCatalog(r.catalog); // new prices: the bar shows the new total
      if (r.taken) {
        setStart(null);
        const fresh = await slotsAction(bedrooms);
        setDays(fresh.days ?? []);
        document.getElementById("when")?.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  if (done !== null) {
    return (
      <div ref={top} className="card space-y-3 p-6 text-center">
        <p className="text-4xl" aria-hidden>✨</p>
        <h1 className="font-serif text-2xl font-bold">Thank you, {contact.firstName}!</h1>
        <p>
          We received your request{done ? ` for ${done}` : ""}. We&apos;ll confirm by email within 24 hours.
        </p>
        <p className="text-sm text-muted">Questions? Call or text us at {businessPhone}.</p>
      </div>
    );
  }

  return (
    <div ref={top} className="space-y-7">
      <Section n={1} title="Service">
        <p className="rounded-2xl bg-gold-soft px-4 py-3 text-sm">
          <strong>About our flat-rate prices:</strong> they assume a home in average condition. Heavy buildup needs a Deep Clean.
          We confirm the final price after reviewing your request.
        </p>
        <div className="space-y-2" role="radiogroup" aria-label="Service">
          {services.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={s.id === serviceId} className={pill(s.id === serviceId)}
              onClick={() => setServiceId(s.id)}>
              {s.name}
              {s.pricing === "quote" && <span className="font-normal opacity-80"> (get a quote)</span>}
            </button>
          ))}
        </div>
        {service?.description && <p className="px-1 text-sm text-muted">{service.description}</p>}
      </Section>

      {isQuote ? (
        <QuoteForm key={service!.id} serviceId={service!.id} office={/office/i.test(service!.name)} businessPhone={businessPhone} />
      ) : (
        <>
          {offered.length > 1 && (
            <Section n={2} title="Frequency">
              <div className="space-y-2" role="radiogroup" aria-label="Frequency">
                {offered.map((f) => (
                  <button key={f} type="button" role="radio" aria-checked={f === freq} className={pill(f === freq)} onClick={() => setFrequency(f)}>
                    {FREQUENCY_LABEL[f]} <span className="font-normal opacity-80">from {money(service!.rates[f]!.startCents).replace(/\.00$/, "")}</span>
                  </button>
                ))}
              </div>
            </Section>
          )}

          <Section n={3} title="Your home">
            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-1 text-sm font-medium">
                Bedrooms
                <select className={field} value={home.bedrooms} onChange={(e) => setHome({ ...home, bedrooms: Number(e.target.value) })}>
                  {range(0, 7).map((n) => <option key={n} value={n}>{n === 0 ? "Studio" : n}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                Full baths
                <select className={field} value={home.fullBaths} onChange={(e) => setHome({ ...home, fullBaths: Number(e.target.value) })}>
                  {range(1, 7).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                Half baths
                <select className={field} value={home.halfBaths} onChange={(e) => setHome({ ...home, halfBaths: Number(e.target.value) })}>
                  {range(0, 7).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>
          </Section>

          <Section n={4} title="Extras">
            <p className="rounded-2xl border border-gold/40 bg-gold-soft/60 px-4 py-3 text-sm">
              If you choose inside cabinets, fridge or oven, please empty them before we arrive.
            </p>
            <ExtrasGrid extras={catalog.extras} qty={qty} onChange={(id, n) => setQty({ ...qty, [id]: Math.max(n, 0) })} />
          </Section>

          <Section n={5} title="Contact">
            <div className="grid grid-cols-2 gap-2">
              <input className={field} aria-label="First name" placeholder="First name" autoComplete="given-name" value={contact.firstName}
                onChange={(e) => setContact({ ...contact, firstName: e.target.value })} />
              <input className={field} aria-label="Last name" placeholder="Last name" autoComplete="family-name" value={contact.lastName}
                onChange={(e) => setContact({ ...contact, lastName: e.target.value })} />
            </div>
            <input className={field} aria-label="Email" placeholder="Email" type="email" autoComplete="email" value={contact.email}
              onChange={(e) => setContact({ ...contact, email: e.target.value })} />
            <input className={field} aria-label="Mobile phone" placeholder="Mobile phone" type="tel" inputMode="tel" autoComplete="tel"
              value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
            {/* People never see this field; bots fill it in. */}
            <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
            {!contactDone && (
              <button type="button" disabled={!contactOk || !priced} className={`${pill(true)} disabled:opacity-40`}
                onClick={() => {
                  setContactDone(true);
                  draft("contact");
                  setTimeout(() => document.getElementById("when")?.scrollIntoView({ behavior: "smooth" }), 50);
                }}>
                See available times
              </button>
            )}
          </Section>

          {contactDone && (
            <>
              <Section n={6} title="Date & time" id="when">
                {slotsError && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{slotsError}</p>}
                {error && !start && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
                {days === null && !slotsError && <p className="text-muted">Loading open days…</p>}
                {days && days.length > 0 && (
                  <MonthCalendar days={days} today={today} selected={date} onSelect={(d) => { setDate(d); setStart(null); }} />
                )}
                {day && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold uppercase tracking-wider text-muted">{day.label}</p>
                    {day.times.map((t) => (
                      <button key={t.value} type="button" className={pill(t.value === start)} aria-pressed={t.value === start}
                        onClick={() => { setStart(t.value); draft("date", { start: t.value }); }}>
                        {t.slotLabel} · {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </Section>

              {start && (
                <>
                  <Section n={7} title="Address">
                    <input className={field} aria-label="Street address" placeholder="Street address" autoComplete="address-line1"
                      value={address.line} onChange={(e) => setAddress({ ...address, line: e.target.value })} />
                    <input className={field} aria-label="Apartment or unit (optional)" placeholder="Apt / unit (optional)"
                      autoComplete="address-line2" value={address.apt} onChange={(e) => setAddress({ ...address, apt: e.target.value })} />
                    <div className="grid grid-cols-[1fr_7rem] gap-2">
                      <input className={field} aria-label="City" placeholder="City" autoComplete="address-level2" value={address.city}
                        onChange={(e) => setAddress({ ...address, city: e.target.value })} />
                      <input className={field} aria-label="ZIP" placeholder="ZIP" inputMode="numeric" maxLength={5} autoComplete="postal-code"
                        value={address.zip} onChange={(e) => setAddress({ ...address, zip: e.target.value.replace(/\D/g, "") })}
                        onBlur={() => draft("address", { zip: address.zip, addressLine: address.line, city: address.city })} />
                    </div>
                  </Section>

                  <Section n={8} title="Access">
                    <div className="space-y-2" role="radiogroup" aria-label="How we get in">
                      {ACCESS_METHODS.map((m) => (
                        <button key={m.value} type="button" role="radio" aria-checked={access.method === m.value} className={pill(access.method === m.value)}
                          onClick={() => { setAccess({ ...access, method: m.value }); draft("access"); }}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                    {["key", "lockbox", "door_code"].includes(access.method) && (
                      <input className={field} aria-label="Code or where the key is" placeholder="Code, or where the key will be"
                        value={access.code} onChange={(e) => setAccess({ ...access, code: e.target.value })} />
                    )}
                    <input className={field} aria-label="Parking" placeholder="Parking (driveway, street, permit…)" value={access.parking}
                      onChange={(e) => setAccess({ ...access, parking: e.target.value })} />
                    <input className={field} aria-label="Pets in the home" placeholder="Pets in the home (optional)" value={access.pets}
                      onChange={(e) => setAccess({ ...access, pets: e.target.value })} />
                    <textarea className={`${field} min-h-24`} aria-label="Notes for our team" placeholder="Anything else our team should know?"
                      value={access.notes} onChange={(e) => setAccess({ ...access, notes: e.target.value })} />
                  </Section>

                  <Section n={9} title="Review">
                    <div className="card space-y-1 p-4 text-sm">
                      <p className="font-semibold">{title}</p>
                      {day && <p>{day.label} · {day.times.find((t) => t.value === start)?.slotLabel} · {day.times.find((t) => t.value === start)?.label}</p>}
                      {address.line && <p>{[address.line, address.apt, address.city, address.zip].filter(Boolean).join(", ")}</p>}
                      {coupon && saving > 0 && <p className="text-success">{coupon.label}: −{money(saving)}</p>}
                      <p className="pt-1 text-base font-bold">Total {money(total)}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="promo">Promo code (optional)</label>
                      <div className="flex gap-2">
                        <input id="promo" className={field} placeholder="Enter code" autoCapitalize="characters" autoComplete="off"
                          value={promo} onChange={(e) => { setPromo(e.target.value.toUpperCase()); setPromoError(null); }} disabled={!!coupon} />
                        {coupon ? (
                          <button type="button" className="shrink-0 rounded-full border border-line px-5 font-semibold"
                            onClick={() => { setCoupon(null); setPromo(""); }}>Remove</button>
                        ) : (
                          <button type="button" className="shrink-0 rounded-full border border-navy px-5 font-semibold text-navy disabled:opacity-40"
                            disabled={!promo.trim() || pending}
                            onClick={() => startTransition(async () => {
                              const r = await checkCouponAction({ code: promo, phone: contact.phone, choice });
                              if ("error" in r) { setPromoError(r.error); return; }
                              setCoupon({ code: promo.trim(), label: r.label, savingCents: r.savingCents, atSubtotal: subtotal });
                              setPromoError(null);
                            })}>Apply</button>
                        )}
                      </div>
                      {promoError && <p role="alert" className="text-sm text-danger">{promoError}</p>}
                    </div>
                    {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
                    <button type="button" disabled={!ready || pending} onClick={submit}
                      className="w-full rounded-full bg-gold px-4 py-3.5 text-base font-bold text-navy disabled:opacity-40">
                      {pending ? "Sending…" : "Request booking"}
                    </button>
                    <p className="text-center text-sm text-muted">This is a request. We&apos;ll confirm by email within 24 hours.</p>
                  </Section>
                </>
              )}
            </>
          )}

          {priced && <PriceSummary title={title} lines={shownLines} totalCents={total} />}
        </>
      )}
    </div>
  );
}
