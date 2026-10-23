"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { convertQuote, setQuoteStatus, type QuoteStatus } from "@/lib/data/quotes";

export async function setQuoteStatusAction(id: string, status: Extract<QuoteStatus, "new" | "replied" | "archived">) {
  const staff = await requireStaff();
  await setQuoteStatus(staff, id, status);
  revalidatePath("/requests");
}

/** Makes the client (and their place) from the request and opens the booking form for them. */
export async function convertQuoteAction(id: string) {
  const staff = await requireStaff();
  const done = await convertQuote(staff, id);
  if (!done) redirect("/requests?tab=quotes");
  revalidatePath("/requests");
  revalidatePath("/clients");
  redirect(`/appointments/new?client=${done.clientId}&home=${done.homeId}`);
}
