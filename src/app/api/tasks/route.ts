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
    const status = searchParams.get('status') || ''
    const priority = searchParams.get('priority') || ''
    const matterId = searchParams.get('matterId') || ''

    const where: any = {}

    if (status && status !== 'all') where.status = status
    if (priority && priority !== 'all') where.priority = priority
    if (matterId) where.matterId = matterId

    const tasks = await prisma.task.findMany({
      where,
      include: {
        matter: { select: { id: true, name: true, matterNumber: true } },
        createdBy: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } }
      },
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { dueDate: 'asc' }
      ]
    })

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('Tasks GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const task = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description,
        matterId: body.matterId || null,
        createdById: user.id,
        assigneeId: body.assigneeId || null,
        priority: body.priority || 'MEDIUM',
        status: body.status || 'TODO',
        dueDate: body.dueDate ? new Date(body.dueDate) : null
      }
    })

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    console.error('Task POST error:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
