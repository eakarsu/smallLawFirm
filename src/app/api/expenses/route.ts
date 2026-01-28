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
    const category = searchParams.get('category') || ''
    const billableStatus = searchParams.get('billableStatus') || ''

    const where: any = {}

    if (matterId) where.matterId = matterId
    if (category && category !== 'all') where.category = category
    if (billableStatus && billableStatus !== 'all') where.billableStatus = billableStatus

    const expenses = await prisma.expense.findMany({
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
      orderBy: { date: 'desc' }
    })

    return NextResponse.json({ expenses })
  } catch (error) {
    console.error('Expenses GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const expense = await prisma.expense.create({
      data: {
        matterId: body.matterId,
        date: body.date ? new Date(body.date) : new Date(),
        description: body.description,
        amount: parseFloat(body.amount),
        category: body.category || 'OTHER',
        vendor: body.vendor,
        receiptPath: body.receiptPath,
        billableStatus: body.billableStatus || 'BILLABLE'
      }
    })

    return NextResponse.json({ expense }, { status: 201 })
  } catch (error) {
    console.error('Expense POST error:', error)
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 })
  }
}
