# Gold Cleaning — app

Online booking with live flat-rate prices and the owner's app (installable on the iPhone) for
Peninsula Gold Cleaning. Built from the Woofers Dog Spa app (Duperpower `production` 0208d81).

- Design: `docs/design.md` (approved 2026-10-23) · mockups: `docs/mockups/`
- Build plan: `docs/plan.md`
- Setup guide (Neon, Netlify, Gmail, iPhone): `docs/guia-configuracao.md`

## Run locally

```bash
cp .env.example .env.local      # set DATABASE_URL
npm install
npm run db:migrate              # creates the tables
npm run db:seed                 # business, services, prices, slots and email texts
npm run dev                     # http://localhost:3000 → create the owner login
```

Checks: `npm run typecheck`, `npm run lint`, `npm run test:unit`, and the e2e scripts in
`tests/e2e/`. `sh scripts/e2e-all.sh` runs them all in order on a fresh local database (its
header says how to start the dev server and the local mail catcher first).
