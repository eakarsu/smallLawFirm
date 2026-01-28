import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { generateClientNumber } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const type = searchParams.get('type') || ''

    const where: any = {}

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { clientNumber: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (status) {
      where.status = status
    }

    if (type) {
      where.type = type
    }

    const clients = await prisma.client.findMany({
      where,
      include: {
        _count: {
          select: { matters: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ clients })
  } catch (error) {
    console.error('Clients GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      type,
      firstName,
      lastName,
      middleName,
      companyName,
      email,
      phone,
      mobile,
      fax,
      address,
      city,
      state,
      zipCode,
      country,
      billingRate,
      billingMethod,
      portalEnabled
    } = body

    const client = await prisma.client.create({
      data: {
        clientNumber: generateClientNumber(),
        type: type || 'INDIVIDUAL',
        firstName,
        lastName,
        middleName,
        companyName,
        email,
        phone,
        mobile,
        fax,
        address,
        city,
        state,
        zipCode,
        country,
        billingRate: billingRate ? parseFloat(billingRate) : null,
        billingMethod: billingMethod || 'HOURLY',
        portalEnabled: portalEnabled || false,
        createdById: user.id
      }
    })

    return NextResponse.json({ client }, { status: 201 })
  } catch (error) {
    console.error('Client POST error:', error)
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
  }
}
