import { createHash, randomUUID } from 'node:crypto'

export type MatterPermission = 'OWNER' | 'EDITOR' | 'LEGAL_REVIEWER' | 'VIEWER'

export interface FilingActor {
  userId: string
  role: string
}

export interface FilingProviders {
  templates: { resolve(jurisdiction: string, asOf: string): Promise<Record<string, unknown>> }
  storage: {
    put(value: Record<string, unknown>): Promise<Record<string, unknown>>
    dispose(value: Record<string, unknown>): Promise<Record<string, unknown>>
  }
  ocr: { extract(value: Record<string, unknown>): Promise<Record<string, unknown>> }
  signature: {
    request(value: Record<string, unknown>): Promise<Record<string, unknown>>
    status(value: Record<string, unknown>): Promise<Record<string, unknown>>
  }
  filing: { submit(value: Record<string, unknown>): Promise<Record<string, unknown>> }
}

export interface FilingAuditEvent {
  packageId: string
  matterId: string
  sequence: number
  actorId: string
  action: string
  payload: Record<string, unknown>
  previousHash: string
  eventHash: string
  createdAt: string
  payloadRedacted?: boolean
}

export interface FilingState {
  id: string
  matterId: string
  title: string
  jurisdiction: string
  filingDate: string
  status: string
  createdBy: string
  version: number
  members: Record<string, { permission: MatterPermission; revokedAt: string | null; reason?: string }>
  template: Record<string, unknown>
  documents: Record<string, {
    id: string
    name: string
    kind: string
    privileged: boolean
    createdBy: string
    versions: Array<Record<string, unknown>>
  }>
  reviews: Array<Record<string, unknown>>
  signatures: Array<Record<string, unknown>>
  filing: Record<string, unknown> | null
  exports: Array<Record<string, unknown>>
  legalHold: Record<string, unknown> | null
  retentionUntil: string
  disposedAt: string | null
  disposition?: Record<string, unknown>
  createdAt: string
  updatedAt: string
  audit?: FilingAuditEvent[]
}

export interface FilingRepository {
  canCreateMatterPackage(actor: FilingActor, matterId: string): Promise<boolean>
  userExists(userId: string): Promise<boolean>
  create(state: FilingState, actor: FilingActor, action: string, payload: Record<string, unknown>): Promise<FilingState>
  load(packageId: string): Promise<FilingState | null>
  mutate(
    packageId: string,
    expectedVersion: number,
    state: FilingState,
    actor: FilingActor,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<FilingState>
  auditEvents(packageId: string): Promise<FilingAuditEvent[]>
}

export class FilingWorkflowError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message)
  }
}

export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value)
    return encoded === undefined ? 'null' : encoded
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function now(): Date {
  return new Date()
}

export class MemoryFilingRepository implements FilingRepository {
  readonly states = new Map<string, FilingState>()
  readonly events = new Map<string, FilingAuditEvent[]>()

  async canCreateMatterPackage(actor: FilingActor): Promise<boolean> {
    return ['ATTORNEY', 'PARTNER', 'ADMIN'].includes(actor.role)
  }

  async userExists(): Promise<boolean> {
    return true
  }

  async create(state: FilingState, actor: FilingActor, action: string, payload: Record<string, unknown>) {
    if (this.states.has(state.id)) throw new FilingWorkflowError('DUPLICATE_PACKAGE', 'Filing package already exists', 409)
    this.states.set(state.id, clone(state))
    this.events.set(state.id, [])
    this.append(state, actor, action, payload)
    return clone(state)
  }

  async load(packageId: string) {
    const state = this.states.get(packageId)
    return state ? clone(state) : null
  }

  async mutate(
    packageId: string,
    expectedVersion: number,
    state: FilingState,
    actor: FilingActor,
    action: string,
    payload: Record<string, unknown>,
  ) {
    const current = this.states.get(packageId)
    if (!current) throw new FilingWorkflowError('PACKAGE_NOT_FOUND', 'Filing package not found', 404)
    if (current.version !== expectedVersion) throw new FilingWorkflowError('VERSION_CONFLICT', 'Package changed; reload before retrying', 409)
    const next = clone(state)
    next.version = expectedVersion + 1
    next.updatedAt = now().toISOString()
    this.states.set(packageId, next)
    this.append(next, actor, action, payload)
    return clone(next)
  }

