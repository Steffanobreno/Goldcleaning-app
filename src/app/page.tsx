import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";

// The app's address is also the one clients may type or share: visitors go to the booking page,
// and the team (already logged in) goes to its day. The team logs in at /login.
export default async function Home() {
  redirect((await getStaff()) ? "/today" : "/book");
}
