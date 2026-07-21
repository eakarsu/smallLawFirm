import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import {
  canonical,
  FilingWorkflowError,
  sha256,
  type FilingActor,
  type FilingAuditEvent,
  type FilingRepository,
  type FilingState,
} from './governed-filing-workflow'

type Transaction = Prisma.TransactionClient

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

function stateFromRow(row: {
  state: Prisma.JsonValue
  version: number
  status: string
  retentionUntil: Date
  disposedAt: Date | null
}): FilingState {
  const state = structuredClone(row.state) as unknown as FilingState
  state.version = row.version
  state.status = row.status
  state.retentionUntil = row.retentionUntil.toISOString()
  state.disposedAt = row.disposedAt?.toISOString() ?? null
  return state
}

export class PrismaFilingRepository implements FilingRepository {
  async canCreateMatterPackage(actor: FilingActor, matterId: string) {
    const matter = await prisma.matter.findUnique({ where: { id: matterId }, select: { leadAttorneyId: true } })
    return Boolean(matter && (matter.leadAttorneyId === actor.userId || ['ADMIN', 'PARTNER'].includes(actor.role)))
  }

  async userExists(userId: string) {
    return (await prisma.user.count({ where: { id: userId, isActive: true } })) === 1
  }

  async create(state: FilingState, actor: FilingActor, action: string, payload: Record<string, unknown>) {
    return prisma.$transaction(async (transaction) => {
      const matter = await transaction.matter.findUnique({ where: { id: state.matterId }, select: { id: true } })
      if (!matter) throw new FilingWorkflowError('MATTER_NOT_FOUND', 'Matter not found', 404)
      await transaction.governedFilingPackage.create({
        data: {
          id: state.id,
          matterId: state.matterId,
          createdById: actor.userId,
          title: state.title,
          jurisdiction: state.jurisdiction,
          status: state.status,
          version: state.version,
          state: json(state),
          retentionUntil: new Date(state.retentionUntil),
          disposedAt: null,
        },
      })
      await this.append(transaction, state, actor, action, payload)
      return state
    })
  }

  async load(packageId: string) {
    const row = await prisma.governedFilingPackage.findUnique({ where: { id: packageId } })
    return row ? stateFromRow(row) : null
  }

  async mutate(
    packageId: string,
    expectedVersion: number,
    state: FilingState,
    actor: FilingActor,
    action: string,
    payload: Record<string, unknown>,
  ) {
    return prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${packageId}))`
      const current = await transaction.governedFilingPackage.findUnique({ where: { id: packageId } })
      if (!current) throw new FilingWorkflowError('PACKAGE_NOT_FOUND', 'Filing package not found', 404)
      if (current.version !== expectedVersion) {
        throw new FilingWorkflowError('VERSION_CONFLICT', 'Package changed; reload before retrying', 409)
      }
      const next: FilingState = structuredClone(state)
      next.version = expectedVersion + 1
      next.updatedAt = new Date().toISOString()
      const updated = await transaction.governedFilingPackage.updateMany({
        where: { id: packageId, version: expectedVersion },
        data: {
          title: next.title,
          jurisdiction: next.jurisdiction,
          status: next.status,
          version: next.version,
          state: json(next),
          retentionUntil: new Date(next.retentionUntil),
          disposedAt: next.disposedAt ? new Date(next.disposedAt) : null,
        },
      })
      if (updated.count !== 1) throw new FilingWorkflowError('VERSION_CONFLICT', 'Package changed; reload before retrying', 409)
      if (action === 'DOCUMENT_VERSION_ADDED') {
        await transaction.governedDocumentVersion.create({
          data: {
            id: randomUUID(),
            packageId,
            documentId: String(payload.documentId),
            version: Number(payload.version),
            contentHash: String(payload.contentHash),
            storageProvider: String(payload.storageProvider),
            storageReference: String(payload.storageReference),
            sourceReference: String(payload.sourceReference),
            ocrProvider: String(payload.ocrProvider),
            ocrReference: String(payload.ocrReference),
            privileged: Boolean(payload.privileged),
          },
        })
      }
      await this.append(transaction, next, actor, action, payload)
      return next
    })
  }

  async auditEvents(packageId: string): Promise<FilingAuditEvent[]> {
    const rows = await prisma.governedFilingAuditEvent.findMany({ where: { packageId }, orderBy: { sequence: 'asc' } })
    return rows.map((row) => ({
      packageId: row.packageId,
      matterId: row.matterId,
      sequence: row.sequence,
      actorId: row.actorId,
      action: row.action,
      payload: row.payload as Record<string, unknown>,
      previousHash: row.previousHash,
      eventHash: row.eventHash,
      createdAt: row.createdAt.toISOString(),
    }))
  }

  private async append(
    transaction: Transaction,
    state: FilingState,
    actor: FilingActor,
    action: string,
    payload: Record<string, unknown>,
  ) {
    const previous = await transaction.governedFilingAuditEvent.findFirst({
      where: { packageId: state.id },
      orderBy: { sequence: 'desc' },
    })
    const sequence = (previous?.sequence ?? 0) + 1
    const previousHash = previous?.eventHash ?? 'GENESIS'
    const body = { packageId: state.id, matterId: state.matterId, sequence, actorId: actor.userId, action, payload, previousHash }
    await transaction.governedFilingAuditEvent.create({
      data: {
        id: randomUUID(),
        packageId: state.id,
        matterId: state.matterId,
        sequence,
        actorId: actor.userId,
        action,
        payload: json(payload),
        previousHash,
        eventHash: sha256(canonical(body)),
      },
    })
  }
}
