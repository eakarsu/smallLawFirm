import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { filingActor, filingError, filingWorkflow } from '@/lib/governed-filing-api'

const schemas = {
  grant_access: z.object({ action: z.literal('grant_access'), userId: z.string(), permission: z.enum(['EDITOR', 'LEGAL_REVIEWER', 'VIEWER']) }).strict(),
  revoke_access: z.object({ action: z.literal('revoke_access'), userId: z.string(), reason: z.string() }).strict(),
  add_document: z.object({
    action: z.literal('add_document'),
    name: z.string(),
    kind: z.string(),
    contentBase64: z.string(),
    sourceReference: z.string(),
    privileged: z.boolean().optional(),
    documentId: z.string().optional(),
  }).strict(),
  create_authoritative_form: z.object({ action: z.literal('create_authoritative_form') }).strict(),
  submit_review: z.object({ action: z.literal('submit_review') }).strict(),
  review: z.object({
    action: z.literal('review'),
    decision: z.enum(['APPROVE', 'REJECT']),
    notes: z.string(),
    jurisdictionChecked: z.boolean(),
    effectiveDateChecked: z.boolean(),
  }).strict(),
  request_signature: z.object({ action: z.literal('request_signature'), signerEmail: z.email(), idempotencyKey: z.string() }).strict(),
  reconcile_signature: z.object({ action: z.literal('reconcile_signature'), providerReference: z.string() }).strict(),
  file: z.object({ action: z.literal('file'), idempotencyKey: z.string() }).strict(),
  set_legal_hold: z.object({ action: z.literal('set_legal_hold'), active: z.boolean(), reason: z.string() }).strict(),
  export: z.object({ action: z.literal('export'), includePrivileged: z.boolean(), idempotencyKey: z.string() }).strict(),
  enforce_retention: z.object({ action: z.literal('enforce_retention'), asOf: z.iso.datetime(), reason: z.string() }).strict(),
} as const

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await filingActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object' || !('action' in body) || typeof body.action !== 'string' || !(body.action in schemas)) {
      return NextResponse.json({ error: 'Unknown filing action' }, { status: 422 })
    }
    const action = body.action as keyof typeof schemas
    const parsed = schemas[action].safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid filing action', issues: parsed.error.issues }, { status: 422 })
    const input = parsed.data as Record<string, unknown> & { action: keyof typeof schemas }
    const { id } = await params
    const workflow = filingWorkflow()
    let state
    switch (input.action) {
      case 'grant_access': state = await workflow.grantAccess(actor, id, String(input.userId), input.permission as 'EDITOR' | 'LEGAL_REVIEWER' | 'VIEWER'); break
      case 'revoke_access': state = await workflow.revokeAccess(actor, id, String(input.userId), String(input.reason)); break
      case 'add_document': state = await workflow.addDocument(actor, id, {
        name: String(input.name), kind: String(input.kind), contentBase64: String(input.contentBase64), sourceReference: String(input.sourceReference),
        privileged: Boolean(input.privileged), documentId: input.documentId ? String(input.documentId) : undefined,
      }); break
      case 'create_authoritative_form': state = await workflow.createAuthoritativeForm(actor, id); break
      case 'submit_review': state = await workflow.submitReview(actor, id); break
      case 'review': state = await workflow.review(actor, id, {
        decision: String(input.decision), notes: String(input.notes), jurisdictionChecked: Boolean(input.jurisdictionChecked), effectiveDateChecked: Boolean(input.effectiveDateChecked),
      }); break
      case 'request_signature': state = await workflow.requestSignature(actor, id, String(input.signerEmail), String(input.idempotencyKey)); break
      case 'reconcile_signature': state = await workflow.reconcileSignature(actor, id, String(input.providerReference)); break
      case 'file': state = await workflow.file(actor, id, String(input.idempotencyKey)); break
      case 'set_legal_hold': state = await workflow.setLegalHold(actor, id, Boolean(input.active), String(input.reason)); break
      case 'export': state = await workflow.exportPackage(actor, id, Boolean(input.includePrivileged), String(input.idempotencyKey)); break
      case 'enforce_retention': state = await workflow.enforceRetention(actor, id, String(input.asOf), String(input.reason)); break
    }
    return NextResponse.json({ filingPackage: state })
  } catch (error) {
    return filingError(error)
  }
}
