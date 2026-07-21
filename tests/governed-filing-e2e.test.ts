import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GovernedFilingWorkflow,
  MemoryFilingRepository,
  sha256,
  type FilingProviders,
} from '../src/lib/governed-filing-workflow'

test('completes the governed filing journey across all provider boundaries', async () => {
  const body = 'Official form {{package_id}} / {{matter_id}} / {{jurisdiction}} / {{filing_date}}'
  const providerCalls: string[] = []
  const providers: FilingProviders = {
    templates: { async resolve(jurisdiction) {
      providerCalls.push('template')
      return { authority: 'Court forms office', sourceUri: 'https://court.example.test/form', jurisdiction, version: '2026.1', effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveTo: '2027-01-01T00:00:00.000Z', contentHash: sha256(body), body }
    } },
    storage: {
      async put(value) { providerCalls.push(value.name === 'governed-filing-export.json' ? 'export' : 'storage'); return { provider: 'vault', reference: `vault://${String(value.contentHash)}` } },
      async dispose() { providerCalls.push('retention'); return { provider: 'vault', reference: 'disposition-1' } },
    },
    ocr: { async extract() { providerCalls.push('ocr'); return { provider: 'ocr', reference: 'ocr-1', text: 'Verified official form' } } },
    signature: {
      async request() { providerCalls.push('signature-request'); return { provider: 'signer', reference: 'envelope-1' } },
      async status(value) { providerCalls.push('signature-status'); return { provider: 'signer', reference: value.providerReference, status: 'SIGNED', signedAt: '2026-07-10T10:00:00.000Z', signatureHash: sha256('signed-envelope') } },
    },
    filing: { async submit() { providerCalls.push('court-filing'); return { provider: 'court', reference: 'court-1', receiptHash: sha256('court-receipt') } } },
  }
  const repository = new MemoryFilingRepository()
  const workflow = new GovernedFilingWorkflow(repository, providers, 1)
  const owner = { userId: 'owner', role: 'ATTORNEY' }
  const reviewer = { userId: 'reviewer', role: 'PARTNER' }

  let state = await workflow.createPackage(owner, 'matter-1', 'Verified filing', 'NY', '2026-07-01T10:00:00.000Z')
  state = await workflow.grantAccess(owner, state.id, reviewer.userId, 'LEGAL_REVIEWER')
  state = await workflow.createAuthoritativeForm(owner, state.id)
  state = await workflow.submitReview(owner, state.id)
  state = await workflow.review(reviewer, state.id, { decision: 'APPROVE', notes: 'Jurisdiction and effective date verified.', jurisdictionChecked: true, effectiveDateChecked: true })
  state = await workflow.requestSignature(owner, state.id, 'signer@example.test', 'signature-1')
  state = await workflow.reconcileSignature(owner, state.id, 'envelope-1')
  state = await workflow.file(owner, state.id, 'filing-1')
  state = await workflow.exportPackage(owner, state.id, true, 'export-1')
  state = await workflow.setLegalHold(owner, state.id, true, 'Preservation requested')
  state = await workflow.setLegalHold(owner, state.id, false, 'Preservation released')
  state = await workflow.enforceRetention(owner, state.id, '2026-07-20T10:00:00.000Z', 'Retention schedule completed')

  assert.equal(state.status, 'CLOSED')
  assert.deepEqual(providerCalls, ['template', 'storage', 'ocr', 'signature-request', 'signature-status', 'court-filing', 'export', 'retention'])
  const audit = await repository.auditEvents(state.id)
  assert.deepEqual(audit.map((event) => event.action), [
    'FILING_PACKAGE_CREATED', 'MATTER_ACCESS_GRANTED', 'DOCUMENT_VERSION_ADDED', 'LEGAL_REVIEW_REQUESTED',
    'LEGAL_REVIEW_RECORDED', 'SIGNATURE_REQUESTED', 'SIGNATURE_RECONCILED', 'PACKAGE_FILED', 'PACKAGE_EXPORTED',
    'LEGAL_HOLD_PLACED', 'LEGAL_HOLD_RELEASED', 'RETENTION_DISPOSITION_COMPLETED',
  ])
})
