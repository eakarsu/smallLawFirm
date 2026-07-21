import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'Mail archiving is unavailable until a verified archive integration is installed.' }, { status: 501 })
}
