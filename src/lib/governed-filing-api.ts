import { NextResponse } from 'next/server'
import { getCurrentUser } from './auth'
import { createFilingProviders } from './governed-filing-providers'
import { PrismaFilingRepository } from './governed-filing-repository'
import { FilingWorkflowError, GovernedFilingWorkflow, type FilingActor } from './governed-filing-workflow'

export async function filingActor(): Promise<FilingActor | null> {
  const user = await getCurrentUser()
  return user ? { userId: user.id, role: user.role } : null
}

export function filingWorkflow(): GovernedFilingWorkflow {
  const retentionDays = Number(process.env.FILING_RETENTION_DAYS ?? '2555')
  if (!Number.isSafeInteger(retentionDays) || retentionDays < 1 || retentionDays > 36_500) {
    throw new FilingWorkflowError('CONFIGURATION_ERROR', 'FILING_RETENTION_DAYS must be an integer from 1 to 36500', 503)
  }
  return new GovernedFilingWorkflow(new PrismaFilingRepository(), createFilingProviders(), retentionDays)
}

export function filingError(error: unknown): NextResponse {
  if (error instanceof FilingWorkflowError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }
  const code = error instanceof Error && 'code' in error ? String((error as Error & { code: unknown }).code) : ''
  if (code === 'PROVIDER_CONFIGURATION') {
    return NextResponse.json({ error: 'Required filing provider is not configured', code }, { status: 503 })
  }
  if (code === 'P2002') return NextResponse.json({ error: 'Conflicting filing version', code: 'VERSION_CONFLICT' }, { status: 409 })
  console.error('Governed filing operation failed', error)
  return NextResponse.json({ error: 'Governed filing operation failed' }, { status: 500 })
}
