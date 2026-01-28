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
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Upload,
  Send,
  Gavel,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'

interface CourtFiling {
  id: string
  documentName: string
  documentType: string
  filingType: string
  courtName: string
  caseNumber: string | null
  filingDate: string | null
  dueDate: string | null
  status: string
  filingFee: string | null
  feePaid: boolean
  serviceRequired: boolean
  serviceStatus: string | null
  matter: {
    id: string
    name: string
    matterNumber: string
  }
}

interface Matter {
  id: string
  name: string
  matterNumber: string
  courtName: string | null
  caseNumber: string | null
}

const statusColors: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  DRAFT: 'secondary',
  READY: 'warning',
  SUBMITTED: 'info' as any,
  ACCEPTED: 'success',
  REJECTED: 'destructive',
  FILED: 'success'
}

const filingTypes = [
  { value: 'INITIAL', label: 'Initial Filing' },
  { value: 'RESPONSE', label: 'Response' },
  { value: 'MOTION', label: 'Motion' },
  { value: 'BRIEF', label: 'Brief' },
  { value: 'EXHIBIT', label: 'Exhibit' },
  { value: 'ORDER', label: 'Order' },
  { value: 'NOTICE', label: 'Notice' },
  { value: 'OTHER', label: 'Other' }
]

export default function FilingsPage() {
  const [filings, setFilings] = useState<CourtFiling[]>([])
  const [matters, setMatters] = useState<Matter[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedFiling, setSelectedFiling] = useState<CourtFiling | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [formData, setFormData] = useState({
    matterId: '',
    documentName: '',
    documentType: 'PLEADING',
    filingType: 'MOTION',
    courtName: '',
    caseNumber: '',
    dueDate: '',
    filingFee: '',
    serviceRequired: false
  })

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadingFilingId, setUploadingFilingId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchFilings()
    fetchMatters()
  }, [search, statusFilter])

  const fetchFilings = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/filings?${params}`)
      if (res.ok) {
        const data = await res.json()
        setFilings(data.filings)
      }
    } catch (error) {
      console.error('Failed to fetch filings:', error)
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

  const handleMatterSelect = (matterId: string) => {
    const matter = matters.find(m => m.id === matterId)
    setFormData({
      ...formData,
      matterId,
      courtName: matter?.courtName || '',
      caseNumber: matter?.caseNumber || ''
    })
  }

  const handleCreateFiling = async () => {
    try {
      const res = await fetch('/api/filings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        setDialogOpen(false)
        setFormData({
          matterId: '',
          documentName: '',
          documentType: 'PLEADING',
          filingType: 'MOTION',
          courtName: '',
          caseNumber: '',
          dueDate: '',
          filingFee: '',
          serviceRequired: false
        })
        fetchFilings()
      }
    } catch (error) {
      console.error('Failed to create filing:', error)
    }
  }

  const handleRowClick = (filing: CourtFiling) => {
    setSelectedFiling(filing)
    setDetailDialogOpen(true)
  }

  const handleOpenUploadDialog = (filingId: string) => {
    setUploadingFilingId(filingId)
    setSelectedFile(null)
    setUploadDialogOpen(true)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleUploadDocument = async () => {
    if (!selectedFile || !uploadingFilingId) return

    setUploading(true)
    try {
      // Get the filing to find the matter
      const filing = filings.find(f => f.id === uploadingFilingId)

      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('name', selectedFile.name.replace(/\.[^/.]+$/, ''))
      formData.append('description', `Document for court filing: ${filing?.documentName || ''}`)
      formData.append('category', 'COURT_ORDER')
      if (filing?.matter?.id) {
        formData.append('matterId', filing.matter.id)
      }

      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        setUploadDialogOpen(false)
        setSelectedFile(null)
        setUploadingFilingId(null)
        // Update the filing status to READY if it was DRAFT
        if (filing?.status === 'DRAFT') {
          await fetch(`/api/filings/${uploadingFilingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'READY' })
          })
        }
        fetchFilings()
      }
    } catch (error) {
      console.error('Failed to upload document:', error)
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'FILED':
      case 'ACCEPTED':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'SUBMITTED':
      case 'READY':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'REJECTED':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <FileText className="w-4 h-4 text-gray-400" />
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Court Filings</h1>
          <p className="text-gray-500">Manage court filings and e-filing</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Filing
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New Court Filing</DialogTitle>
              <DialogDescription>Create a new court filing record</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Matter *</Label>
                <Select value={formData.matterId} onValueChange={handleMatterSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a matter" />
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
              <div className="space-y-2">
                <Label htmlFor="documentName">Document Name *</Label>
                <Input
                  id="documentName"
                  value={formData.documentName}
                  onChange={(e) => setFormData({ ...formData, documentName: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Filing Type</Label>
                  <Select
                    value={formData.filingType}
                    onValueChange={(v) => setFormData({ ...formData, filingType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {filingTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="courtName">Court Name</Label>
                  <Input
                    id="courtName"
                    value={formData.courtName}
                    onChange={(e) => setFormData({ ...formData, courtName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="caseNumber">Case Number</Label>
                  <Input
                    id="caseNumber"
                    value={formData.caseNumber}
                    onChange={(e) => setFormData({ ...formData, caseNumber: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filingFee">Filing Fee ($)</Label>
                <Input
                  id="filingFee"
                  type="number"
                  step="0.01"
                  value={formData.filingFee}
                  onChange={(e) => setFormData({ ...formData, filingFee: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateFiling} disabled={!formData.matterId || !formData.documentName}>
                Create Filing
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
                placeholder="Search filings..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="READY">Ready</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="FILED">Filed</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filings.length === 0 ? (
            <div className="text-center py-12">
              <Gavel className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">No court filings found</p>
              <Button onClick={() => setDialogOpen(true)}>Create Your First Filing</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Matter</TableHead>
                  <TableHead>Court</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filings.map((filing) => (
                  <TableRow
                    key={filing.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleRowClick(filing)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(filing.status)}
                        <span className="font-medium">{filing.documentName}</span>
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Link href={`/matters/${filing.matter.id}`} className="text-blue-600 hover:underline">
                        {filing.matter.matterNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{filing.courtName}</p>
                        {filing.caseNumber && (
                          <p className="text-xs text-gray-500">#{filing.caseNumber}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{filing.filingType}</TableCell>
                    <TableCell>
                      {filing.dueDate ? formatDate(filing.dueDate) : '-'}
                    </TableCell>
                    <TableCell>
                      {filing.filingFee ? (
                        <div>
                          <span>{formatCurrency(filing.filingFee)}</span>
                          {filing.feePaid ? (
                            <Badge variant="success" className="ml-2">Paid</Badge>
                          ) : (
                            <Badge variant="warning" className="ml-2">Due</Badge>
                          )}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[filing.status] || 'default'}>
                        {filing.status}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleRowClick(filing)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenUploadDialog(filing.id)}>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Document
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={async () => {
                            if (confirm(`Submit ${filing.documentName} to ${filing.courtName}?`)) {
                              try {
                                const res = await fetch(`/api/filings/${filing.id}/submit`, {
                                  method: 'POST'
                                })
                                if (res.ok) {
                                  fetchFilings()
                                }
                              } catch (error) {
                                console.error('Submit error:', error)
                              }
                            }
                          }}>
                            <Send className="mr-2 h-4 w-4" />
                            Submit E-Filing
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Filing Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="w-5 h-5" />
              {selectedFiling?.documentName}
            </DialogTitle>
            <DialogDescription>
              Court Filing Details
            </DialogDescription>
          </DialogHeader>
          {selectedFiling && (
            <div className="space-y-6">
              {/* Matter & Court Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Matter & Court</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Matter</p>
                    <p className="text-sm font-medium font-mono">{selectedFiling.matter.matterNumber}</p>
                    <p className="text-xs text-gray-600">{selectedFiling.matter.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Court</p>
                    <p className="text-sm font-medium">{selectedFiling.courtName}</p>
                    {selectedFiling.caseNumber && (
                      <p className="text-xs text-gray-600">Case #{selectedFiling.caseNumber}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Filing Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Filing Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Document Type</p>
                    <p className="text-sm font-medium">{selectedFiling.documentType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Filing Type</p>
                    <p className="text-sm font-medium">{selectedFiling.filingType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <Badge variant={statusColors[selectedFiling.status] || 'default'}>
                      {selectedFiling.status}
                    </Badge>
                  </div>
                  {selectedFiling.dueDate && (
                    <div>
                      <p className="text-sm text-gray-500">Due Date</p>
                      <p className="text-sm font-medium">{formatDate(selectedFiling.dueDate)}</p>
                    </div>
                  )}
                  {selectedFiling.filingDate && (
                    <div>
                      <p className="text-sm text-gray-500">Filed Date</p>
                      <p className="text-sm font-medium">{formatDate(selectedFiling.filingDate)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Fee & Service Info */}
              {(selectedFiling.filingFee || selectedFiling.serviceRequired) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Fee & Service</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedFiling.filingFee && (
                      <div>
                        <p className="text-sm text-gray-500">Filing Fee</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{formatCurrency(selectedFiling.filingFee)}</p>
                          {selectedFiling.feePaid ? (
                            <Badge variant="success">Paid</Badge>
                          ) : (
                            <Badge variant="warning">Due</Badge>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedFiling.serviceRequired && (
                      <div>
                        <p className="text-sm text-gray-500">Service Status</p>
                        <Badge>{selectedFiling.serviceStatus || 'Pending'}</Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => {
                  setDetailDialogOpen(false)
                  handleOpenUploadDialog(selectedFiling.id)
                }}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
                <Button onClick={async () => {
                  if (confirm(`Submit this filing to ${selectedFiling.courtName}?`)) {
                    try {
                      const res = await fetch(`/api/filings/${selectedFiling.id}/submit`, {
                        method: 'POST'
                      })
                      if (res.ok) {
                        setDetailDialogOpen(false)
                        fetchFilings()
                      }
                    } catch (error) {
                      console.error('Submit error:', error)
                    }
                  }
                }}>
                  <Send className="w-4 h-4 mr-2" />
                  Submit E-Filing
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a document for this court filing
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select File</Label>
              <Input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.txt,.rtf"
              />
              {selectedFile && (
                <p className="text-sm text-gray-500">
                  Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setUploadDialogOpen(false)
              setSelectedFile(null)
            }}>
              Cancel
            </Button>
            <Button onClick={handleUploadDocument} disabled={!selectedFile || uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
