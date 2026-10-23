"use client";
import { useState, useTransition, type ReactNode } from "react";
import { StepCard } from "@/components/client-shell";
import { DOG_BREEDS } from "@/lib/breeds";
import { minutesLabel, money, SIZES } from "@/lib/format";
import { blobToDataUrl, resizeImage } from "@/lib/resize-image";
import type { DaySlots } from "@/lib/booking";
import {
  ArrowLeft, Camera, Check, Close, Dog, Hourglass, Pencil, Pin, Plus, Search, Sign,
} from "@/components/icons";
import { MonthCalendar } from "./month-calendar";
import { SignaturePad } from "./signature-pad";
import {
  availabilityAction,
  lookupClientAction,
  trackDraftAction,
  requestBookingAction,
  type KnownClient,
  type PetRequest,
} from "./actions";

// The client booking page: one question per screen, like a native app.
// phone → (new: about you) → address → pets → per pet: service, extras → time → review → done.
// Nothing is saved until the last screen; the server checks everything again.

type Service = {
  id: string;
  name: string;
  kind: "service" | "addon";
  category: string | null;
  size_class: string | null;
  description: string | null;
  duration_min: number;
  price_cents: number;
};

type Who = KnownClient | { known: false; mustSign: boolean };
type Pet = {
  key: string;
  petId?: string;
  on: boolean;
  name: string;
  breed: string;
  size: string;
  sizeKnown: boolean; // the size is on file: don't ask again
  mainId: string;
  extraIds: string[];
  matted: boolean | null;
  photo?: string;
};
type Step =
  | { name: "phone" | "about" | "address" | "pets" | "newpet" | "time" | "review" }
  | { name: "service" | "extras"; i: number };

let nextKey = 0;
const blankPet = (): Pet => ({
  key: `new-${nextKey++}`, on: true, name: "", breed: "", size: "", sizeKnown: false, mainId: "", extraIds: [], matted: null,
});
const digits = (s: string) => s.replace(/\D/g, "");
/** $129 rather than $129.00. */
const price = (cents: number) => money(cents).replace(/\.00$/, "");

