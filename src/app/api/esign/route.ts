import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({
    error: 'Legacy dry-run e-signing has been retired. Use the governed filing package signature action.',
    replacement: '/api/governed-filings/{id}/actions',
  }, { status: 410 })
}
