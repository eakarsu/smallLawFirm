import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { generateMatterNumber } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const caseType = searchParams.get('caseType') || ''
    const clientId = searchParams.get('clientId') || ''

    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { matterNumber: { contains: search, mode: 'insensitive' } },
        { caseNumber: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (status) where.status = status
    if (caseType) where.caseType = caseType
    if (clientId) where.clientId = clientId

    const matters = await prisma.matter.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
            type: true
          }
        },
        leadAttorney: {
          select: { id: true, name: true }
        },
        _count: {
          select: {
            documents: true,
            timeEntries: true,
            tasks: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ matters })
  } catch (error) {
    console.error('Matters GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch matters' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const matter = await prisma.matter.create({
      data: {
        matterNumber: generateMatterNumber(),
        name: body.name,
        description: body.description,
        clientId: body.clientId,
        leadAttorneyId: body.leadAttorneyId || user.id,
        caseType: body.caseType,
        status: body.status || 'OPEN',
        priority: body.priority || 'MEDIUM',
        courtName: body.courtName,
        caseNumber: body.caseNumber,
        judge: body.judge,
        courtroom: body.courtroom,
        statuteOfLimitations: body.statuteOfLimitations ? new Date(body.statuteOfLimitations) : null,
        billingMethod: body.billingMethod || 'HOURLY',
        flatFeeAmount: body.flatFeeAmount ? parseFloat(body.flatFeeAmount) : null,
        contingencyPercent: body.contingencyPercent ? parseFloat(body.contingencyPercent) : null,
        estimatedValue: body.estimatedValue ? parseFloat(body.estimatedValue) : null
      },
      include: {
        client: true,
        leadAttorney: true
      }
    })

    return NextResponse.json({ matter }, { status: 201 })
  } catch (error) {
    console.error('Matter POST error:', error)
    return NextResponse.json({ error: 'Failed to create matter' }, { status: 500 })
  }
}
