#!/bin/sh
# Every e2e suite, in order, on a fresh local database; stops at the first failure.
# Before: Postgres on PGPORT (default 5499), and the dev server on :3000 started with
#   SETUP_CODE=local-setup SMTP_HOST=127.0.0.1 SMTP_PORT=2525 GMAIL_USER=test@example.com GMAIL_APP_PASSWORD=x npm run dev
# and the mail catcher: python3 tests/e2e/mail-catcher.py 2525 test-results/mails.jsonl
# Usage: sh scripts/e2e-all.sh
set -e
PGPORT=${PGPORT:-5499}
export DATABASE_URL="postgres://postgres@localhost:$PGPORT/goldcleaning"
psql -q -h localhost -p "$PGPORT" -U postgres -c "drop database if exists goldcleaning with (force)" -c "create database goldcleaning"
npm run -s db:migrate > /dev/null
npm run -s db:seed
mkdir -p test-results
run() {
  out=$(SETUP_CODE=local-setup MAIL_LOG=test-results/mails.jsonl timeout 300 node tests/e2e/$1.mjs 2>&1) || {
    echo "$1: FAILED"; echo "$out" | grep -v "^\s*at " | tail -15; exit 1; }
  echo "$1: $(echo "$out" | tail -1)"
}
run slice
psql -q -h localhost -p "$PGPORT" -U postgres goldcleaning -f tests/e2e/marketing-seed.sql
# fixes goes last: it locks the login on purpose (8 wrong passwords).
for t in marketing backup blocks booking abandoned quotes repeat discounts remove-client fixes; do run $t; done
