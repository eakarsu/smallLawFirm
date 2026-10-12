import { prisma } from '@/lib/prisma'
import type { AdvisoryRepository, SavedAdvisory } from './native-advisory-runtime'
type Row = { id: string; prompt: string; content: string; model: string; providerRequestId: string; createdAt: Date }
const saved = (row: Row): SavedAdvisory => ({ id: row.id, prompt: row.prompt, content: row.content, model: row.model, createdAt: row.createdAt.toISOString(), canDelete: false, providerReceipt: { id: row.providerRequestId, created: null, upstreamModel: row.model } })
export const advisoryRepository: AdvisoryRepository = {
  async list(actor) { return (await prisma.aiProviderReceipt.findMany({ where: { userId: actor.id, provider: 'openrouter' }, orderBy: { createdAt: 'desc' }, take: 50 })).map(saved) },
  async save(actor, input, signal) { return prisma.$transaction(async tx => { signal.throwIfAborted(); const row = await tx.aiProviderReceipt.create({ data: { userId: actor.id, provider: 'openrouter', providerRequestId: input.providerReceipt.id, model: input.model, prompt: input.prompt, content: input.content } }); signal.throwIfAborted(); return { ...saved(row), providerReceipt: input.providerReceipt } }) },
}
