import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { readFile, access } from 'fs/promises'
import { isAbsolute, resolve, sep } from 'path'
import { constants } from 'fs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        fileName: true,
        fileType: true,
        filePath: true,
        name: true
      }
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (!document.filePath) {
      return NextResponse.json({ error: 'File path not found' }, { status: 404 })
    }

    // Handle both formats: /uploads/file.pdf and uploads/file.pdf
    const relativePath = document.filePath.startsWith('/')
      ? document.filePath.slice(1)
      : document.filePath
    if (!process.env.DOCUMENT_STORAGE_ROOT || !isAbsolute(process.env.DOCUMENT_STORAGE_ROOT)) {
      return NextResponse.json({ error: 'DOCUMENT_STORAGE_ROOT must be configured as an absolute path' }, { status: 503 })
    }
    const storageRoot = resolve(process.env.DOCUMENT_STORAGE_ROOT)
    const storageRelativePath = relativePath.startsWith('uploads/') ? relativePath.slice('uploads/'.length) : relativePath
    const fullPath = resolve(storageRoot, storageRelativePath)
    if (fullPath !== storageRoot && !fullPath.startsWith(`${storageRoot}${sep}`)) {
      return NextResponse.json({ error: 'Document storage path is invalid' }, { status: 400 })
    }

    // Check if file exists
    try {
      await access(fullPath, constants.R_OK)
    } catch {
      return NextResponse.json({ error: 'Document binary is unavailable; no substitute content was generated.' }, { status: 410 })
    }

    // Read file from disk
    const fileBuffer = await readFile(fullPath)

    // Sanitize filename for HTTP header (remove/replace non-ASCII characters)
    const safeFileName = document.fileName
      .replace(/[^\x00-\x7F]/g, '_')  // Replace non-ASCII with underscore
      .replace(/[<>:"/\\|?*]/g, '_')   // Replace invalid filename chars

    // Return file as response
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': document.fileType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeFileName}"`,
      },
    })
  } catch (error) {
    console.error('Document download error:', error)
    return NextResponse.json({ error: 'Failed to download document' }, { status: 500 })
  }
}
