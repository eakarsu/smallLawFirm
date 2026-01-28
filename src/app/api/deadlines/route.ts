import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const matterId = searchParams.get('matterId') || ''
    const status = searchParams.get('status') || ''
    const upcoming = searchParams.get('upcoming') || ''

    const where: any = {}

    if (matterId) where.matterId = matterId
    if (status && status !== 'all') where.status = status
    if (upcoming === 'true') {
      where.dueDate = { gte: new Date() }
      where.status = 'PENDING'
    }

    const deadlines = await prisma.deadline.findMany({
      where,
      include: {
        matter: {
          select: {
            id: true,
            name: true,
            matterNumber: true,
            client: {
              select: { id: true, firstName: true, lastName: true, companyName: true }
            }
          }
        }
      },
      orderBy: { dueDate: 'asc' }
    })

    return NextResponse.json({ deadlines })
  } catch (error) {
    console.error('Deadlines GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch deadlines' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const deadline = await prisma.deadline.create({
      data: {
        matterId: body.matterId,
        title: body.title,
        description: body.description,
        deadlineType: body.deadlineType || 'FILING',
        dueDate: new Date(body.dueDate),
        status: body.status || 'PENDING',
        reminderDays: body.reminderDays || 7,
        courtRuleId: body.courtRuleId || null
      }
    })

    return NextResponse.json({ deadline }, { status: 201 })
  } catch (error) {
    console.error('Deadline POST error:', error)
    return NextResponse.json({ error: 'Failed to create deadline' }, { status: 500 })
  }
}
