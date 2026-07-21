import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'Client self-service is unavailable until portal-scoped identities and persistence are implemented.' }, { status: 501 })
}

export async function POST() {
  return NextResponse.json({ error: 'Client self-service is unavailable until portal-scoped identities and persistence are implemented.' }, { status: 501 })
}
