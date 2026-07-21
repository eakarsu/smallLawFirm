import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({
    error: 'Unverified filing submission has been retired. Use the governed filing package workflow.',
    replacement: '/api/governed-filings/{id}/actions',
  }, { status: 410 })
}
