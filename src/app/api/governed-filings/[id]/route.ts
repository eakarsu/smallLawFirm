import { NextRequest, NextResponse } from 'next/server'
import { filingActor, filingError, filingWorkflow } from '@/lib/governed-filing-api'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await filingActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    return NextResponse.json({ filingPackage: await filingWorkflow().view(actor, id) })
  } catch (error) {
    return filingError(error)
  }
}