  async auditEvents(packageId: string) {
    return clone(this.events.get(packageId) ?? [])
  }

  private append(state: FilingState, actor: FilingActor, action: string, payload: Record<string, unknown>) {
    const events = this.events.get(state.id)!
    const sequence = events.length + 1
    const previousHash = events.at(-1)?.eventHash ?? 'GENESIS'
    const body = { packageId: state.id, matterId: state.matterId, sequence, actorId: actor.userId, action, payload, previousHash }
    events.push({ ...body, eventHash: sha256(canonical(body)), createdAt: now().toISOString() })
  }
}

export class GovernedFilingWorkflow {
  static readonly LEGAL_ROLES = new Set(['ATTORNEY', 'PARTNER', 'ADMIN'])
  static readonly PERMISSIONS = new Set<MatterPermission>(['OWNER', 'EDITOR', 'LEGAL_REVIEWER', 'VIEWER'])

  constructor(
    private readonly repository: FilingRepository,
    private readonly providers: FilingProviders,
    private readonly retentionDays = 2555,
  ) {}

  async createPackage(actor: FilingActor, matterId: string, title: string, jurisdiction: string, filingDate: string) {
    this.actor(actor)
    matterId = this.text('matterId', matterId, 100)
    if (!(await this.repository.canCreateMatterPackage(actor, matterId))) {
      throw new FilingWorkflowError('MATTER_FORBIDDEN', 'Lead counsel or firm administrator access is required', 403)
    }
    title = this.text('title', title, 180)
    jurisdiction = this.text('jurisdiction', jurisdiction, 40).toUpperCase()
    const at = this.date('filingDate', filingDate)
    if (at.getTime() > now().getTime()) throw new FilingWorkflowError('FUTURE_FILING_DATE', 'Filing date cannot be in the future', 422)
    const template = await this.providers.templates.resolve(jurisdiction, at.toISOString())
    this.validateTemplate(template, jurisdiction, at)
    const createdAt = now().toISOString()
    const state: FilingState = {
      id: randomUUID(),
      matterId,
      title,
      jurisdiction,
      filingDate: at.toISOString(),
      status: 'DOCUMENTS_PENDING',
      createdBy: actor.userId,
      version: 1,
      members: { [actor.userId]: { permission: 'OWNER', revokedAt: null } },
      template,
      documents: {},
      reviews: [],
      signatures: [],
      filing: null,
      exports: [],
      legalHold: null,
      retentionUntil: new Date(at.getTime() + this.retentionDays * 86_400_000).toISOString(),
      disposedAt: null,
      createdAt,
      updatedAt: createdAt,
    }
    return this.repository.create(state, actor, 'FILING_PACKAGE_CREATED', {
      matterId,
      jurisdiction,
      templateHash: template.contentHash as string,
    })
  }

  async grantAccess(actor: FilingActor, packageId: string, userId: string, permission: MatterPermission) {
    const state = await this.authorized(actor, packageId, new Set(['OWNER']))
    if (!GovernedFilingWorkflow.PERMISSIONS.has(permission) || permission === 'OWNER') {
      throw new FilingWorkflowError('INVALID_PERMISSION', 'Permission is invalid')
    }
    userId = this.text('userId', userId, 100)
    if (!(await this.repository.userExists(userId))) throw new FilingWorkflowError('USER_NOT_FOUND', 'Active firm user not found', 404)
    state.members[userId] = { permission, revokedAt: null }
    return this.save(state, actor, 'MATTER_ACCESS_GRANTED', { userId, permission })
  }

  async revokeAccess(actor: FilingActor, packageId: string, userId: string, reason: string) {
    const state = await this.authorized(actor, packageId, new Set(['OWNER']))
    if (userId === actor.userId) throw new FilingWorkflowError('SELF_REVOCATION', 'The acting owner cannot revoke their own access', 409)
    const member = state.members[userId]
    if (!member || member.revokedAt) throw new FilingWorkflowError('ACCESS_NOT_FOUND', 'Active matter access was not found', 404)
    member.revokedAt = now().toISOString()
    member.reason = this.text('reason', reason, 500)
    return this.save(state, actor, 'MATTER_ACCESS_REVOKED', { userId, reason: member.reason })
  }

