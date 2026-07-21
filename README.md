# Small Law Firm

Small Law Firm is a Next.js/Prisma practice-management application. Its production-grade legal journey is the governed filing package workflow: matter-scoped access, authoritative court templates, immutable document provenance, independent legal review, e-signature reconciliation, verified filing receipts, privilege-aware export, legal holds, and retention disposition.

## Safe local setup

Requirements: Node.js 22+, PostgreSQL 16+, and the external provider contracts listed in `.env.example`.

```bash
npm ci
cp .env.example .env
npx prisma generate
npx prisma db push
npx prisma db execute --file prisma/migrations/20260720090000_governed_filing_workflow/migration.sql --schema prisma/schema.prisma
npm test
npm run build
./start.sh
```

`start.sh` never installs packages, creates/resets/seeds/migrates a database, edits environment files, builds the app, or kills a process. It refuses to start when configuration, dependencies, the database, the build (in production), or the selected port are unavailable.

Seeding is an explicit development-only operation. Set a unique `SEED_USER_PASSWORD` of at least 16 characters and run `npm run db:seed`; the application does not publish demo credentials.

## Governed filing API

- `POST /api/governed-filings` creates a package only for lead counsel, partners, or administrators and resolves an allow-listed authoritative template.
- `GET /api/governed-filings/{id}` returns a permission- and privilege-filtered state plus the append-only audit chain.
- `POST /api/governed-filings/{id}/actions` accepts access, document-version, form, review, signature, filing, legal-hold, export, and retention actions.

Every external provider uses HTTPS bearer authentication, a 15-second timeout, typed evidence fields, and idempotency keys. The application does not simulate provider success. Provider credentials and allowlists are deployment gates; court/template authority values should be managed by firm counsel and operations.

Legal approval must come from an independent attorney/partner/administrator who explicitly confirms jurisdiction and template effective date. Provider signature status is reconciled by counsel; an unverified callback cannot advance the workflow.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit --audit-level=high
```

Unit tests cover redaction, revocation, version conflicts, template provenance, independent review, signer failure/retry, idempotent filing, export, legal holds, retention, and audit hashing. Database integration tests run when `TEST_DATABASE_URL` is set and verify normalized versions and database-enforced immutability. CI provisions an isolated PostgreSQL service, applies the schema and additive migration twice, and runs all checks plus a secret scan.
