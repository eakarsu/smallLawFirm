import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { generateInvoiceNumber } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || ''
    const clientId = searchParams.get('clientId') || ''
    const search = searchParams.get('search') || ''

    const where: any = {}
    if (status && status !== 'all') where.status = status
    if (clientId) where.clientId = clientId
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { client: { companyName: { contains: search, mode: 'insensitive' } } },
        { client: { firstName: { contains: search, mode: 'insensitive' } } },
        { client: { lastName: { contains: search, mode: 'insensitive' } } },
        { matter: { name: { contains: search, mode: 'insensitive' } } },
        { matter: { matterNumber: { contains: search, mode: 'insensitive' } } }
      ]
    }

    const invoices = await prisma.invoice.findMany({
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
        matter: {
          select: { id: true, name: true, matterNumber: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calculate stats
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const outstanding = invoices
      .filter(i => ['SENT', 'PARTIAL', 'OVERDUE'].includes(i.status))
      .reduce((sum, i) => sum + (Number(i.total) - Number(i.paidAmount)), 0)

    const paidThisMonth = invoices
      .filter(i => i.paidDate && new Date(i.paidDate) >= startOfMonth)
      .reduce((sum, i) => sum + Number(i.paidAmount), 0)

    const overdue = invoices
      .filter(i => i.status === 'OVERDUE')
      .reduce((sum, i) => sum + (Number(i.total) - Number(i.paidAmount)), 0)

    return NextResponse.json({
      invoices,
      stats: {
        totalOutstanding: outstanding,
        totalPaid: paidThisMonth,
        overdueAmount: overdue,
        invoiceCount: invoices.filter(i => !['PAID', 'CANCELLED'].includes(i.status)).length
      }
    })
  } catch (error) {
    console.error('Billing GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: generateInvoiceNumber(),
        clientId: body.clientId,
        matterId: body.matterId,
        issueDate: new Date(body.issueDate),
        dueDate: new Date(body.dueDate),
        subtotal: parseFloat(body.subtotal),
        taxRate: body.taxRate ? parseFloat(body.taxRate) : null,
        taxAmount: body.taxAmount ? parseFloat(body.taxAmount) : null,
        total: parseFloat(body.total),
        notes: body.notes,
        status: 'DRAFT'
      }
    })

    return NextResponse.json({ invoice }, { status: 201 })
  } catch (error) {
    console.error('Billing POST error:', error)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}
