import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'Service-of-process tracking is unavailable until a persisted provider integration is installed.' }, { status: 501 })
}

export async function POST() {
  return NextResponse.json({ error: 'Service-of-process tracking is unavailable until a persisted provider integration is installed.' }, { status: 501 })
}
