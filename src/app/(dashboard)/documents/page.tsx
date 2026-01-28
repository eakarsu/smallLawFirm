"use client"

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Upload,
  Search,
  MoreHorizontal,
  Download,
  Eye,
  Trash2,
  FileText,
  File,
  FileImage
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Document {
  id: string
  name: string
  description: string | null
  fileName: string
  fileType: string
  fileSize: number
  category: string
  status: string
  createdAt: string
  matter: { id: string; name: string; matterNumber: string } | null
  client: { id: string; firstName: string | null; lastName: string | null; companyName: string | null } | null
  uploadedBy: { id: string; name: string }
}

interface Matter {
  id: string
  name: string
  matterNumber: string
}

const categories = [
  { value: '', label: 'All Categories' },
  { value: 'PLEADING', label: 'Pleading' },
  { value: 'MOTION', label: 'Motion' },
  { value: 'BRIEF', label: 'Brief' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'CORRESPONDENCE', label: 'Correspondence' },
  { value: 'DISCOVERY', label: 'Discovery' },
  { value: 'EVIDENCE', label: 'Evidence' },
  { value: 'COURT_ORDER', label: 'Court Order' },
  { value: 'TRANSCRIPT', label: 'Transcript' },
  { value: 'TEMPLATE', label: 'Template' },
  { value: 'CLIENT_FILE', label: 'Client File' },
  { value: 'BILLING', label: 'Billing' },
  { value: 'OTHER', label: 'Other' }
]

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [matters, setMatters] = useState<Matter[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploadForm, setUploadForm] = useState({
    name: '',
    description: '',
    category: 'OTHER',
    matterId: ''
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  useEffect(() => {
    fetchDocuments()
    fetchMatters()
  }, [search, categoryFilter])

  const fetchDocuments = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (categoryFilter) params.set('category', categoryFilter)

      const res = await fetch(`/api/documents?${params}`)
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents)
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMatters = async () => {
    try {
      const res = await fetch('/api/matters?status=OPEN')
      if (res.ok) {
        const data = await res.json()
        setMatters(data.matters)
      }
    } catch (error) {
      console.error('Failed to fetch matters:', error)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      if (!uploadForm.name) {
        setUploadForm({ ...uploadForm, name: file.name.replace(/\.[^/.]+$/, '') })
      }
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('name', uploadForm.name || selectedFile.name)
      formData.append('description', uploadForm.description)
      formData.append('category', uploadForm.category)
      if (uploadForm.matterId) formData.append('matterId', uploadForm.matterId)

      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        setUploadDialogOpen(false)
        setSelectedFile(null)
        setUploadForm({ name: '', description: '', category: 'OTHER', matterId: '' })
        fetchDocuments()
      }
    } catch (error) {
      console.error('Failed to upload document:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setDocuments(documents.filter(d => d.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete document:', error)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return FileImage
    if (fileType.includes('pdf')) return FileText
    return File
  }

  const handleRowClick = (doc: Document) => {
    setSelectedDocument(doc)
    setDetailDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-500">Manage your legal documents</p>
        </div>
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>Upload a new document to your library</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>File</Label>
                <Input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.txt,.rtf,.xls,.xlsx,.jpg,.jpeg,.png"
                />
                {selectedFile && (
                  <p className="text-sm text-gray-500">
                    Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="docName">Document Name</Label>
                <Input
                  id="docName"
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="docDescription">Description</Label>
                <Textarea
                  id="docDescription"
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={uploadForm.category}
                  onValueChange={(v) => setUploadForm({ ...uploadForm, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.value).map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Associated Matter</Label>
                <Select
                  value={uploadForm.matterId}
                  onValueChange={(v) => setUploadForm({ ...uploadForm, matterId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a matter (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {matters.map((matter) => (
                      <SelectItem key={matter.id} value={matter.id}>
                        {matter.matterNumber} - {matter.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search documents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value || "all"}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">No documents found</p>
              <Button onClick={() => setUploadDialogOpen(true)}>
                Upload Your First Document
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Matter</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const FileIcon = getFileIcon(doc.fileType)
                  return (
                    <TableRow
                      key={doc.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleRowClick(doc)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <FileIcon className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-medium">{doc.name}</p>
                            <p className="text-sm text-gray-500">{doc.fileName}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{doc.category.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {doc.matter ? (
                          <Link href={`/matters/${doc.matter.id}`} className="text-blue-600 hover:underline">
                            {doc.matter.matterNumber}
                          </Link>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{formatFileSize(doc.fileSize)}</TableCell>
                      <TableCell>{doc.uploadedBy.name}</TableCell>
                      <TableCell>{formatDate(doc.createdAt)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/documents/${doc.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={async () => {
                              try {
                                const res = await fetch(`/api/documents/${doc.id}/download`)
                                if (res.ok) {
                                  // Get filename from Content-Disposition header
                                  const contentDisposition = res.headers.get('Content-Disposition')
                                  let filename = doc.fileName
                                  if (contentDisposition) {
                                    const match = contentDisposition.match(/filename="(.+)"/)
                                    if (match) {
                                      filename = match[1]
                                    }
                                  }
                                  const blob = await res.blob()
                                  const url = window.URL.createObjectURL(blob)
                                  const a = document.createElement('a')
                                  a.href = url
                                  a.download = filename
                                  document.body.appendChild(a)
                                  a.click()
                                  window.URL.revokeObjectURL(url)
                                  document.body.removeChild(a)
                                }
                              } catch (error) {
                                console.error('Download error:', error)
                              }
                            }}>
                              <Download className="mr-2 h-4 w-4" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDelete(doc.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Document Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedDocument && <FileText className="w-5 h-5" />}
              {selectedDocument?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedDocument?.fileName}
            </DialogDescription>
          </DialogHeader>
          {selectedDocument && (
            <div className="space-y-6">
              {/* Document Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Document Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Category</p>
                    <Badge variant="secondary">{selectedDocument.category.replace('_', ' ')}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <Badge>{selectedDocument.status}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">File Size</p>
                    <p className="text-sm font-medium">{formatFileSize(selectedDocument.fileSize)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Uploaded</p>
                    <p className="text-sm font-medium">{formatDate(selectedDocument.createdAt)}</p>
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Details</h3>
                <div className="space-y-3">
                  {selectedDocument.description && (
                    <div>
                      <p className="text-xs text-gray-500">Description</p>
                      <p className="text-sm">{selectedDocument.description}</p>
                    </div>
                  )}
                  {selectedDocument.matter && (
                    <div>
                      <p className="text-xs text-gray-500">Associated Matter</p>
                      <Link
                        href={`/matters/${selectedDocument.matter.id}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {selectedDocument.matter.matterNumber} - {selectedDocument.matter.name}
                      </Link>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">Uploaded By</p>
                    <p className="text-sm font-medium">{selectedDocument.uploadedBy.name}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={async () => {
                  try {
                    const res = await fetch(`/api/documents/${selectedDocument.id}/download`)
                    if (res.ok) {
                      // Get filename from Content-Disposition header
                      const contentDisposition = res.headers.get('Content-Disposition')
                      let filename = selectedDocument.fileName
                      if (contentDisposition) {
                        const match = contentDisposition.match(/filename="(.+)"/)
                        if (match) {
                          filename = match[1]
                        }
                      }
                      const blob = await res.blob()
                      const url = window.URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = filename
                      document.body.appendChild(a)
                      a.click()
                      window.URL.revokeObjectURL(url)
                      document.body.removeChild(a)
                      setDetailDialogOpen(false)
                    }
                  } catch (error) {
                    console.error('Download error:', error)
                  }
                }}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button variant="destructive" onClick={async () => {
                  if (confirm('Are you sure you want to delete this document?')) {
                    await handleDelete(selectedDocument.id)
                    setDetailDialogOpen(false)
                  }
                }}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