export function BookingWizard({
  services,
  businessName,
  businessPhone,
  today,
  agreementTitle,
  agreement,
  initialPhone = "",
}: {
  initialPhone?: string; // from the "finish booking" link
  services: Service[];
  businessName: string;
  businessPhone: string;
  today: string;
  agreementTitle: string | null;
  agreement: ReactNode | null;
}) {
  const [history, setHistory] = useState<Step[]>([{ name: "phone" }]);
  const [phone, setPhone] = useState(initialPhone);
  const [who, setWho] = useState<Who | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [draft, setDraft] = useState<Pet>(blankPet);
  const [useFileAddress, setUseFileAddress] = useState(true);
  const [address, setAddress] = useState({ address: "", city: "", zip: "" });
  const [contact, setContact] = useState({ firstName: "", lastName: "", email: "", notes: "", website: "" });
  const [days, setDays] = useState<DaySlots[]>([]);
  const [day, setDay] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"time" | "agreement" | null>(null);
  const [consent, setConsent] = useState(true);
  const [signed, setSigned] = useState<{ name: string; drawing: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const step = history.at(-1)!;
  const go = (s: Step) => {
    setError(null);
    setHistory([...history, s]);
    window.scrollTo({ top: 0 });
  };
  const back = () => {
    setError(null);
    setSheet(null);
    setHistory(history.length > 1 ? history.slice(0, -1) : history);
  };

  const byId = new Map(services.map((s) => [s.id, s]));
  const demat = services.find((s) => s.kind === "addon" && /demat/i.test(s.name));
  const known = who?.known === true ? who : null;
  const fileAddress = !!known?.hasAddress && useFileAddress;
  const chosen = pets.filter((p) => p.on);
  const serviceIdsOf = (p: Pet) => [p.mainId, ...p.extraIds, ...(p.matted && demat ? [demat.id] : [])].filter(Boolean);
  const requests: PetRequest[] = chosen.map((p) => ({
    petId: p.petId, name: p.name, breed: p.breed, size: p.size, serviceIds: serviceIdsOf(p), photo: p.photo,
  }));
  const lines = chosen.flatMap((p) => serviceIdsOf(p).map((id) => byId.get(id)).filter((s): s is Service => !!s));
  const total = lines.reduce((s, x) => s + x.price_cents, 0);
  const minutes = lines.reduce((s, x) => s + x.duration_min, 0);
  const mustSign = !!agreement && !!who?.mustSign;
  const updatePet = (key: string, patch: Partial<Pet>) => setPets(pets.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const lookup = () =>
    startTransition(async () => {
      setError(null);
      const res = await lookupClientAction(phone);
      if (res.error || res.known === undefined) return setError(res.error ?? "Something went wrong. Please try again.");
      setWho(res);
      // Remember how far they got, for the "finish booking" message (best effort).
      void trackDraftAction({ phone, step: "phone" });
      if (res.known) {
        setPets(res.pets.map((p) => ({
          key: p.id, petId: p.id, on: res.pets.length === 1, name: p.name, breed: p.breed ?? "", size: p.size ?? "",
          sizeKnown: !!p.size, mainId: "", extraIds: [], matted: null,
        })));
        setUseFileAddress(res.hasAddress);
        go({ name: "address" });
      } else {
        setPets([]);
        go({ name: "about" });
      }
    });

  const afterAddress = () => {
    void trackDraftAction(fileAddress ? { phone, step: "address" }
      : { phone, step: "address", zip: address.zip, addressLine: address.address, city: address.city });
    if (pets.length === 0) {
      setDraft(blankPet());
      go({ name: "newpet" });
    } else go({ name: "pets" });
  };

  const saveDraft = () => {
    const pet = { ...draft, name: draft.name.trim(), breed: draft.breed.trim(), sizeKnown: true };
    setPets([...pets.filter((p) => p.key !== pet.key), pet]);
    setError(null);
    // Back to the pet list (replacing this screen, so "back" from the list doesn't reopen the form).
    const rest = history.slice(0, -1);
    setHistory(rest.at(-1)?.name === "pets" ? rest : [...rest, { name: "pets" }]);
  };

  const findTimes = () =>
    startTransition(async () => {
      setError(null);
      void trackDraftAction({
        phone, step: "times", pets: chosen.map((p) => p.name).join(" & "),
        petDetails: chosen.map((p) => ({
          name: p.name, breed: p.breed, size: p.size,
          service: byId.get(p.mainId)?.name ?? "", addons: p.extraIds.map((id) => byId.get(id)?.name ?? "").filter(Boolean),
        })),
      });
      const res = await availabilityAction({ phone, useFileAddress: fileAddress, zip: address.zip, pets: requests });
      if (res.error) return setError(res.error);
      setDays(res.days ?? []);
      // Start on a day we're already nearby, when there is one.
      setDay((res.days?.find((d) => d.near) ?? res.days?.[0])?.date ?? null);
      setStart(null);
      go({ name: "time" });
    });

  const submit = () =>
    startTransition(async () => {
      setError(null);
      if (!start) return;
      const res = await requestBookingAction({
        phone,
        pets: requests,
        start,
        useFileAddress: fileAddress,
        ...address,
        ...contact,
        smsConsent: consent,
        agreed: !!signed,
        signature: signed?.name ?? "",
        signatureDrawing: signed?.drawing,
      });
      if (res.error) setError(res.error);
      else {
        setDone(res.when ?? "your chosen time");
        window.scrollTo({ top: 0 });
      }
    });

  const startOver = () => {
    setHistory([{ name: "phone" }]);
    setDone(null);
    setWho(null);
    setPets([]);
    setStart(null);
    setSigned(null);
    setContact({ ...contact, notes: "" });
  };

  if (done) return <Submitted when={done} pets={chosen.map((p) => p.name)} businessPhone={businessPhone} onAgain={startOver} />;

  const errorBox = error && (
    <p role="alert" className="mt-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
      {error}
    </p>
  );
  const header = (title: string, sub?: ReactNode) => (
    <div className="mb-6">
      {history.length > 1 && (
        <button type="button" onClick={back} aria-label="Back" className="-ml-2 mb-3 flex h-10 w-10 items-center justify-center rounded-full hover:bg-bg">
          <ArrowLeft size={24} />
        </button>
      )}
      <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
      {sub && <p className="mt-2 text-muted">{sub}</p>}
    </div>
  );

  switch (step.name) {
    case "phone":
      return (
        <StepCard flush>
          <div className="px-4 pt-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- static photo */}
            <img src="/van.jpg" alt="The Woofers Dog Spa grooming van" width={900} height={507} className="mx-auto w-full max-w-sm" />
          </div>
          <div className="p-5 pt-2 sm:p-7 sm:pt-2">
          <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">Welcome!</h1>
          <p className="mt-2 text-muted">
            Mobile grooming at your door, anywhere in the Bay Area. Book in a minute: we&apos;ll bring the spa to you. 🐾
          </p>
          <label className="mt-7 block">
            <span className="mb-2 block font-bold">Start with your phone number</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              aria-label="Mobile phone"
              placeholder="(650) 555-0123"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && digits(phone).length >= 10 && lookup()}
              className={inputClass}
            />
          </label>
          <p className="mt-2 text-sm text-muted">Been here before? We&apos;ll find your pets and address, so you don&apos;t type them again.</p>
          {errorBox}
          <BigButton disabled={pending || digits(phone).length < 10} onClick={lookup} className="mt-6">
            {pending ? "One moment…" : "Next"}
          </BigButton>
          </div>
        </StepCard>
      );

    case "about":
      return (
        <StepCard>
          {header("About you", "Welcome! It looks like your first visit with us.")}
          <div className="space-y-5">
            <div>
              <span className={labelClass}>Your name</span>
              <div className="grid grid-cols-2 gap-3">
                <input aria-label="First name" placeholder="First" autoComplete="given-name" className={inputClass}
                  value={contact.firstName} onChange={(e) => setContact({ ...contact, firstName: e.target.value })} />
                <input aria-label="Last name" placeholder="Last" autoComplete="family-name" className={inputClass}
                  value={contact.lastName} onChange={(e) => setContact({ ...contact, lastName: e.target.value })} />
              </div>
            </div>
            <label className="block">
              <span className={labelClass}>Email address</span>
              <span className="-mt-1 mb-2 block text-sm text-muted">We send your confirmation and reminders here (and a link to finish, if you stop halfway).</span>
              <input type="email" aria-label="Email" placeholder="you@example.com" autoComplete="email" className={inputClass}
                value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
            </label>
          </div>
          {errorBox}
          <BigButton
            className="mt-8"
            disabled={!contact.firstName.trim() || !contact.lastName.trim() || !contact.email.trim()}
            onClick={() => {
              if (!/^\S+@\S+\.\S+$/.test(contact.email.trim())) return setError("Please check your email address.");
              void trackDraftAction({ phone, step: "contact", firstName: contact.firstName, lastName: contact.lastName, email: contact.email });
              go({ name: "address" });
            }}
          >
            Continue
          </BigButton>
        </StepCard>
      );

    case "address":
      return (
        <StepCard>
          {header(known ? `Welcome back, ${known.firstName}!` : "Where should we park the van?",
            known ? "Where should we park the van this time?" : "We groom in our van right outside your door.")}
          {known?.hasAddress && (
            <div className="mb-4 space-y-3" role="radiogroup" aria-label="Address">
              <ChoiceCard selected={useFileAddress} onClick={() => setUseFileAddress(true)} icon={<Pin />}
                title="Same address as last time" sub={known.city ? `in ${known.city}` : "the address we have on file"} />
              <ChoiceCard selected={!useFileAddress} onClick={() => setUseFileAddress(false)} icon={<Plus />}
                title="Somewhere else" sub="Type the new address" />
            </div>
          )}
          {!fileAddress && (
            <div className="space-y-4">
              <label className="block">
                <span className={labelClass}>Street address</span>
                <input aria-label="Street address" autoComplete="street-address" placeholder="123 Main St" className={inputClass}
                  value={address.address} onChange={(e) => setAddress({ ...address, address: e.target.value })} />
              </label>
              <div className="grid grid-cols-[1fr_8rem] gap-3">
                <label className="block">
                  <span className={labelClass}>City</span>
                  <input aria-label="City" autoComplete="address-level2" placeholder="San Mateo" className={inputClass}
                    value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
                </label>
                <label className="block">
                  <span className={labelClass}>ZIP code</span>
                  <input aria-label="ZIP code" inputMode="numeric" maxLength={5} autoComplete="postal-code" placeholder="94401" className={inputClass}
                    value={address.zip} onChange={(e) => setAddress({ ...address, zip: digits(e.target.value) })} />
                </label>
              </div>
            </div>
          )}
          {errorBox}
          <BigButton
            className="mt-8"
            disabled={!fileAddress && (!address.address.trim() || !address.city.trim() || address.zip.length !== 5)}
            onClick={afterAddress}
          >
            Continue
          </BigButton>
        </StepCard>
      );

    case "pets":
      return (
        <StepCard>
          {header("Who are we grooming?", "Pick one or more pets.")}
          <div className="space-y-3">
            {pets.map((p) => (
              <div key={p.key} className="relative">
                <ChoiceCard
                  multi
                  selected={p.on}
                  onClick={() => updatePet(p.key, { on: !p.on })}
                  icon={p.photo ? <PetAvatar photo={p.photo} /> : <Dog size={26} />}
                  title={p.name}
                  sub={[p.breed, p.size ? SIZES.find((s) => s.value === p.size)?.label : null].filter(Boolean).join(" · ") || "Dog"}
                />
                {!p.petId && (
                  <button type="button" className="absolute right-14 top-1/2 -translate-y-1/2 rounded-full p-2 text-muted hover:bg-bg"
                    aria-label={`Edit ${p.name}`} onClick={() => { setDraft(p); go({ name: "newpet" }); }}>
                    <Pencil size={18} />
                  </button>
                )}
              </div>
            ))}
            {chosen.length < 4 && (
              <button
                type="button"
                onClick={() => { setDraft(blankPet()); go({ name: "newpet" }); }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line py-4 font-semibold text-brand hover:border-brand"
              >
                <Plus size={18} /> {pets.length ? "Add another pet" : "Add a pet"}
              </button>
            )}
          </div>
          {errorBox}
          <BigButton className="mt-8" disabled={chosen.length === 0 || chosen.length > 4} onClick={() => go({ name: "service", i: 0 })}>
            Continue to service
          </BigButton>
        </StepCard>
      );

    case "newpet":
      return (
        <StepCard>
          {header(draft.name.trim() ? draft.name : "Tell us about your pet")}
          <div className="space-y-6">
            <div>
              <span className={labelClass}>Type</span>
              <span className="inline-flex rounded-full bg-brand px-7 py-2.5 font-semibold text-on-brand">Dog</span>
            </div>
            <BreedSearch value={draft.breed} onChange={(breed) => setDraft({ ...draft, breed })} />
            <label className="block">
              <span className={labelClass}>Name</span>
              <input aria-label="Pet's name" autoComplete="off" placeholder="Your pet's name" className={inputClass}
                value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <SizePicker value={draft.size} onChange={(size) => setDraft({ ...draft, size, mainId: "" })} />
          </div>
          {errorBox}
          <BigButton className="mt-8" disabled={!draft.name.trim() || !draft.size} onClick={saveDraft}>
            Save {draft.name.trim() || "pet"}
          </BigButton>
        </StepCard>
      );

    case "service": {
      const pet = chosen[step.i];
      if (!pet) return null;
      return (
        <StepCard>
          {header("Select a service")}
          <PetTabs pets={chosen} current={step.i} hint="Select service" />
          {!pet.sizeKnown && (
            <div className="mb-6">
              <SizePicker value={pet.size} onChange={(size) => updatePet(pet.key, { size, mainId: "" })} />
            </div>
          )}
          {pet.size ? (
            <ServiceList
              title={`Services for ${pet.name}`}
              services={services.filter((s) => s.kind === "service" && (!s.size_class || s.size_class === pet.size))}
              selected={pet.mainId}
              onSelect={(mainId) => updatePet(pet.key, { mainId })}
            />
          ) : (
            <p className="rounded-2xl bg-bg px-4 py-3 text-sm text-muted">Pick {pet.name}&apos;s size to see the prices.</p>
          )}
          {errorBox}
          <BigButton className="mt-8" disabled={!pet.mainId} onClick={() => go({ name: "extras", i: step.i })}>
            Continue
          </BigButton>
        </StepCard>
      );
    }

    case "extras": {
      const pet = chosen[step.i];
      if (!pet) return null;
      const extras = services.filter((s) => s.kind === "addon" && s.id !== demat?.id && (s.price_cents > 0 || s.duration_min > 0));
      const included = services.filter((s) => s.kind === "addon" && s.price_cents === 0 && s.duration_min === 0);
      const isLast = step.i === chosen.length - 1;
      return (
        <StepCard>
          {header("Additional pet info")}
          <PetTabs pets={chosen} current={step.i} hint="Add info" />
          <div className="space-y-7">
            {demat && (
              <div>
                <span className={labelClass}>Does {pet.name} need dematting or a shave-down? ({price(demat.price_cents)})</span>
                <div className="flex gap-3" role="radiogroup" aria-label="Dematting">
                  {[true, false].map((v) => (
                    <button key={String(v)} type="button" role="radio" aria-checked={pet.matted === v}
                      onClick={() => updatePet(pet.key, { matted: v })}
                      className={`min-w-28 rounded-full border-2 px-6 py-3 font-semibold ${
                        pet.matted === v ? "border-brand bg-brand-soft text-brand-strong" : "border-line"
                      }`}>
                      {v ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-sm text-muted">Not sure? Pick “No”. We&apos;ll check the coat when we arrive.</p>
              </div>
            )}
            {extras.length > 0 && (
              <div>
                <span className={labelClass}>Extras (optional)</span>
                <div className="space-y-2">
                  {extras.map((a) => {
                    const on = pet.extraIds.includes(a.id);
                    return (
                      <button key={a.id} type="button" role="checkbox" aria-checked={on}
                        onClick={() => updatePet(pet.key, { extraIds: on ? pet.extraIds.filter((x) => x !== a.id) : [...pet.extraIds, a.id] })}
                        className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left ${on ? "border-brand bg-brand-soft" : "border-line"}`}>
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-brand bg-brand text-white" : "border-line"}`}>
                          {on && <Check size={16} strokeWidth={3} />}
                        </span>
                        <span className="flex-1 font-medium">{a.name}</span>
                        <PricePill cents={a.price_cents} />
                      </button>
                    );
                  })}
                </div>
                {included.length > 0 && (
                  <p className="mt-2 text-sm text-muted">Always included: {included.map((a) => a.name.replace(/\s*\(.*\)$/, "")).join(", ")}.</p>
                )}
              </div>
            )}
            {!pet.petId && <PhotoPicker name={pet.name} photo={pet.photo} onPhoto={(photo) => updatePet(pet.key, { photo })} />}
          </div>
          {errorBox}
          <BigButton
            className="mt-8"
            disabled={pending || (!!demat && pet.matted === null)}
            onClick={() => (isLast ? findTimes() : go({ name: "service", i: step.i + 1 }))}
          >
            {pending ? "Finding open times…" : `Confirm info for ${pet.name}`}
          </BigButton>
        </StepCard>
      );
    }

    case "time": {
      const selected = days.find((d) => d.date === day);
      const am = selected?.times.filter((t) => t.label.endsWith("AM")) ?? [];
      const pm = selected?.times.filter((t) => t.label.endsWith("PM")) ?? [];
      const picked = selected?.times.find((t) => t.value === start);
      return (
        <StepCard>
          {header("Select a time", <>Your visit takes about {minutesLabel(minutes)}. The time is when we arrive.</>)}
          {days.some((d) => d.near) && (
            <div className="mb-5 rounded-2xl bg-success-soft p-4">
              <p className="font-bold text-success">🚐 We&apos;re already in your area on</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {days.filter((d) => d.near).slice(0, 6).map((d) => (
                  <button key={d.date} type="button" aria-pressed={day === d.date} onClick={() => { setDay(d.date); setStart(null); }}
                    className={`rounded-full border-2 px-3 py-1.5 text-sm font-semibold ${day === d.date ? "border-success bg-success text-white" : "border-success/40 bg-surface"}`}>
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm text-muted">These days are easiest for us, so they fill up first.</p>
            </div>
          )}
          <MonthCalendar days={days} today={today} selected={day} onSelect={(d) => { setDay(d); setStart(null); }} />
          {selected && (
            <div className="mt-7 space-y-5" role="group" aria-label="Open times">
              {selected.times.some((t) => t.best) && (
                <p className="text-sm text-muted">⭐ Best times: we&apos;re right around the corner then.</p>
              )}
              {[["Morning", am], ["Afternoon", pm]].map(([label, list]) =>
                (list as typeof am).length ? (
                  <div key={label as string}>
                    <p className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">{label as string}</p>
                    <div className="flex flex-wrap gap-2">
                      {(list as typeof am).map((t) => (
                        <button key={t.value} type="button" aria-pressed={start === t.value}
                          onClick={() => { setStart(t.value); setSheet("time"); }}
                          className={`rounded-full border-2 px-5 py-3 font-semibold ${start === t.value ? "border-brand bg-brand text-on-brand" : "border-line hover:border-brand"}`}>
                          {t.best && "⭐ "}{t.label.toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null,
              )}
            </div>
          )}
          {sheet === "time" && selected && picked && (
            <Sheet title={`${picked.label.toLowerCase()}, ${longDate(selected.date)}`} sub={inDays(today, selected.date)} onClose={() => setSheet(null)}>
              <Summary
                place={fileAddress ? `Address on file${known?.city ? ` in ${known.city}` : ""}` : `${address.address}, ${address.city}, CA ${address.zip}`}
                pets={chosen.map((p) => ({ name: p.name, services: serviceIdsOf(p).map((id) => byId.get(id)?.name ?? "") }))}
                total={total}
              />
              <BigButton className="mt-6" onClick={() => { setSheet(null); void trackDraftAction({ phone, step: "review", start: start ?? undefined }); go({ name: "review" }); }}>Continue</BigButton>
            </Sheet>
          )}
        </StepCard>
      );
    }

    case "review":
      return (
        <StepCard>
          {header(known ? "Almost done" : "Personal info")}
          <dl className="divide-y divide-line rounded-2xl border border-line">
            <InfoRow label="Name" value={known ? known.firstName : `${contact.firstName} ${contact.lastName}`.trim()} />
            <InfoRow label="Phone" value={phone} />
            {!known && contact.email && <InfoRow label="Email" value={contact.email} />}
            <InfoRow label="Address"
              value={fileAddress ? `Address on file${known?.city ? ` in ${known.city}` : ""}` : `${address.address}, ${address.city}, CA ${address.zip}`} />
            <InfoRow label="When"
              value={(() => {
                const d = days.find((x) => x.date === day);
                const t = d?.times.find((x) => x.value === start);
                return d && t ? `${longDate(d.date)} at ${t.label.toLowerCase()}` : "";
              })()} />
            <div className="px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Pets and services</dt>
              <dd>
                <ul className="mt-1 space-y-1">
                  {chosen.map((p) => (
                    <li key={p.key}>
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-muted"> · {serviceIdsOf(p).map((id) => byId.get(id)?.name).join(", ")}</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
            <p className="flex justify-between rounded-b-2xl bg-bg px-4 py-3 text-lg font-bold">
              <span>Estimated total</span>
              <span>{price(total)}</span>
            </p>
          </dl>

          <h2 className="mb-2 mt-8 text-xl font-extrabold">Additional info</h2>
          <textarea aria-label="Anything we should know? (optional)" rows={3} className={inputClass}
            placeholder="Gate code, parking, nervous with the dryer…"
            value={contact.notes} onChange={(e) => setContact({ ...contact, notes: e.target.value })} />
          {/* Hidden from people; bots fill it in. */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" value={contact.website} onChange={(e) => setContact({ ...contact, website: e.target.value })} />
            </label>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-bg px-4 py-4">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[var(--color-brand)]" />
            <span>
              <span className="block font-semibold">Text me about my appointments</span>
              <span className="block text-sm text-muted">Confirmations and reminders from {businessName}. Msg &amp; data rates may apply. Tell us anytime to stop.</span>
            </span>
          </label>

          {mustSign && (
            <>
              <h2 className="mb-2 mt-8 text-xl font-extrabold">Agreement</h2>
              <button type="button" onClick={() => setSheet("agreement")}
                className="flex w-full items-center gap-4 rounded-2xl border border-line px-4 py-4 text-left hover:border-brand">
                <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-bg">
                  <Sign size={24} />
                  {signed && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-success text-white">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span>
                  <span className="block font-bold">{agreementTitle ?? "Service agreement"}</span>
                  <span className={`block text-sm font-medium ${signed ? "text-success" : "text-brand"}`}>
                    {signed ? `Signed by ${signed.name}` : "Read and sign"}
                  </span>
                </span>
              </button>
            </>
          )}
          {errorBox}
          <BigButton className="mt-8" disabled={pending || (mustSign && !signed)} onClick={submit}>
            {pending ? "Sending…" : "Submit booking request"}
          </BigButton>
          <p className="mt-3 text-center text-xs text-muted">
            This is a request: we&apos;ll text you to confirm. The final price can change for matting or behavior.
          </p>
          {sheet === "agreement" && agreement && (
            <AgreementSheet agreement={agreement} title={agreementTitle ?? "Service agreement"}
              onClose={() => setSheet(null)} onSigned={(s) => { setSigned(s); setSheet(null); }} />
          )}
        </StepCard>
      );
  }
}

// ——— Pieces ———

const inputClass =
  "block w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";
const labelClass = "mb-2 block font-semibold";

function BigButton({ className = "", ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={`block w-full rounded-full bg-brand px-6 py-4 text-lg font-semibold text-on-brand shadow-[0_6px_16px_rgb(10_132_204/0.25)] transition hover:bg-brand-strong active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-brand/35 disabled:shadow-none ${className}`}
      {...props}
    />
  );
}

function PricePill({ cents }: { cents: number }) {
  const label = cents === 0 ? "Free" : price(cents);
  return <span className="shrink-0 rounded-full bg-bg px-3 py-1.5 font-bold">{label}</span>;
}

function ChoiceCard({
  selected, onClick, icon, title, sub, multi = false,
}: { selected: boolean; onClick: () => void; icon: ReactNode; title: string; sub?: string; multi?: boolean }) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={selected}
      aria-label={title}
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-4 text-left transition-colors ${
        selected ? "border-brand bg-brand-soft" : "border-line hover:border-brand/50"
      }`}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface text-ink shadow-sm">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-bold">{title}</span>
        {sub && <span className="block truncate text-sm text-muted">{sub}</span>}
      </span>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-brand bg-brand text-white" : "border-line"}`}>
        {selected && <Check size={16} strokeWidth={3} />}
      </span>
    </button>
  );
}

function PetAvatar({ photo }: { photo: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- local preview of the picked file
  return <img src={photo} alt="" className="h-full w-full object-cover" />;
}

function PetTabs({ pets, current, hint }: { pets: Pet[]; current: number; hint: string }) {
  return (
    <div className="-mx-1 mb-6 flex gap-3 overflow-x-auto px-1 pb-1">
      {pets.map((p, i) => (
        <div key={p.key}
          className={`flex shrink-0 items-center gap-3 rounded-2xl border-2 py-2.5 pl-2.5 pr-5 ${
            i === current ? "border-brand bg-brand-soft" : "border-line opacity-70"
          }`}>
          <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-surface">
            {p.photo ? <PetAvatar photo={p.photo} /> : <Dog size={24} />}
          </span>
          <span>
            <span className="block font-bold">{p.name}</span>
            <span className={`block text-sm ${i < current ? "text-success" : "text-brand"}`}>{i < current ? "Done" : hint}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function SizePicker({ value, onChange }: { value: string; onChange: (size: string) => void }) {
  return (
    <div>
      <span className="block font-semibold">Size</span>
      <span className="block text-sm text-muted">Measured along the back, from the neck to the base of the tail.</span>
      {/* eslint-disable-next-line @next/next/no-img-element -- static chart */}
      <img src="/size-chart.jpg" alt="Size chart: Small 12 inches or less, Medium 12 to 16, Large 16 to 20, X-Large 20 inches or up"
        width={900} height={304} className="my-3 w-full" />
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Size">
        {SIZES.map((s) => {
          const [name, inches] = s.label.replace(")", "").split(" (");
          return (
            <button key={s.value} type="button" role="radio" aria-checked={value === s.value} aria-label={s.label}
              onClick={() => onChange(s.value)}
              className={`rounded-2xl border-2 px-3 py-3 text-left ${value === s.value ? "border-brand bg-brand-soft" : "border-line"}`}>
              <span className="block font-bold">{name}</span>
              <span className="block text-sm text-muted">{inches}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BreedSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();
  const matches = q
    ? DOG_BREEDS.filter((b) => b.toLowerCase().includes(q))
        .sort((a, b) => Number(!a.toLowerCase().startsWith(q)) - Number(!b.toLowerCase().startsWith(q)))
        .slice(0, 6)
    : [];
  const exact = DOG_BREEDS.some((b) => b.toLowerCase() === q);
  return (
    <div className="relative">
      <label className="block">
        <span className={labelClass}>Breed</span>
        <span className="relative block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input aria-label="Breed" autoComplete="off" placeholder="Search breed (or Mixed)" className={`${inputClass} pl-12`}
            role="combobox" aria-expanded={open && matches.length > 0 && !exact} aria-controls="breed-list"
            value={value} onFocus={() => setOpen(true)} onChange={(e) => { onChange(e.target.value); setOpen(true); }}
            onBlur={() => setTimeout(() => setOpen(false), 150)} />
        </span>
      </label>
      {open && matches.length > 0 && !exact && (
        <ul id="breed-list" role="listbox" className="absolute inset-x-0 z-10 mt-1 overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
          {matches.map((b) => (
            <li key={b} role="option" aria-selected={false}>
              <button type="button" className="block w-full px-4 py-3 text-left hover:bg-brand-soft"
                onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(b); setOpen(false); }}>
                {b}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ServiceList({
  title, services, selected, onSelect,
}: { title: string; services: Service[]; selected: string; onSelect: (id: string) => void }) {
  const categories = [...new Set(services.map((s) => s.category).filter((c): c is string => !!c))];
  const [category, setCategory] = useState<string | null>(null);
  const [details, setDetails] = useState<string | null>(null);
  const shown = services.filter((s) => !category || s.category === category);
  return (
    <div>
      <h2 className="mb-3 text-xl font-extrabold">{title}</h2>
      {categories.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
          {[null, ...categories].map((c) => (
            <button key={c ?? "all"} type="button" role="radio" aria-checked={category === c} onClick={() => setCategory(c)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${category === c ? "border-navy bg-navy text-white" : "border-line"}`}>
              {c ?? "All"}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-3" role="radiogroup" aria-label="Service">
        {shown.map((s) => (
          <div key={s.id}
            className={`rounded-2xl border-2 transition-colors ${selected === s.id ? "border-brand bg-brand-soft" : "border-line hover:border-brand/50"}`}>
            <button type="button" role="radio" aria-checked={selected === s.id} onClick={() => onSelect(s.id)}
              className="flex w-full items-start gap-3 px-4 pb-2 pt-4 text-left">
              <span className="flex-1">
                <span className="block text-lg font-bold leading-snug">{s.name}</span>
                <span className="block text-sm text-muted">{minutesLabel(s.duration_min)}</span>
              </span>
              <PricePill cents={s.price_cents} />
            </button>
            <div className="px-4 pb-3">
              {s.description && (
                <button type="button" className="text-sm font-semibold text-brand" aria-expanded={details === s.id}
                  onClick={() => setDetails(details === s.id ? null : s.id)}>
                  {details === s.id ? "Hide details" : "Show details"}
                </button>
              )}
              {details === s.id && <p className="mt-1 whitespace-pre-line text-sm text-muted">{s.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhotoPicker({ name, photo, onPhoto }: { name: string; photo?: string; onPhoto: (dataUrl: string | undefined) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <span className={labelClass}>Photo of {name} (optional)</span>
      <div className="flex items-center gap-4">
        <label className="relative flex h-28 w-28 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-bg text-muted hover:bg-brand-soft">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview of the picked file
            <img src={photo} alt="Your pet" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-xs font-semibold">
              <Camera size={28} />
              {busy ? "Loading…" : "Add photo"}
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label={`Photo of ${name}`}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              try {
                onPhoto(await blobToDataUrl(await resizeImage(file)));
              } catch {
                onPhoto(undefined);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        {photo && (
          <button type="button" className="text-sm font-semibold text-danger" onClick={() => onPhoto(undefined)}>
            Remove photo
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">Helps us recognize {name} and plan the groom.</p>
    </div>
  );
}

function Sheet({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-navy/50 animate-fade sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl animate-sheet sm:rounded-[28px]"
      >
        <div className="mb-5 flex items-start gap-3">
          <div className="flex-1">
            <h2 id="sheet-title" className="text-xl font-extrabold">{title}</h2>
            {sub && <p className="text-brand">{sub}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 rounded-full p-2 hover:bg-bg">
            <Close size={24} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Summary({ place, pets, total }: { place: string; pets: { name: string; services: string[] }[]; total: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 rounded-2xl border border-line px-4 py-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bg"><Pin /></span>
        <span className="font-semibold">{place}</span>
      </div>
      {pets.map((p) => (
        <div key={p.name} className="flex items-center gap-4 rounded-2xl border border-line px-4 py-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bg"><Dog size={22} /></span>
          <span>
            <span className="block font-bold">{p.name}</span>
            <span className="block text-sm text-muted">{p.services.join(", ")}</span>
          </span>
        </div>
      ))}
      <p className="flex justify-between px-1 text-lg font-bold">
        <span>Estimated total</span>
        <span>{price(total)}</span>
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

function AgreementSheet({
  agreement, title, onClose, onSigned,
}: { agreement: ReactNode; title: string; onClose: () => void; onSigned: (s: { name: string; drawing: string }) => void }) {
  const [name, setName] = useState("");
  const [drawing, setDrawing] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="max-h-[40dvh] overflow-y-auto rounded-2xl border border-line bg-bg p-4" tabIndex={0} aria-label="Service agreement">
        {agreement}
      </div>
      <label className="mt-4 flex items-start gap-3">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[var(--color-brand)]" />
        <span>I have read and agree to the service agreement.</span>
      </label>
      <label className="mt-4 block">
        <span className={labelClass}>Your full name</span>
        <input aria-label="Type your full name to sign" autoComplete="name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="mt-4">
        <span className={labelClass}>Signature</span>
        <SignaturePad onChange={setDrawing} />
      </div>
      <BigButton className="mt-6" disabled={!agreed || name.trim().length < 3 || !drawing}
        onClick={() => drawing && onSigned({ name: name.trim(), drawing })}>
        Sign agreement
      </BigButton>
    </Sheet>
  );
}

function Submitted({ when, pets, businessPhone, onAgain }: { when: string; pets: string[]; businessPhone: string; onAgain: () => void }) {
  return (
    <StepCard flush>
      <div className="px-4 pt-4" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- static photo */}
        <img src="/van.jpg" alt="" width={900} height={507} className="mx-auto w-full max-w-sm" />
      </div>
      <div className="p-6 sm:p-8">
        <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">Yay! Your booking request was sent. 🎉</h1>
        <p className="mt-2 text-muted">
          {pets.join(" & ")}, {when}.
        </p>
        <ol className="mt-6 rounded-2xl border border-line p-5">
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success text-white"><Check size={16} strokeWidth={3} /></span>
            <span className="font-bold">Request sent</span>
          </li>
          <li aria-hidden className="ml-3.5 h-6 border-l-2 border-dashed border-line" />
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg"><Hourglass size={16} /></span>
            <span>
              <span className="block font-bold">Waiting for confirmation</span>
              <span className="block text-sm text-muted">We&apos;ll text you as soon as it&apos;s confirmed. Questions? Text us at {businessPhone}.</span>
            </span>
          </li>
        </ol>
        <button type="button" onClick={onAgain} className="mt-6 block w-full text-center font-semibold text-brand">
          Book another appointment
        </button>
      </div>
    </StepCard>
  );
}

const longDate = (ymd: string) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const inDays = (today: string, ymd: string) => {
  const n = Math.round((Date.parse(`${ymd}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  return n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;
};
