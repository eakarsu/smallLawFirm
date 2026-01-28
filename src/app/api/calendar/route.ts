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
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    const where: any = {}

    if (start && end) {
      where.startTime = {
        gte: new Date(start),
        lte: new Date(end)
      }
    }

    const events = await prisma.calendarEvent.findMany({
      where,
      include: {
        matter: { select: { id: true, name: true, matterNumber: true } },
        user: { select: { id: true, name: true } }
      },
      orderBy: { startTime: 'asc' }
    })

    // Also get deadlines
    const deadlines = await prisma.deadline.findMany({
      where: {
        status: 'PENDING',
        dueDate: start && end ? {
          gte: new Date(start),
          lte: new Date(end)
        } : undefined
      },
      include: {
        matter: { select: { id: true, name: true, matterNumber: true } }
      },
      orderBy: { dueDate: 'asc' }
    })

    return NextResponse.json({ events, deadlines })
  } catch (error) {
    console.error('Calendar GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch calendar events' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const event = await prisma.calendarEvent.create({
      data: {
        title: body.title,
        description: body.description,
        matterId: body.matterId || null,
        userId: user.id,
        eventType: body.eventType || 'MEETING',
        location: body.location,
        startTime: new Date(body.startTime),
        endTime: new Date(body.endTime),
        allDay: body.allDay || false,
        reminderMinutes: body.reminderMinutes
      }
    })

    return NextResponse.json({ event }, { status: 201 })
  } catch (error) {
    console.error('Calendar POST error:', error)
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}
