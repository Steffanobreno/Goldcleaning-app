# Woofers Dog Spa — app

Scheduling, routes and checkout for a mobile grooming business. Owner app (installable on the
phone) now; client online booking and SMS come next. Plan and decisions: `replica/`.

## Run locally

```bash
cp .env.example .env.local      # set DATABASE_URL
npm install
npm run db:migrate              # creates the tables
npm run db:seed                 # Woofers services, prices, hours and SMS texts
npm run dev                     # http://localhost:3000 → create the owner login
```

Checks: `npm run typecheck`, `npm run lint`, `npm run test:e2e` (needs the dev server and a
fresh database).

## Environment

| variable | needed | what for |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres (Supabase or Neon in production) |
| `GOOGLE_MAPS_API_KEY` | optional | address geocoding and the route map; restrict it to your domain |
| `APP_URL` | later | links sent to clients |
