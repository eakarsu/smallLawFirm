import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { filingActor, filingError, filingWorkflow } from '@/lib/governed-filing-api'
import { prisma } from '@/lib/prisma'

const createSchema = z.object({
  matterId: z.string().min(1).max(100),
  title: z.string().min(1).max(180),
  jurisdiction: z.string().min(1).max(40),
  filingDate: z.iso.datetime(),
}).strict()

export async function GET() {
  try {
    const actor = await filingActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const packages = await prisma.$queryRaw<Array<{
      id: string; matterId: string; title: string; jurisdiction: string; status: string; version: number; updatedAt: Date
    }>>`
      SELECT "id", "matterId", "title", "jurisdiction", "status", "version", "updatedAt"
      FROM "governed_filing_packages"
      WHERE ("state"->'members') ? ${actor.userId}
        AND ("state"->'members'->${actor.userId}->>'revokedAt') IS NULL
      ORDER BY "updatedAt" DESC
      LIMIT 100
    `
    return NextResponse.json({ filingPackages: packages })
  } catch (error) {
    return filingError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await filingActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const parsed = createSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: 'Invalid filing package', issues: parsed.error.issues }, { status: 422 })
    const state = await filingWorkflow().createPackage(actor, parsed.data.matterId, parsed.data.title, parsed.data.jurisdiction, parsed.data.filingDate)
    return NextResponse.json({ filingPackage: state }, { status: 201 })
  } catch (error) {
    return filingError(error)
  }
}
