ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'SECRETARY';

CREATE TABLE IF NOT EXISTS "governed_filing_packages" (
  "id" TEXT NOT NULL,
  "matterId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "jurisdiction" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "state" JSONB NOT NULL,
  "retentionUntil" TIMESTAMP(3) NOT NULL,
  "disposedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "governed_filing_packages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "governed_filing_packages_matterId_fkey"
    FOREIGN KEY ("matterId") REFERENCES "matters"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "governed_filing_packages_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "governed_filing_packages_version_check" CHECK ("version" > 0)
);

CREATE INDEX IF NOT EXISTS "governed_filing_packages_matterId_status_idx"
  ON "governed_filing_packages"("matterId", "status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'governed_filing_packages_version_check') THEN
    ALTER TABLE "governed_filing_packages"
      ADD CONSTRAINT "governed_filing_packages_version_check" CHECK ("version" > 0);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS "governed_document_versions" (
  "id" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "contentHash" TEXT NOT NULL,
  "storageProvider" TEXT NOT NULL,
  "storageReference" TEXT NOT NULL,
  "sourceReference" TEXT NOT NULL,
  "ocrProvider" TEXT NOT NULL,
  "ocrReference" TEXT NOT NULL,
  "privileged" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "governed_document_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "governed_document_versions_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "governed_filing_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "governed_document_versions_version_check" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "governed_document_versions_package_document_version_key"
  ON "governed_document_versions"("packageId", "documentId", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "governed_document_versions_package_document_hash_key"
  ON "governed_document_versions"("packageId", "documentId", "contentHash");
CREATE INDEX IF NOT EXISTS "governed_document_versions_package_privileged_idx"
  ON "governed_document_versions"("packageId", "privileged");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'governed_document_versions_version_check') THEN
    ALTER TABLE "governed_document_versions"
      ADD CONSTRAINT "governed_document_versions_version_check" CHECK ("version" > 0);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS "governed_filing_audit_events" (
  "id" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "matterId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "previousHash" TEXT NOT NULL,
  "eventHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "governed_filing_audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "governed_filing_audit_events_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "governed_filing_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "governed_filing_audit_events_sequence_check" CHECK ("sequence" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "governed_filing_audit_events_eventHash_key"
  ON "governed_filing_audit_events"("eventHash");
CREATE UNIQUE INDEX IF NOT EXISTS "governed_filing_audit_events_package_sequence_key"
  ON "governed_filing_audit_events"("packageId", "sequence");
CREATE INDEX IF NOT EXISTS "governed_filing_audit_events_matter_package_sequence_idx"
  ON "governed_filing_audit_events"("matterId", "packageId", "sequence");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'governed_filing_audit_events_sequence_check') THEN
    ALTER TABLE "governed_filing_audit_events"
      ADD CONSTRAINT "governed_filing_audit_events_sequence_check" CHECK ("sequence" > 0);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION reject_governed_filing_evidence_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'governed filing evidence is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS governed_filing_audit_immutable ON "governed_filing_audit_events";
CREATE TRIGGER governed_filing_audit_immutable
BEFORE UPDATE OR DELETE ON "governed_filing_audit_events"
FOR EACH ROW EXECUTE FUNCTION reject_governed_filing_evidence_mutation();

DROP TRIGGER IF EXISTS governed_document_versions_immutable ON "governed_document_versions";
CREATE TRIGGER governed_document_versions_immutable
BEFORE UPDATE OR DELETE ON "governed_document_versions"
FOR EACH ROW EXECUTE FUNCTION reject_governed_filing_evidence_mutation();
