import "server-only";
import { sql } from "./db";

// A full copy of one business's data as JSON: clients, pets, visits, services, money,
// messages and settings. The weekly Google Drive backup (Settings → Backups) saves it,
// together with the client list as a spreadsheet. Left out: passwords and login sessions,
// the secret keys, pet photos and drawn signatures (pictures would make the file too big;
// the typed signature name and date are kept).

export async function buildBackup(businessId: string) {
  const b = businessId;
  const tables: Record<string, ReturnType<typeof sql>> = {
    businesses: sql`select * from businesses where id = ${b}`,
    staff: sql`select * from staff where business_id = ${b}`,
    working_hours: sql`select w.* from working_hours w join staff s on s.id = w.staff_id where s.business_id = ${b}`,
    time_off: sql`select t.* from time_off t join staff s on s.id = t.staff_id where s.business_id = ${b}`,
    services: sql`select * from services where business_id = ${b}`,
    service_prices: sql`select p.* from service_prices p join services s on s.id = p.service_id where s.business_id = ${b}`,
    clients: sql`select * from clients where business_id = ${b}`,
    client_notes: sql`select n.* from client_notes n join clients c on c.id = n.client_id where c.business_id = ${b}`,
    pets: sql`select p.* from pets p join clients c on c.id = p.client_id where c.business_id = ${b}`,
    vaccines: sql`select v.* from vaccines v join pets p on p.id = v.pet_id join clients c on c.id = p.client_id where c.business_id = ${b}`,
    appointment_series: sql`select * from appointment_series where business_id = ${b}`,
    appointments: sql`select * from appointments where business_id = ${b}`,
    appointment_pets: sql`select ap.* from appointment_pets ap join appointments a on a.id = ap.appointment_id where a.business_id = ${b}`,
    appointment_services: sql`
      select s.* from appointment_services s join appointment_pets ap on ap.id = s.appointment_pet_id
      join appointments a on a.id = ap.appointment_id where a.business_id = ${b}`,
    invoices: sql`select * from invoices where business_id = ${b}`,
    invoice_items: sql`select it.* from invoice_items it join invoices i on i.id = it.invoice_id where i.business_id = ${b}`,
    payments: sql`select p.* from payments p join invoices i on i.id = p.invoice_id where i.business_id = ${b}`,
    agreements: sql`select * from agreements where business_id = ${b}`,
    agreement_signatures: sql`
      select s.id, s.agreement_id, s.agreement_version, s.client_id, s.signed_name, s.ip, s.signed_at, s.created_at
      from agreement_signatures s join agreements a on a.id = s.agreement_id where a.business_id = ${b}`,
    message_templates: sql`select * from message_templates where business_id = ${b}`,
    messages: sql`select * from messages where business_id = ${b} and created_at > now() - interval '1 year'`,
    campaigns: sql`select * from campaigns where business_id = ${b}`,
    campaign_recipients: sql`select r.* from campaign_recipients r join campaigns c on c.id = r.campaign_id where c.business_id = ${b}`,
  };
  const names = Object.keys(tables);
  const rows = await Promise.all(names.map((n) => tables[n]));
  const data: Record<string, unknown[]> = {};
  names.forEach((n, i) => (data[n] = [...rows[i]]));
  // Never copy the secrets out.
  for (const biz of data.businesses as Record<string, unknown>[]) {
    delete biz.device_key;
    delete biz.vapid_private;
  }
  return {
    format: "woofers-backup",
    version: 1,
    created_at: new Date().toISOString(),
    counts: Object.fromEntries(names.map((n) => [n, data[n].length])),
    tables: data,
  };
}
