import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { prisma } from '../src/lib/prisma'
import { PrismaFilingRepository } from '../src/lib/governed-filing-repository'
import { GovernedFilingWorkflow, sha256, type FilingProviders } from '../src/lib/governed-filing-workflow'

const enabled = Boolean(process.env.TEST_DATABASE_URL)

test('persists a governed filing and database rejects evidence mutation', { skip: !enabled }, async () => {
  const suffix = randomUUID()
  const owner = await prisma.user.create({
    data: { email: `owner-${suffix}@example.test`, name: 'Owner', password: 'not-used-in-integration-test', role: 'ATTORNEY' },
  })
  const reviewer = await prisma.user.create({
    data: { email: `reviewer-${suffix}@example.test`, name: 'Reviewer', password: 'not-used-in-integration-test', role: 'PARTNER' },
  })
  const client = await prisma.client.create({
    data: { clientNumber: `CLIENT-${suffix}`, firstName: 'Integration', lastName: 'Test', createdById: owner.id },
  })
  const matter = await prisma.matter.create({
    data: { matterNumber: `MATTER-${suffix}`, name: 'Integration filing', clientId: client.id, leadAttorneyId: owner.id, caseType: 'CIVIL_LITIGATION' },
  })
  const body = 'Verified form for {{matter_id}}'
  const providers: FilingProviders = {
    templates: { async resolve(jurisdiction) { return {
      authority: 'Court', sourceUri: 'https://courts.example.test/form', jurisdiction, version: '1',
      effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveTo: '2027-01-01T00:00:00.000Z', contentHash: sha256(body), body,
    } } },
    storage: {
      async put(value) { return { provider: 'vault', reference: `vault://${String(value.contentHash)}` } },
      async dispose() { return { provider: 'vault', reference: 'disposition' } },
    },
    ocr: { async extract() { return { provider: 'ocr', reference: 'ocr://1', text: 'verified content' } } },
    signature: {
      async request() { return { provider: 'signer', reference: 'envelope-1' } },
      async status(value) { return { provider: 'signer', reference: value.providerReference, status: 'SIGNED', signedAt: '2026-07-10T12:00:00.000Z', signatureHash: sha256('signed') } },
    },
    filing: { async submit() { return { provider: 'court', reference: 'court-1', receiptHash: sha256('receipt') } } },
  }
  const workflow = new GovernedFilingWorkflow(new PrismaFilingRepository(), providers)
  let state = await workflow.createPackage({ userId: owner.id, role: owner.role }, matter.id, 'Verified motion', 'NY', '2026-07-01T12:00:00.000Z')
  state = await workflow.grantAccess({ userId: owner.id, role: owner.role }, state.id, reviewer.id, 'LEGAL_REVIEWER')
  state = await workflow.addDocument({ userId: owner.id, role: owner.role }, state.id, {
    name: 'motion.pdf', kind: 'PLEADING', contentBase64: Buffer.from('motion').toString('base64'), sourceReference: 'integration:test', privileged: true,
  })
  state = await workflow.submitReview({ userId: owner.id, role: owner.role }, state.id)
  state = await workflow.review({ userId: reviewer.id, role: reviewer.role }, state.id, {
    decision: 'APPROVE', notes: 'Court source and effective date checked.', jurisdictionChecked: true, effectiveDateChecked: true,
  })
  assert.equal(state.status, 'APPROVED')
  assert.equal(await prisma.governedDocumentVersion.count({ where: { packageId: state.id } }), 1)
  assert.equal(await prisma.governedFilingAuditEvent.count({ where: { packageId: state.id } }), 5)
  await assert.rejects(
    prisma.$executeRaw`UPDATE "governed_filing_audit_events" SET "action" = 'TAMPERED' WHERE "packageId" = ${state.id}`,
    /append-only/,
  )
  await assert.rejects(
    prisma.$executeRaw`DELETE FROM "governed_document_versions" WHERE "packageId" = ${state.id}`,
    /append-only/,
  )
})

test.after(async () => {
  await prisma.$disconnect()
})
