// Imports a client export into the database from the command line.
// Usage: npm run db:import -- /path/to/export.csv [--appointments]
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { dbConfig } from "../src/lib/db-config";
import { parseClientsCsv } from "../src/lib/import/clients-csv";
import { writeClients } from "../src/lib/import/write-clients";

const file = process.argv[2];
if (!file) throw new Error("Pass the CSV file path.");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const db = dbConfig(url);
const sql = postgres(db.url, { max: 1, prepare: db.prepare, onnotice: () => {} });

async function main() {
  const [b] = await sql`
    select b.id, b.timezone, (select id from staff s where s.business_id = b.id and s.role = 'owner' order by created_at limit 1) as staff_id
    from businesses b order by created_at limit 1`;
  if (!b) throw new Error("No business yet. Run npm run db:seed first.");
  const { clients, problems } = parseClientsCsv(readFileSync(file, "utf8"));
  const report = await writeClients(sql, { businessId: b.id, staffId: b.staff_id, timezone: b.timezone }, clients, {
    appointments: process.argv.includes("--appointments"),
  });
  console.log(`clients created: ${report.created}, already there: ${report.existing}, pets: ${report.pets}, upcoming visits: ${report.appointments}`);
  console.log(`rows skipped while reading: ${problems.length}, problems while writing: ${report.problems.length}, clients with more than one upcoming visit: ${report.moreUpcoming.length}`);
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
