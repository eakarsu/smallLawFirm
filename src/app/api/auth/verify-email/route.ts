import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { authEmailConfiguration, sendAuthEmail } from '@/lib/auth-email'
import crypto from 'crypto'

const digest = (token: string) => crypto.createHash('sha256').update(token).digest('hex')

// POST /api/auth/verify-email - Send verification email
export async function POST(_request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    authEmailConfiguration()
    const fullUser = await prisma.user.findUnique({ where: { id: user.id } })
    if (!fullUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (fullUser.emailVerified) {
      return NextResponse.json({ message: 'Email is already verified' })
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken: digest(verificationToken) }
    })

    try {
      await sendAuthEmail('email-verification', user.email, verificationToken)
    } catch (error) {
      await prisma.user.update({ where: { id: user.id }, data: { emailVerificationToken: null } })
      throw error
    }

    return NextResponse.json({
      message: 'Verification email sent. Please check your inbox.'
    })
  } catch (error) {
    console.error('Send verification error:', error)
    return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 })
  }
}

// PUT /api/auth/verify-email - Confirm email verification
export async function PUT(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ error: 'Verification token is required' }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: { emailVerificationToken: digest(String(token)) }
    })

    if (!user) {
      return NextResponse.json({ error: 'Invalid verification token' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null
      }
    })

    return NextResponse.json({ message: 'Email verified successfully' })
  } catch (error) {
    console.error('Verify email error:', error)
    return NextResponse.json({ error: 'Failed to verify email' }, { status: 500 })
  }
}