  async addDocument(actor: FilingActor, packageId: string, input: {
    name: string
    kind: string
    contentBase64: string
    sourceReference: string
    privileged?: boolean
    documentId?: string
  }) {
    const state = await this.authorized(actor, packageId, new Set(['OWNER', 'EDITOR']))
    if (input.privileged && !GovernedFilingWorkflow.LEGAL_ROLES.has(actor.role)) {
      throw new FilingWorkflowError('PRIVILEGED_RESTRICTED', 'Attorney, partner, or admin role is required', 403)
    }
    const content = this.base64(input.contentBase64)
    if (content.length === 0 || content.length > 5 * 1024 * 1024) {
      throw new FilingWorkflowError('INVALID_CONTENT', 'Document must be between 1 byte and 5 MB', 422)
    }
    const digest = sha256(content)
    const name = this.text('name', input.name, 180)
    const kind = this.text('kind', input.kind, 60).toUpperCase()
    const sourceReference = this.text('sourceReference', input.sourceReference, 500)
    const stored = await this.providers.storage.put({
      packageId,
      name,
      contentBase64: input.contentBase64,
      contentHash: digest,
      idempotencyKey: `document:${packageId}:${digest}`,
    })
    this.providerEvidence('storage', stored)
    const ocr = await this.providers.ocr.extract({
      storageReference: stored.reference,
      contentHash: digest,
      idempotencyKey: `ocr:${digest}`,
    })
    this.providerEvidence('ocr', ocr, true)
    const documentId = input.documentId ? this.text('documentId', input.documentId, 100) : randomUUID()
    let document = state.documents[documentId]
    if (input.documentId && !document) throw new FilingWorkflowError('DOCUMENT_NOT_FOUND', 'Document not found', 404)
    if (!document) {
      document = { id: documentId, name, kind, privileged: Boolean(input.privileged), createdBy: actor.userId, versions: [] }
      state.documents[documentId] = document
    }
    if (document.versions.some((version) => version.contentHash === digest)) {
      throw new FilingWorkflowError('DUPLICATE_VERSION', 'This document content already exists', 409)
    }
    const version = {
      number: document.versions.length + 1,
      contentHash: digest,
      storageProvider: stored.provider,
      storageReference: stored.reference,
      sourceReference,
      ocrProvider: ocr.provider,
      ocrReference: ocr.reference,
      extractedText: (ocr.text as string).slice(0, 200_000),
      createdBy: actor.userId,
      createdAt: now().toISOString(),
    }
    document.versions.push(version)
    if (!['DOCUMENTS_PENDING', 'REVIEW_REQUIRED'].includes(state.status)) {
      state.status = 'REVIEW_REQUIRED'
      state.reviews = []
    }
    return this.save(state, actor, 'DOCUMENT_VERSION_ADDED', {
      documentId,
      version: version.number,
      contentHash: digest,
      privileged: document.privileged,
      storageProvider: stored.provider as string,
      storageReference: stored.reference as string,
      sourceReference,
      ocrProvider: ocr.provider as string,
      ocrReference: ocr.reference as string,
    })
  }

  async createAuthoritativeForm(actor: FilingActor, packageId: string) {
    const state = await this.authorized(actor, packageId, new Set(['OWNER', 'EDITOR']))
    const template = state.template
    const body = String(template.body)
      .replaceAll('{{package_id}}', state.id)
      .replaceAll('{{matter_id}}', state.matterId)
      .replaceAll('{{jurisdiction}}', state.jurisdiction)
      .replaceAll('{{filing_date}}', state.filingDate.slice(0, 10))
    return this.addDocument(actor, packageId, {
      name: `Authoritative filing form ${String(template.version)}`,
      kind: 'COURT_FORM_DRAFT',
      contentBase64: Buffer.from(body).toString('base64'),
      sourceReference: String(template.sourceUri),
      privileged: GovernedFilingWorkflow.LEGAL_ROLES.has(actor.role),
    })
  }

  async submitReview(actor: FilingActor, packageId: string) {
    const state = await this.authorized(actor, packageId, new Set(['OWNER', 'EDITOR']))
    if (Object.keys(state.documents).length === 0) throw new FilingWorkflowError('DOCUMENT_REQUIRED', 'At least one document is required', 409)
    state.status = 'REVIEW_REQUIRED'
    return this.save(state, actor, 'LEGAL_REVIEW_REQUESTED', { manifestHash: this.manifest(state) })
  }

