import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'Invoice delivery is unavailable until a verified delivery provider is installed.' }, { status: 501 })
}
