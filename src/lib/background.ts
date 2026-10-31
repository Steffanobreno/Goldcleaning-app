import "server-only";
import { after } from "next/server";

// Slow outside calls (sending email) run after the screen has answered, so tapping
// "Accept" or "Collect payment" doesn't wait on the mail server. Outside a request
// (scripts, tests) it simply runs now.
export async function inBackground(task: () => Promise<unknown>) {
  const run = () => task().catch((e) => console.error("background task failed", e));
  try {
    after(run);
  } catch {
    await run();
  }
}
