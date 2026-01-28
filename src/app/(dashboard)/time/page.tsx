"use client"

import { useEffect, useState } from 'react'
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
import { Plus, Clock, DollarSign, Timer } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'

interface TimeEntry {
  id: string
  date: string
  hours: string
  description: string
  billableStatus: string
  rate: string
  amount: string
  matter: { id: string; name: string; matterNumber: string }
  user: { id: string; name: string }
}

interface Matter {
  id: string
  name: string
  matterNumber: string
}

interface Totals {
  hours: number
  amount: number
  billableHours: number
  billableAmount: number
}

const billableStatuses = [
  { value: 'BILLABLE', label: 'Billable' },
  { value: 'NON_BILLABLE', label: 'Non-Billable' },
  { value: 'NO_CHARGE', label: 'No Charge' }
]

export default function TimeTrackingPage() {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [matters, setMatters] = useState<Matter[]>([])
  const [totals, setTotals] = useState<Totals>({ hours: 0, amount: 0, billableHours: 0, billableAmount: 0 })
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)

  const [formData, setFormData] = useState({
    matterId: '',
    date: new Date().toISOString().split('T')[0],
    hours: '',
    description: '',
    billableStatus: 'BILLABLE',
    rate: ''
  })

  useEffect(() => {
    fetchTimeEntries()
    fetchMatters()
  }, [])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [timerRunning])

  const fetchTimeEntries = async () => {
    try {
      const res = await fetch('/api/time')
      if (res.ok) {
        const data = await res.json()
        setTimeEntries(data.timeEntries)
        setTotals(data.totals)
      }
    } catch (error) {
      console.error('Failed to fetch time entries:', error)
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

  const handleCreateEntry = async () => {
    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        setDialogOpen(false)
        setFormData({
          matterId: '',
          date: new Date().toISOString().split('T')[0],
          hours: '',
          description: '',
          billableStatus: 'BILLABLE',
          rate: ''
        })
        fetchTimeEntries()
      }
    } catch (error) {
      console.error('Failed to create time entry:', error)
    }
  }

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const stopTimer = () => {
    setTimerRunning(false)
    const hours = (timerSeconds / 3600).toFixed(2)
    setFormData({ ...formData, hours })
    setTimerSeconds(0)
    setDialogOpen(true)
  }

  const handleRowClick = (entry: TimeEntry) => {
    setSelectedEntry(entry)
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
          <h1 className="text-2xl font-bold text-gray-900">Time Tracking</h1>
          <p className="text-gray-500">Track and manage billable hours</p>
        </div>
        <div className="flex gap-3">
          {timerRunning ? (
            <Button variant="destructive" onClick={stopTimer}>
              <Timer className="w-4 h-4 mr-2" />
              {formatTimer(timerSeconds)} - Stop
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setTimerRunning(true)}>
              <Timer className="w-4 h-4 mr-2" />
              Start Timer
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Time Entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Time Entry</DialogTitle>
                <DialogDescription>Record your billable time</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Matter *</Label>
                  <Select
                    value={formData.matterId}
                    onValueChange={(v) => setFormData({ ...formData, matterId: v })}
                  >
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hours">Hours *</Label>
                    <Input
                      id="hours"
                      type="number"
                      step="0.1"
                      value={formData.hours}
                      onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="Describe the work performed..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Billable Status</Label>
                    <Select
                      value={formData.billableStatus}
                      onValueChange={(v) => setFormData({ ...formData, billableStatus: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {billableStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rate">Rate ($/hr)</Label>
                    <Input
                      id="rate"
                      type="number"
                      step="0.01"
                      value={formData.rate}
                      onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                      placeholder="Use default if empty"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleCreateEntry}
                  disabled={!formData.matterId || !formData.hours || !formData.description}
                >
                  Save Entry
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Hours</p>
                <p className="text-2xl font-bold">{totals.hours.toFixed(1)}</p>
              </div>
              <Clock className="w-10 h-10 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Billable Hours</p>
                <p className="text-2xl font-bold">{totals.billableHours.toFixed(1)}</p>
              </div>
              <Timer className="w-10 h-10 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Value</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.amount)}</p>
              </div>
              <DollarSign className="w-10 h-10 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Billable Value</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.billableAmount)}</p>
              </div>
              <DollarSign className="w-10 h-10 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {timeEntries.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">No time entries yet</p>
              <Button onClick={() => setDialogOpen(true)}>Add Your First Entry</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Matter</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeEntries.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleRowClick(entry)}
                  >
                    <TableCell>{formatDate(entry.date)}</TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{entry.matter.matterNumber}</span>
                      <br />
                      <span className="text-sm text-gray-500">{entry.matter.name}</span>
                    </TableCell>
                    <TableCell className="max-w-md truncate">{entry.description}</TableCell>
                    <TableCell>{Number(entry.hours).toFixed(1)}</TableCell>
                    <TableCell>{formatCurrency(entry.rate)}</TableCell>
                    <TableCell>{formatCurrency(entry.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={entry.billableStatus === 'BILLABLE' ? 'success' : 'secondary'}>
                        {entry.billableStatus.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Time Entry Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Time Entry Details
            </DialogTitle>
            <DialogDescription>
              {selectedEntry && formatDate(selectedEntry.date)}
            </DialogDescription>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-6">
              {/* Entry Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Entry Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Matter</p>
                    <p className="text-sm font-medium font-mono">{selectedEntry.matter.matterNumber}</p>
                    <p className="text-sm text-gray-600">{selectedEntry.matter.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Attorney</p>
                    <p className="text-sm font-medium">{selectedEntry.user.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Hours</p>
                    <p className="text-sm font-medium">{Number(selectedEntry.hours).toFixed(1)} hrs</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Billable Status</p>
                    <Badge variant={selectedEntry.billableStatus === 'BILLABLE' ? 'success' : 'secondary'}>
                      {selectedEntry.billableStatus.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Financial Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Financial Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Rate</p>
                    <p className="text-sm font-medium">{formatCurrency(selectedEntry.rate)}/hr</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Amount</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(selectedEntry.amount)}</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">{selectedEntry.description}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
