import { getCurrentUser } from '@/lib/auth'
import { createAdvisoryHandlers } from '@/lib/native-advisory-runtime'
import { advisoryRepository } from '@/lib/native-advisory-repository'
const handlers = createAdvisoryHandlers({
  async authenticate() { const user = await getCurrentUser(); return user ? { id: user.id, role: user.role } : null },
  repository: advisoryRepository, maxPrompt: 4000, maxTokens: 180, timeoutMs: 45000, requireReceipt: true, exactBaseUrl: 'https://openrouter.ai/api/v1',
  systemPrompt: 'Give concise law-firm operations guidance. Do not provide legal advice and require attorney review for legal decisions.',
  reply: item => ({ content: item.content, model: item.model, providerReceipt: { requestId: item.providerReceipt?.id, provider: item.providerReceipt?.upstreamProvider || 'openrouter', upstreamModel: item.model, created: item.providerReceipt?.created || 0 }, interactionId: item.id, feature: 'law-firm-operations-recommendation' }),
})
export const POST = handlers.POST
export const GET = handlers.GET
