import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canonical,
  FilingWorkflowError,
  GovernedFilingWorkflow,
  MemoryFilingRepository,
  sha256,
  type FilingActor,
  type FilingProviders,
  type FilingState,
} from '../src/lib/governed-filing-workflow'

const owner: FilingActor = { userId: 'owner', role: 'ATTORNEY' }
const reviewer: FilingActor = { userId: 'reviewer', role: 'PARTNER' }
const viewer: FilingActor = { userId: 'viewer', role: 'PARALEGAL' }
const filingDate = '2026-07-01T12:00:00.000Z'

function fixture(options: { badTemplateHash?: boolean; failSignatureOnce?: boolean } = {}) {
  const repository = new MemoryFilingRepository()
  const calls = { dispose: 0, export: 0, signature: 0, filing: 0 }
  const body = 'Court form {{package_id}} for {{matter_id}} in {{jurisdiction}} on {{filing_date}}'
  const providers: FilingProviders = {
    templates: {
      async resolve(jurisdiction) {
        return {
          authority: 'State Court Rules Office',
          sourceUri: 'https://courts.example.gov/forms/verified',
          jurisdiction,
          version: '2026.1',
          effectiveFrom: '2026-01-01T00:00:00.000Z',
          effectiveTo: '2027-01-01T00:00:00.000Z',
          contentHash: options.badTemplateHash ? 'bad' : sha256(body),
          body,
        }
      },
    },
    storage: {
      async put(value) {
        if (value.name === 'governed-filing-export.json') calls.export += 1
        return { provider: 'vault', reference: `vault://${String(value.contentHash)}` }
      },
      async dispose() {
        calls.dispose += 1
        return { provider: 'vault', reference: `disposition-${calls.dispose}` }
      },
    },
    ocr: { async extract(value) { return { provider: 'ocr', reference: `ocr://${String(value.contentHash)}`, text: 'verified filing text' } } },
    signature: {
      async request() {
        calls.signature += 1
        if (options.failSignatureOnce && calls.signature === 1) throw Object.assign(new Error('down'), { code: 'ESIGN_503' })
        return { provider: 'signer', reference: `envelope-${calls.signature}` }
      },
      async status(value) {
        return {
          provider: 'signer', reference: value.providerReference, status: 'SIGNED',
          signedAt: '2026-07-10T12:00:00.000Z', signatureHash: sha256('signed-envelope'),
        }
      },
    },
    filing: {
      async submit() {
        calls.filing += 1
        return { provider: 'court', reference: `court-${calls.filing}`, receiptHash: sha256('receipt') }
      },
    },
  }
  return { repository, calls, workflow: new GovernedFilingWorkflow(repository, providers, 1) }
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => error instanceof FilingWorkflowError && error.code === code)
}

async function reviewedFixture(options: { failSignatureOnce?: boolean } = {}) {
  const value = fixture(options)
  let state = await value.workflow.createPackage(owner, 'matter-1', 'Verified motion', 'NY', filingDate)
  state = await value.workflow.grantAccess(owner, state.id, reviewer.userId, 'LEGAL_REVIEWER')
  state = await value.workflow.addDocument(owner, state.id, {
    name: 'Motion.pdf', kind: 'PLEADING', contentBase64: Buffer.from('motion-v1').toString('base64'), sourceReference: 'client-upload:1', privileged: true,
  })
  state = await value.workflow.submitReview(owner, state.id)
  state = await value.workflow.review(reviewer, state.id, {
    decision: 'APPROVE', notes: 'Authority and effective date verified against court source.', jurisdictionChecked: true, effectiveDateChecked: true,
  })
  return { ...value, state }
}

test('rejects templates with invalid provenance digest', async () => {
  const { workflow } = fixture({ badTemplateHash: true })
  await expectCode(workflow.createPackage(owner, 'matter-1', 'Motion', 'NY', filingDate), 'TEMPLATE_HASH_MISMATCH')
})

test('enforces matter access revocation and privileged redaction', async () => {
  const { workflow, state: approved } = await reviewedFixture()
  await workflow.grantAccess(owner, approved.id, viewer.userId, 'VIEWER')
  const redacted = await workflow.view(viewer, approved.id)
  assert.deepEqual(redacted.documents, {})
  assert.equal('notes' in redacted.reviews[0], false)
  assert.equal(redacted.audit?.find((event) => event.action === 'LEGAL_REVIEW_RECORDED')?.payloadRedacted, true)
  assert.equal(redacted.audit?.find((event) => event.action === 'DOCUMENT_VERSION_ADDED')?.payloadRedacted, true)
  await workflow.revokeAccess(owner, approved.id, viewer.userId, 'Matter assignment ended')
  await expectCode(workflow.view(viewer, approved.id), 'PACKAGE_NOT_FOUND')
})