  async review(actor: FilingActor, packageId: string, input: {
    decision: string
    notes: string
    jurisdictionChecked: boolean
    effectiveDateChecked: boolean
  }) {
    const state = await this.authorized(actor, packageId, new Set(['OWNER', 'LEGAL_REVIEWER']))
    if (!GovernedFilingWorkflow.LEGAL_ROLES.has(actor.role)) throw new FilingWorkflowError('COUNSEL_REQUIRED', 'Legal review requires an attorney, partner, or admin', 403)
    if (actor.userId === state.createdBy) throw new FilingWorkflowError('INDEPENDENCE_REQUIRED', 'The package creator cannot approve it', 409)
    if (state.status !== 'REVIEW_REQUIRED') throw new FilingWorkflowError('INVALID_STATE', 'Package is not awaiting legal review', 409)
    if (!input.jurisdictionChecked || !input.effectiveDateChecked) {
      throw new FilingWorkflowError('VALIDATION_REQUIRED', 'Jurisdiction and effective-date checks are mandatory', 422)
    }
    const decision = input.decision.toUpperCase()
    if (!['APPROVE', 'REJECT'].includes(decision)) throw new FilingWorkflowError('INVALID_DECISION', 'Decision must be APPROVE or REJECT')
    this.validateTemplate(state.template, state.jurisdiction, this.date('filingDate', state.filingDate))
    const review = {
      id: randomUUID(),
      reviewerId: actor.userId,
      decision,
      notes: this.text('notes', input.notes, 2000),
      jurisdictionChecked: true,
      effectiveDateChecked: true,
      manifestHash: this.manifest(state),
      createdAt: now().toISOString(),
    }
    state.reviews.push(review)
    state.status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED'
    return this.save(state, actor, 'LEGAL_REVIEW_RECORDED', review)
  }

  async requestSignature(actor: FilingActor, packageId: string, signerEmail: string, idempotencyKey: string) {
    const state = await this.authorized(actor, packageId, new Set(['OWNER', 'EDITOR']))
    signerEmail = this.email(signerEmail)
    idempotencyKey = this.text('idempotencyKey', idempotencyKey, 120)
    if (state.signatures.some((item) => item.idempotencyKey === idempotencyKey && item.status !== 'FAILED')) return state
    if (!['APPROVED', 'SIGNER_FAILED'].includes(state.status)) throw new FilingWorkflowError('APPROVAL_REQUIRED', 'Independent legal approval is required', 409)
    let signature: Record<string, unknown>
    let action: string
    try {
      const result = await this.providers.signature.request({
        packageId,
        signerEmail,
        manifestHash: this.manifest(state),
        idempotencyKey,
      })
      this.providerEvidence('signature', result)
      signature = { id: randomUUID(), idempotencyKey, provider: result.provider, reference: result.reference, status: 'PENDING', failureCode: null }
      state.status = 'SIGNATURE_PENDING'
      action = 'SIGNATURE_REQUESTED'
    } catch (error) {
      signature = {
        id: randomUUID(), idempotencyKey, provider: 'unavailable', reference: null, status: 'FAILED',
        failureCode: error instanceof Error && 'code' in error ? String((error as Error & { code: unknown }).code) : 'PROVIDER_FAILURE',
      }
      state.status = 'SIGNER_FAILED'
      action = 'SIGNATURE_REQUEST_FAILED'
    }
    state.signatures.push(signature)
    return this.save(state, actor, action, signature)
  }

