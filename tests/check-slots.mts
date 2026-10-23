// Checks the back-to-back slot rule against a local database (Oct 21 2026 is a Wednesday).
// Usage: DATABASE_URL=... npx tsx --conditions=react-server tests/check-slots.mts
import postgres from "postgres";
const sql = postgres("postgres://postgres@localhost:5499/woofers", { max: 1 });
const { findSlots, getPublicBusiness } = await import("../src/lib/booking");
const b = (await getPublicBusiness())!;
const [c] = await sql`insert into clients (business_id, first_name, phone, zip) values (${b.id}, 'T', '+14155550000', '94401') returning id`;
const day = "2026-10-21";
const show = async (label: string, min: number) => console.log(label, (await findSlots(b, "94401", min, day)).flatMap((d) => d.times.map((t) => t.label)).join(", "));
await show("empty day, 2h visit:", 120);
await show("empty day, two X-Large dogs (6h):", 360);
await sql`insert into appointments (business_id, client_id, staff_id, start_at, end_at, zip) values (${b.id}, ${c.id}, ${b.staff_id}, ${new Date('2026-10-21T14:00:00Z')}, ${new Date('2026-10-21T17:00:00Z')}, '94401')`;
await show("after a 3h dog 7-10, 2h visit:", 120);
await show("after a 3h dog 7-10, 3h visit:", 180);
await sql`delete from appointments where client_id = ${c.id}`;
await sql`delete from clients where id = ${c.id}`;
await sql.end(); process.exit(0);
