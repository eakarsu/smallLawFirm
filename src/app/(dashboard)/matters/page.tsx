"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Search, MoreHorizontal, Eye, Edit, Trash2, Briefcase, FileText, User2, Calendar } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Matter {
  id: string
  matterNumber: string
  name: string
  caseType: string
  status: string
  priority: string
  openDate: string
  client: {
    id: string
    firstName: string | null
    lastName: string | null
    companyName: string | null
    type: string
  }
  leadAttorney: {
    id: string
    name: string
  }
  _count: {
    documents: number
    timeEntries: number
    tasks: number
  }
}

const statusColors: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  OPEN: 'success',
  PENDING: 'warning',
  ON_HOLD: 'secondary',
  CLOSED: 'default',
  ARCHIVED: 'destructive'
}

const priorityColors: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  LOW: 'secondary',
  MEDIUM: 'default',
  HIGH: 'warning',
  URGENT: 'destructive'
}

const caseTypes = [
  { value: '', label: 'All Case Types' },
  { value: 'CIVIL_LITIGATION', label: 'Civil Litigation' },
  { value: 'CRIMINAL_DEFENSE', label: 'Criminal Defense' },
  { value: 'FAMILY_LAW', label: 'Family Law' },
  { value: 'REAL_ESTATE', label: 'Real Estate' },
  { value: 'CORPORATE', label: 'Corporate' },
  { value: 'INTELLECTUAL_PROPERTY', label: 'Intellectual Property' },
  { value: 'BANKRUPTCY', label: 'Bankruptcy' },
  { value: 'EMPLOYMENT', label: 'Employment' },
  { value: 'IMMIGRATION', label: 'Immigration' },
  { value: 'PERSONAL_INJURY', label: 'Personal Injury' },
  { value: 'ESTATE_PLANNING', label: 'Estate Planning' },
  { value: 'TAX', label: 'Tax' },
  { value: 'ENVIRONMENTAL', label: 'Environmental' },
  { value: 'OTHER', label: 'Other' }
]

const matterStatuses = [
  { value: '', label: 'All Statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'ARCHIVED', label: 'Archived' }
]

export default function MattersPage() {
  const [matters, setMatters] = useState<Matter[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [caseTypeFilter, setCaseTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)

  useEffect(() => {
    fetchMatters()
  }, [search, caseTypeFilter, statusFilter])

  const fetchMatters = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (caseTypeFilter) params.set('caseType', caseTypeFilter)
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/matters?${params}`)
      if (res.ok) {
        const data = await res.json()
        setMatters(data.matters)
      }
    } catch (error) {
      console.error('Failed to fetch matters:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this matter?')) return

    try {
      const res = await fetch(`/api/matters/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setMatters(matters.filter(m => m.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete matter:', error)
    }
  }

  const getClientName = (client: Matter['client']) => {
    if (client.type === 'COMPANY' || client.type === 'GOVERNMENT' || client.type === 'NON_PROFIT') {
      return client.companyName || 'N/A'
    }
    return `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'N/A'
  }

  const handleRowClick = (matter: Matter) => {
    setSelectedMatter(matter)
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
          <h1 className="text-2xl font-bold text-gray-900">Matters</h1>
          <p className="text-gray-500">Manage your legal matters and cases</p>
        </div>
        <Button asChild>
          <Link href="/matters/new">
            <Plus className="w-4 h-4 mr-2" />
            New Matter
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search matters..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={caseTypeFilter} onValueChange={setCaseTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Case Types" />
              </SelectTrigger>
              <SelectContent>
                {caseTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value || "all"}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                {matterStatuses.map((status) => (
                  <SelectItem key={status.value} value={status.value || "all"}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {matters.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No matters found</p>
              <Button asChild>
                <Link href="/matters/new">Create Your First Matter</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matter #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Case Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Attorney</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matters.map((matter) => (
                  <TableRow
                    key={matter.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleRowClick(matter)}
                  >
                    <TableCell className="font-mono text-sm">{matter.matterNumber}</TableCell>
                    <TableCell className="font-medium">{matter.name}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Link href={`/clients/${matter.client.id}`} className="text-blue-600 hover:underline">
                        {getClientName(matter.client)}
                      </Link>
                    </TableCell>
                    <TableCell>{matter.caseType.replace(/_/g, ' ')}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[matter.status] || 'default'}>
                        {matter.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityColors[matter.priority] || 'default'}>
                        {matter.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>{matter.leadAttorney.name}</TableCell>
                    <TableCell>{formatDate(matter.openDate)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/matters/${matter.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/matters/${matter.id}/edit`}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDelete(matter.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
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

      {/* Matter Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              {selectedMatter?.name}
            </DialogTitle>
            <DialogDescription>
              Matter #{selectedMatter?.matterNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedMatter && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Matter Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Case Type</p>
                    <p className="text-sm font-medium">{selectedMatter.caseType.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <Badge variant={statusColors[selectedMatter.status] || 'default'}>
                      {selectedMatter.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Priority</p>
                    <Badge variant={priorityColors[selectedMatter.priority] || 'default'}>
                      {selectedMatter.priority}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Opened</p>
                    <p className="text-sm font-medium">{formatDate(selectedMatter.openDate)}</p>
                  </div>
                </div>
              </div>

              {/* People & Stats */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Details</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <User2 className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Client</p>
                      <p className="text-sm font-medium">{getClientName(selectedMatter.client)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <User2 className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Lead Attorney</p>
                      <p className="text-sm font-medium">{selectedMatter.leadAttorney.name}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <div>
                      <p className="text-xs text-gray-500">Documents</p>
                      <p className="text-sm font-medium">{selectedMatter._count.documents}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Time Entries</p>
                      <p className="text-sm font-medium">{selectedMatter._count.timeEntries}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Tasks</p>
                      <p className="text-sm font-medium">{selectedMatter._count.tasks}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button asChild>
                  <Link href={`/matters/${selectedMatter.id}/edit`}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Matter
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