  async reconcileSignature(actor: FilingActor, packageId: string, providerReference: string) {
    const state = await this.authorized(actor, packageId, new Set(['OWNER', 'EDITOR']))
    if (!GovernedFilingWorkflow.LEGAL_ROLES.has(actor.role)) throw new FilingWorkflowError('COUNSEL_REQUIRED', 'Counsel reconciliation is required', 403)
    providerReference = this.text('providerReference', providerReference, 500)
    const signature = state.signatures.find((item) => item.reference === providerReference && item.status === 'PENDING')
    if (!signature) throw new FilingWorkflowError('SIGNATURE_NOT_FOUND', 'Pending signature not found', 404)
    const result = await this.providers.signature.status({
      packageId,
      providerReference,
      idempotencyKey: `signature-status:${packageId}:${providerReference}`,
    })
    this.providerEvidence('signature', result)
    if (result.reference !== providerReference || result.status !== 'SIGNED' || typeof result.signatureHash !== 'string' || !/^[a-f0-9]{64}$/i.test(result.signatureHash)) {
      throw new FilingWorkflowError('SIGNATURE_NOT_VERIFIED', 'Signature provider did not return verified signed evidence', 409)
    }
    const at = this.date('signedAt', String(result.signedAt ?? ''))
    if (at.getTime() > now().getTime()) throw new FilingWorkflowError('INVALID_SIGNED_AT', 'signedAt cannot be in the future', 422)
    signature.status = 'SIGNED'
    signature.signedAt = at.toISOString()
    signature.signatureHash = result.signatureHash
    state.status = 'SIGNED'
    return this.save(state, actor, 'SIGNATURE_RECONCILED', { reference: providerReference, signedAt: at.toISOString(), signatureHash: result.signatureHash })
  }

  async file(actor: FilingActor, packageId: string, idempotencyKey: string) {
    const state = await this.authorized(actor, packageId, new Set(['OWNER', 'EDITOR']))
    idempotencyKey = this.text('idempotencyKey', idempotencyKey, 120)
    if (state.filing) {
      if (state.filing.idempotencyKey === idempotencyKey) return state
      throw new FilingWorkflowError('ALREADY_FILED', 'Package was already filed', 409)
    }
    if (state.status !== 'SIGNED') throw new FilingWorkflowError('SIGNATURE_REQUIRED', 'Reconciled signature is required before filing', 409)
    const result = await this.providers.filing.submit({
      packageId,
      matterId: state.matterId,
      jurisdiction: state.jurisdiction,
      manifestHash: this.manifest(state),
      idempotencyKey,
    })
    this.providerEvidence('filing', result)
    if (typeof result.receiptHash !== 'string' || !/^[a-f0-9]{64}$/i.test(result.receiptHash)) {
      throw new FilingWorkflowError('FILING_RECEIPT_INVALID', 'Filing provider returned no verifiable receipt digest', 502)
    }
    state.filing = { provider: result.provider, reference: result.reference, receiptHash: result.receiptHash, idempotencyKey, filedAt: now().toISOString() }
    state.status = 'FILED'
    return this.save(state, actor, 'PACKAGE_FILED', state.filing)
  }

  async setLegalHold(actor: FilingActor, packageId: string, active: boolean, reason: string) {
    const state = await this.authorized(actor, packageId, new Set(['OWNER', 'LEGAL_REVIEWER']))
    if (!GovernedFilingWorkflow.LEGAL_ROLES.has(actor.role)) throw new FilingWorkflowError('COUNSEL_REQUIRED', 'Counsel must control legal holds', 403)
    state.legalHold = { active: Boolean(active), reason: this.text('reason', reason, 500), changedBy: actor.userId, changedAt: now().toISOString() }
    return this.save(state, actor, active ? 'LEGAL_HOLD_PLACED' : 'LEGAL_HOLD_RELEASED', state.legalHold)
  }

