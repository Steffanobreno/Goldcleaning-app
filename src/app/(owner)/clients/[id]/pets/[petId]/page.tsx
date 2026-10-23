import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getPet } from "@/lib/data/clients";
import { Card, Page, PageHeader } from "@/components/ui";
import { addVaccineAction, deleteVaccineAction, savePetAction, setPetPassedAction } from "../../../actions";
import { listVaccines, SOON_DAYS, VACCINE_NAMES } from "@/lib/data/vaccines";
import { addDaysYmd, todayYmd } from "@/lib/format";
import { VaccineForm } from "./vaccine-form";
import { PetPhotoUpload } from "../../../pet-photo-upload";
import { PetPhoto } from "@/components/pet-photo";
import { PetForm } from "../../../forms";

export const metadata: Metadata = { title: "Edit pet" };

export default async function EditPetPage({ params }: PageProps<"/clients/[id]/pets/[petId]">) {
  const staff = await requireStaff();
  const { id, petId } = await params;
  const [pet, vaccines] = await Promise.all([getPet(staff, petId), listVaccines(staff, petId)]);
  if (!pet || pet.client_id !== id) notFound();
  const today = todayYmd(staff.timezone);
  const soon = addDaysYmd(today, SOON_DAYS);
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
  return (
    <>
      <PageHeader title={`Edit ${pet.name}`} back={`/clients/${id}`} />
      <Page>
        <Card className="flex items-center gap-4">
          <PetPhoto petId={petId} version={pet.photo_version} name={pet.name} size={88} />
          <PetPhotoUpload petId={petId} hasPhoto={!!pet.photo_version} />
        </Card>
        <Card>
          <PetForm action={savePetAction.bind(null, id, petId)} initial={pet} />
        </Card>
        <Card className="space-y-3">
          <h2 className="font-bold">Vaccines</h2>
          {vaccines.length === 0 ? (
            <p className="text-sm text-muted">None on file yet. Add them from the certificate: you&apos;ll see a warning when one expires, and the client gets a reminder.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {vaccines.map((v) => {
                const state = !v.expires_on ? null : v.expires_on < today ? "expired" : v.expires_on <= soon ? "soon" : "ok";
                return (
                  <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-semibold">{v.name}</span>
                      <span className="block text-xs text-muted">
                        {v.expires_on ? `Expires ${fmt(v.expires_on)}` : "No expiry date"}{v.given_on ? ` · given ${fmt(v.given_on)}` : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {state && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${state === "expired" ? "bg-danger-soft text-danger" : state === "soon" ? "bg-warn-soft text-warn" : "bg-success-soft text-success"}`}>
                          {state === "expired" ? "Expired" : state === "soon" ? "Expires soon" : "Up to date"}
                        </span>
                      )}
                      <form action={deleteVaccineAction.bind(null, id, petId, v.id)}>
                        <button type="submit" aria-label={`Delete ${v.name}`} className="text-xs font-semibold text-danger">Delete</button>
                      </form>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <VaccineForm action={addVaccineAction.bind(null, id, petId)} names={VACCINE_NAMES} />
        </Card>
        <form action={setPetPassedAction.bind(null, id, petId, !pet.deceased_at)} className="text-center">
          <button type="submit" className="text-sm font-semibold text-muted underline">
            {pet.deceased_at ? `Undo: ${pet.name} is still with us` : `${pet.name} passed away 🌈`}
          </button>
          {!pet.deceased_at && <p className="mt-1 text-xs text-muted">Hides {pet.name} from booking and stops reminders. Visit history stays.</p>}
        </form>
      </Page>
    </>
  );
}
