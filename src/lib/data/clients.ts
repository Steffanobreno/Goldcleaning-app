import "server-only";
import type { StaffContext } from "../auth";
import { sql } from "../db";
import { isUuid } from "../format";

export type ClientRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  access_notes: string | null;
  sms_consent_at: Date | null;
  imported_last_service_at: Date | null;
  sms_opted_out_at: Date | null;
  archived_at: Date | null;
  online_booking_blocked: boolean;
  email_unsubscribed_at: Date | null;
  created_at: Date;
  imported_total_sales_cents: number | null;
};

export type PetRow = {
  id: string;
  client_id: string;
  name: string;
  species: string;
  breed: string | null;
  size_class: string | null;
  weight_lbs: string | null;
  coat_type: string | null;
  birth_date: string | null;
  sex: string | null;
  behavior: string | null;
  vet_name: string | null;
  vet_phone: string | null;
  deceased_at: Date | null;
  notes: string | null;
  rebook_every_days: number | null;
  photo_version: string | null;
};

export const fullName = (c: { first_name: string; last_name: string }) =>
  `${c.first_name} ${c.last_name}`.trim();

export const fullAddress = (c: Pick<ClientRow, "address_line" | "city" | "state" | "zip">) =>
  [c.address_line, c.city, [c.state, c.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");

export async function listClients(staff: StaffContext, q: string, inactive = false) {
  const term = q.trim();
  const like = `%${term}%`;
  const digits = term.replace(/\D/g, "");
  return sql<(ClientRow & { pet_names: string | null; pet_breeds: string | null; is_new: boolean })[]>`
    select c.*, (select string_agg(p.name, ', ' order by p.name) from pets p
                 where p.client_id = c.id and p.deceased_at is null) as pet_names,
      (select string_agg(distinct p.breed, ', ') from pets p
       where p.client_id = c.id and p.deceased_at is null and p.breed is not null) as pet_breeds,
      -- "New": no finished visit yet, here or in the old app.
      (c.imported_last_service_at is null and not exists (
         select 1 from appointments a where a.client_id = c.id and a.status = 'completed')) as is_new
    from clients c
    where c.business_id = ${staff.businessId} and (c.archived_at is not null) = ${inactive}
      and (${term} = ''
           or c.first_name || ' ' || c.last_name ilike ${like}
           or (${digits} <> '' and c.phone like ${"%" + digits + "%"})
           or exists (select 1 from pets p where p.client_id = c.id and p.name ilike ${like}))
    order by c.first_name, c.last_name
    limit 1000`;
}

/** How many clients and pets the business has (the counts on top of the client list). */
export async function clientCounts(staff: StaffContext) {
  const [row] = await sql<{ clients: number; pets: number }[]>`
    select (select count(*) from clients where business_id = ${staff.businessId} and archived_at is null)::int as clients,
           (select count(*) from pets p join clients c on c.id = p.client_id
             where c.business_id = ${staff.businessId} and c.archived_at is null and p.deceased_at is null)::int as pets`;
  return row;
}

export async function getClient(staff: StaffContext, id: string) {
  if (!isUuid(id)) return null;
  const [client] = await sql<ClientRow[]>`
    select * from clients where id = ${id} and business_id = ${staff.businessId}`;
  return client ?? null;
}

export async function listPets(staff: StaffContext, clientId: string) {
  return sql<PetRow[]>`
    select p.*, p.birth_date::text as birth_date,
      (select ph.updated_at::text from pet_photos ph where ph.pet_id = p.id) as photo_version
    from pets p join clients c on c.id = p.client_id
    where p.client_id = ${clientId} and c.business_id = ${staff.businessId} and p.deceased_at is null
    order by p.name`;
}

export async function getPet(staff: StaffContext, petId: string) {
  if (!isUuid(petId)) return null;
  const [pet] = await sql<PetRow[]>`
    select p.*, p.birth_date::text as birth_date,
      (select ph.updated_at::text from pet_photos ph where ph.pet_id = p.id) as photo_version
    from pets p join clients c on c.id = p.client_id
    where p.id = ${petId} and c.business_id = ${staff.businessId}`;
  return pet ?? null;
}

export async function listClientNotes(staff: StaffContext, clientId: string) {
  return sql<{ id: string; body: string; created_at: Date; staff_name: string | null }[]>`
    select n.id, n.body, n.created_at, s.name as staff_name
    from client_notes n join clients c on c.id = n.client_id
    left join staff s on s.id = n.staff_id
    where n.client_id = ${clientId} and c.business_id = ${staff.businessId}
    order by n.created_at desc`;
}

export async function clientHistory(staff: StaffContext, clientId: string) {
  return sql<{ id: string; start_at: Date; status: string; total_cents: number; pets: string | null; paid: boolean; upcoming: boolean }[]>`
    select a.id, a.start_at, a.status,
      (a.start_at >= now() and a.status not in ('cancelled', 'no_show', 'declined')) as upcoming,
      coalesce((select sum(s.price_cents) from appointment_pets ap
                join appointment_services s on s.appointment_pet_id = ap.id
                where ap.appointment_id = a.id), 0)::int as total_cents,
      (select string_agg(p.name, ', ') from appointment_pets ap join pets p on p.id = ap.pet_id
       where ap.appointment_id = a.id) as pets,
      exists (select 1 from invoices i where i.appointment_id = a.id and i.status = 'closed') as paid
    from appointments a
    where a.client_id = ${clientId} and a.business_id = ${staff.businessId}
    order by a.start_at desc
    limit 50`;
}


/** Money and habits for the client profile: what they paid here, what's open, how often they come. */
export async function clientSummary(staff: StaffContext, clientId: string) {
  const [[money], payments, gaps] = await Promise.all([
    sql<{ paid: number; tips: number; unpaid: number }[]>`
      select coalesce((select sum(p.amount_cents) from payments p join invoices i on i.id = p.invoice_id
                       where i.client_id = ${clientId} and i.business_id = ${staff.businessId}), 0)::int as paid,
             coalesce((select sum(p.tip_cents) from payments p join invoices i on i.id = p.invoice_id
                       where i.client_id = ${clientId} and i.business_id = ${staff.businessId}), 0)::int as tips,
             coalesce((select sum(greatest(i.total_cents - i.paid_cents, 0)) from invoices i
                       where i.client_id = ${clientId} and i.business_id = ${staff.businessId} and i.status = 'open'), 0)::int
             + coalesce((select sum(s.price_cents) from appointments a join appointment_pets ap on ap.appointment_id = a.id
                         join appointment_services s on s.appointment_pet_id = ap.id
                         where a.client_id = ${clientId} and a.business_id = ${staff.businessId} and a.status = 'completed'
                           and not exists (select 1 from invoices i where i.appointment_id = a.id)), 0)::int as unpaid`,
    sql<{ id: string; received_at: Date; method: string; amount_cents: number; tip_cents: number; appointment_id: string | null }[]>`
      select p.id, p.received_at, p.method, p.amount_cents, p.tip_cents, i.appointment_id
      from payments p join invoices i on i.id = p.invoice_id
      where i.client_id = ${clientId} and i.business_id = ${staff.businessId}
      order by p.received_at desc limit 20`,
    // Days between finished visits, for the "actual frequency".
    sql<{ avg_days: number | null }[]>`
      select round(avg(gap))::int as avg_days from (
        select extract(epoch from start_at - lag(start_at) over (order by start_at)) / 86400 as gap
        from appointments where client_id = ${clientId} and business_id = ${staff.businessId} and status = 'completed') g
      where gap is not null`,
  ]);
  return { ...money, payments, actualDays: gaps[0]?.avg_days ?? null };
}