  async exportPackage(actor: FilingActor, packageId: string, includePrivileged: boolean, idempotencyKey: string) {
    const state = await this.authorized(actor, packageId, GovernedFilingWorkflow.PERMISSIONS)
    const member = state.members[actor.userId]
    const maySeePrivileged = GovernedFilingWorkflow.LEGAL_ROLES.has(actor.role) && ['OWNER', 'LEGAL_REVIEWER'].includes(member.permission)
    if (includePrivileged && !maySeePrivileged) throw new FilingWorkflowError('PRIVILEGED_EXPORT_FORBIDDEN', 'Privileged export requires counsel owner/reviewer access', 403)
    const documents = Object.values(state.documents)
      .filter((document) => includePrivileged || !document.privileged)
      .map((document) => {
        const latest = document.versions.at(-1)!
        return {
          id: document.id,
          name: document.name,
          kind: document.kind,
          privileged: document.privileged,
          version: latest.number,
          contentHash: latest.contentHash,
          storageReference: latest.storageReference,
        }
      })
    const reviews = includePrivileged && maySeePrivileged ? state.reviews : state.reviews.map((review) => this.publicReview(review))
    const packageBody = canonical({
      package: { id: state.id, matterId: state.matterId, title: state.title, jurisdiction: state.jurisdiction, status: state.status, version: state.version },
      documents,
      reviews,
      filing: state.filing,
    })
    const digest = sha256(packageBody)
    const result = await this.providers.storage.put({
      packageId,
      name: 'governed-filing-export.json',
      contentBase64: Buffer.from(packageBody).toString('base64'),
      contentHash: digest,
      idempotencyKey: this.text('idempotencyKey', idempotencyKey, 120),
    })
    this.providerEvidence('storage', result)
    const exported = { id: randomUUID(), privileged: includePrivileged, manifestHash: digest, provider: result.provider, reference: result.reference, createdAt: now().toISOString() }
    state.exports.push(exported)
    return this.save(state, actor, 'PACKAGE_EXPORTED', exported)
  }

  async enforceRetention(actor: FilingActor, packageId: string, asOf: string, reason: string) {
    const state = await this.authorized(actor, packageId, new Set(['OWNER', 'LEGAL_REVIEWER']))
    if (!GovernedFilingWorkflow.LEGAL_ROLES.has(actor.role)) throw new FilingWorkflowError('COUNSEL_REQUIRED', 'Counsel must execute retention', 403)
    const at = this.date('asOf', asOf)
    if (at.getTime() > now().getTime()) throw new FilingWorkflowError('INVALID_AS_OF', 'Retention asOf cannot be in the future', 422)
    if (state.legalHold?.active) throw new FilingWorkflowError('LEGAL_HOLD_ACTIVE', 'Legal hold blocks retention', 409)
    if (at.getTime() < this.date('retentionUntil', state.retentionUntil).getTime()) throw new FilingWorkflowError('RETENTION_NOT_DUE', 'Retention period has not elapsed', 409)
    if (!['FILED', 'REJECTED', 'CLOSED'].includes(state.status)) throw new FilingWorkflowError('INVALID_STATE', 'Only terminal packages may be disposed', 409)
    const references = Object.values(state.documents).flatMap((document) => document.versions.map((version) => version.storageReference as string))
    const result = await this.providers.storage.dispose({
      packageId,
      references,
      reason: this.text('reason', reason, 500),
      idempotencyKey: `retention:${packageId}:${state.version}`,
    })
    this.providerEvidence('disposition', result)
    state.disposedAt = at.toISOString()
    state.status = 'CLOSED'
    state.disposition = { provider: result.provider, reference: result.reference, objectCount: references.length }
    return this.save(state, actor, 'RETENTION_DISPOSITION_COMPLETED', state.disposition)
  }

  async view(actor: FilingActor, packageId: string) {
    const state = await this.authorized(actor, packageId, GovernedFilingWorkflow.PERMISSIONS)
    const member = state.members[actor.userId]
    const maySeePrivileged = GovernedFilingWorkflow.LEGAL_ROLES.has(actor.role) && ['OWNER', 'LEGAL_REVIEWER'].includes(member.permission)
    if (!maySeePrivileged) {
      state.documents = Object.fromEntries(Object.entries(state.documents).filter(([, document]) => !document.privileged))
      state.reviews = state.reviews.map((review) => this.publicReview(review))
    }
    const audit = await this.repository.auditEvents(packageId)
    if (!maySeePrivileged) {
      for (const event of audit) {
        const privilegedDocument = event.action === 'DOCUMENT_VERSION_ADDED' && event.payload.privileged === true
        if (privilegedDocument || ['LEGAL_REVIEW_RECORDED', 'LEGAL_HOLD_PLACED', 'LEGAL_HOLD_RELEASED'].includes(event.action)) {
          event.payload = { redacted: true }
          event.payloadRedacted = true
        }
      }
    }
    state.audit = audit
    return state
  }