test('keeps immutable versions and rejects stale concurrent writes', async () => {
  const { workflow, repository } = fixture()
  const created = await workflow.createPackage(owner, 'matter-1', 'Motion', 'NY', filingDate)
  const stale = await repository.load(created.id) as FilingState
  const first = await workflow.addDocument(owner, created.id, {
    name: 'Motion.pdf', kind: 'PLEADING', contentBase64: Buffer.from('version one').toString('base64'), sourceReference: 'upload:1',
  })
  const documentId = Object.keys(first.documents)[0]
  const second = await workflow.addDocument(owner, created.id, {
    name: 'Motion.pdf', kind: 'PLEADING', contentBase64: Buffer.from('version two').toString('base64'), sourceReference: 'upload:2', documentId,
  })
  assert.equal(second.documents[documentId].versions.length, 2)
  await expectCode(repository.mutate(stale.id, stale.version, stale, owner, 'STALE_WRITE', {}), 'VERSION_CONFLICT')
})

test('requires independent counsel and explicit jurisdiction/effective-date checks', async () => {
  const { workflow } = fixture()
  let state = await workflow.createPackage(owner, 'matter-1', 'Motion', 'NY', filingDate)
  state = await workflow.addDocument(owner, state.id, {
    name: 'Motion.pdf', kind: 'PLEADING', contentBase64: Buffer.from('motion').toString('base64'), sourceReference: 'upload:1',
  })
  state = await workflow.submitReview(owner, state.id)
  await workflow.grantAccess(owner, state.id, owner.userId === reviewer.userId ? 'other' : reviewer.userId, 'LEGAL_REVIEWER')
  await expectCode(workflow.review(owner, state.id, { decision: 'APPROVE', notes: 'checked', jurisdictionChecked: true, effectiveDateChecked: true }), 'INDEPENDENCE_REQUIRED')
  await expectCode(workflow.review(reviewer, state.id, { decision: 'APPROVE', notes: 'checked', jurisdictionChecked: false, effectiveDateChecked: true }), 'VALIDATION_REQUIRED')
})

test('persists signer failure, permits retry, reconciles, and files idempotently', async () => {
  const { workflow, calls, state: approved } = await reviewedFixture({ failSignatureOnce: true })
  let state = await workflow.requestSignature(owner, approved.id, 'signer@example.com', 'sign-1')
  assert.equal(state.status, 'SIGNER_FAILED')
  assert.equal(state.signatures[0].failureCode, 'ESIGN_503')
  state = await workflow.requestSignature(owner, approved.id, 'signer@example.com', 'sign-1')
  assert.equal(state.status, 'SIGNATURE_PENDING')
  state = await workflow.reconcileSignature(owner, approved.id, 'envelope-2')
  assert.equal(state.status, 'SIGNED')
  state = await workflow.file(owner, approved.id, 'file-1')
  const repeated = await workflow.file(owner, approved.id, 'file-1')
  assert.equal(repeated.filing?.reference, 'court-1')
  assert.equal(calls.filing, 1)
})

test('exports only authorized privileged data', async () => {
  const { workflow, calls, state } = await reviewedFixture()
  await workflow.grantAccess(owner, state.id, viewer.userId, 'VIEWER')
  await expectCode(workflow.exportPackage(viewer, state.id, true, 'export-private'), 'PRIVILEGED_EXPORT_FORBIDDEN')
  await workflow.exportPackage(viewer, state.id, false, 'export-public')
  await workflow.exportPackage(owner, state.id, true, 'export-private')
  assert.equal(calls.export, 2)
})

test('legal hold blocks disposition and due retention disposes once', async () => {
  const { workflow, calls, state: approved } = await reviewedFixture()
  let state = await workflow.requestSignature(owner, approved.id, 'signer@example.com', 'sign-1')
  state = await workflow.reconcileSignature(owner, state.id, 'envelope-1')
  state = await workflow.file(owner, state.id, 'file-1')
  state = await workflow.setLegalHold(owner, state.id, true, 'Active preservation notice')
  await expectCode(workflow.enforceRetention(owner, state.id, '2026-07-20T10:00:00.000Z', 'Scheduled disposal'), 'LEGAL_HOLD_ACTIVE')
  state = await workflow.setLegalHold(owner, state.id, false, 'Preservation notice released')
  state = await workflow.enforceRetention(owner, state.id, '2026-07-20T10:00:00.000Z', 'Scheduled disposal')
  assert.equal(state.status, 'CLOSED')
  assert.equal(calls.dispose, 1)
})

test('audit events form a deterministic append-only hash chain', async () => {
  const { workflow, repository } = fixture()
  const state = await workflow.createPackage(owner, 'matter-1', 'Motion', 'NY', filingDate)
  await workflow.addDocument(owner, state.id, {
    name: 'Motion.pdf', kind: 'PLEADING', contentBase64: Buffer.from('motion').toString('base64'), sourceReference: 'upload:1',
  })
  const events = await repository.auditEvents(state.id)
  assert.equal(events.length, 2)
  for (const [index, event] of events.entries()) {
    assert.equal(event.previousHash, index === 0 ? 'GENESIS' : events[index - 1].eventHash)
    const { packageId, matterId, sequence, actorId, action, payload, previousHash } = event
    assert.equal(event.eventHash, sha256(canonical({ packageId, matterId, sequence, actorId, action, payload, previousHash })))
  }
})
