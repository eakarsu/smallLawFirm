import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'Portal tokens are unavailable until persisted, revocable client identities are implemented.' }, { status: 501 })
}

export async function GET() {
  return NextResponse.json({ valid: false, error: 'Portal tokens are not enabled.' }, { status: 501 })
}
