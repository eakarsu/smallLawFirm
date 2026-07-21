import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'Payment processing is unavailable until a verified processor integration is installed.' }, { status: 501 })
}