  private async authorized(actor: FilingActor, packageId: string, permissions: Set<MatterPermission>) {
    this.actor(actor)
    packageId = this.text('packageId', packageId, 100)
    const state = await this.repository.load(packageId)
    if (!state) throw new FilingWorkflowError('PACKAGE_NOT_FOUND', 'Filing package not found', 404)
    const member = state.members[actor.userId]
    if (!member || member.revokedAt || !permissions.has(member.permission)) {
      throw new FilingWorkflowError('PACKAGE_NOT_FOUND', 'Filing package not found', 404)
    }
    return state
  }

  private save(state: FilingState, actor: FilingActor, action: string, payload: Record<string, unknown>) {
    return this.repository.mutate(state.id, state.version, state, actor, action, payload)
  }

  private manifest(state: FilingState) {
    const documents = Object.keys(state.documents).sort().map((documentId) => {
      const version = state.documents[documentId].versions.at(-1)!
      return { documentId, version: version.number, contentHash: version.contentHash }
    })
    if (documents.length === 0) throw new FilingWorkflowError('DOCUMENT_REQUIRED', 'At least one document is required', 409)
    return sha256(canonical(documents))
  }

  private publicReview(review: Record<string, unknown>) {
    const { id, decision, jurisdictionChecked, effectiveDateChecked, manifestHash, createdAt } = review
    return { id, decision, jurisdictionChecked, effectiveDateChecked, manifestHash, createdAt }
  }

  private validateTemplate(template: Record<string, unknown>, jurisdiction: string, asOf: Date) {
    const required = ['authority', 'sourceUri', 'jurisdiction', 'version', 'effectiveFrom', 'contentHash', 'body']
    if (!required.every((field) => typeof template[field] === 'string' && String(template[field]).length > 0)) {
      throw new FilingWorkflowError('TEMPLATE_INVALID', 'Authoritative template response is incomplete', 502)
    }
    if (String(template.jurisdiction).toUpperCase() !== jurisdiction || !String(template.sourceUri).startsWith('https://')) {
      throw new FilingWorkflowError('TEMPLATE_OUT_OF_SCOPE', 'Template source or jurisdiction is invalid', 422)
    }
    if (sha256(String(template.body)) !== template.contentHash) throw new FilingWorkflowError('TEMPLATE_HASH_MISMATCH', 'Template digest does not match its body', 422)
    const from = this.date('effectiveFrom', String(template.effectiveFrom))
    const to = template.effectiveTo ? this.date('effectiveTo', String(template.effectiveTo)) : null
    if (asOf.getTime() < from.getTime() || (to && asOf.getTime() >= to.getTime())) {
      throw new FilingWorkflowError('TEMPLATE_NOT_EFFECTIVE', 'Template was not effective on the filing date', 422)
    }
  }

  private providerEvidence(name: string, result: Record<string, unknown>, requireText = false) {
    if (!result || typeof result.provider !== 'string' || typeof result.reference !== 'string') {
      throw new FilingWorkflowError('PROVIDER_EVIDENCE_INVALID', `${name} provider returned no provenance`, 502)
    }
    if (requireText && typeof result.text !== 'string') throw new FilingWorkflowError('PROVIDER_EVIDENCE_INVALID', `${name} provider returned no extracted text`, 502)
  }

  private actor(actor: FilingActor) {
    if (!actor.userId || !['ADMIN', 'PARTNER', 'ATTORNEY', 'PARALEGAL', 'SECRETARY', 'BILLING'].includes(actor.role)) {
      throw new FilingWorkflowError('INVALID_ACTOR', 'A valid firm identity is required', 401)
    }
  }

  private text(name: string, value: unknown, maximum: number): string {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
      throw new FilingWorkflowError('INVALID_INPUT', `${name} is required and must be at most ${maximum} characters`, 422)
    }
    return value.trim()
  }

  private date(name: string, value: string) {
    const parsed = new Date(value)
    if (!value || Number.isNaN(parsed.getTime())) throw new FilingWorkflowError('INVALID_DATE', `${name} is invalid`, 422)
    return parsed
  }

  private email(value: string) {
    const email = this.text('signerEmail', value, 254).toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new FilingWorkflowError('INVALID_INPUT', 'signerEmail must be valid', 422)
    return email
  }

  private base64(value: string) {
    if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
      throw new FilingWorkflowError('INVALID_CONTENT', 'Document content must be canonical base64', 422)
    }
    return Buffer.from(value, 'base64')
  }
}
