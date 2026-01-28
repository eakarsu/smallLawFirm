"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus,
  Search,
  Mail,
  MessageSquare,
  Phone,
  Send,
  Inbox,
  Send as SendIcon
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

interface Message {
  id: string
  type: string
  subject: string | null
  content: string
  isRead: boolean
  createdAt: string
  sender: { id: string; name: string } | null
  client: { id: string; firstName: string | null; lastName: string | null; companyName: string | null } | null
}

interface Client {
  id: string
  firstName: string | null
  lastName: string | null
  companyName: string | null
  type: string
  email: string | null
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [replyText, setReplyText] = useState('')

  const [formData, setFormData] = useState({
    clientId: '',
    type: 'EMAIL',
    subject: '',
    content: ''
  })

  useEffect(() => {
    fetchMessages()
    fetchClients()
  }, [])

  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/messages')
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages)
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients?status=ACTIVE')
      if (res.ok) {
        const data = await res.json()
        setClients(data.clients)
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error)
    }
  }

  const handleSendMessage = async () => {
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        setDialogOpen(false)
        setFormData({ clientId: '', type: 'EMAIL', subject: '', content: '' })
        fetchMessages()
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleSendReply = async () => {
    if (!selectedMessage || !replyText.trim()) return

    try {
      const res = await fetch(`/api/messages/${selectedMessage.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: replyText
        })
      })

      if (res.ok) {
        const data = await res.json()
        // Update the selected message with new content
        setSelectedMessage(data.message)
        setReplyText('')
        fetchMessages()
      }
    } catch (error) {
      console.error('Failed to send reply:', error)
    }
  }

  const getClientName = (client: Message['client']) => {
    if (!client) return 'System'
    if (client.companyName) return client.companyName
    return `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'N/A'
  }

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'EMAIL': return Mail
      case 'SMS': return MessageSquare
      case 'PORTAL_MESSAGE': return MessageSquare
      default: return Mail
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
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-500">Client communication center</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Message
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New Message</DialogTitle>
              <DialogDescription>Send a message to a client</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Recipient</Label>
                <Select
                  value={formData.clientId}
                  onValueChange={(v) => setFormData({ ...formData, clientId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.companyName || `${client.firstName} ${client.lastName}`}
                        {client.email && ` (${client.email})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Message Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="PORTAL_MESSAGE">Client Portal</SelectItem>
                    <SelectItem value="SMS">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Message</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={6}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSendMessage} disabled={!formData.clientId || !formData.content}>
                <Send className="w-4 h-4 mr-2" />
                Send
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Message List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search messages..." className="pl-10" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue="inbox">
                <TabsList className="w-full rounded-none border-b">
                  <TabsTrigger value="inbox" className="flex-1">
                    <Inbox className="w-4 h-4 mr-2" />
                    Inbox
                  </TabsTrigger>
                  <TabsTrigger value="sent" className="flex-1">
                    <SendIcon className="w-4 h-4 mr-2" />
                    Sent
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="inbox" className="m-0">
                  {messages.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500">No messages yet</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {messages.map((message) => {
                        const Icon = getMessageIcon(message.type)
                        return (
                          <div
                            key={message.id}
                            className={`p-4 cursor-pointer hover:bg-gray-50 ${
                              !message.isRead ? 'bg-blue-50' : ''
                            } ${selectedMessage?.id === message.id ? 'bg-gray-100' : ''}`}
                            onClick={() => setSelectedMessage(message)}
                          >
                            <div className="flex items-start gap-3">
                              <Icon className="w-5 h-5 text-gray-400 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className={`text-sm font-medium truncate ${!message.isRead ? 'text-gray-900' : 'text-gray-600'}`}>
                                    {getClientName(message.client)}
                                  </p>
                                  <span className="text-xs text-gray-500">
                                    {formatDateTime(message.createdAt)}
                                  </span>
                                </div>
                                {message.subject && (
                                  <p className="text-sm text-gray-600 truncate">{message.subject}</p>
                                )}
                                <p className="text-sm text-gray-500 truncate">{message.content}</p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="sent" className="m-0">
                  <div className="text-center py-8">
                    <p className="text-gray-500">Sent messages will appear here</p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Message Detail */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            {selectedMessage ? (
              <>
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedMessage.subject || 'No Subject'}</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        From: {getClientName(selectedMessage.client)}
                      </p>
                    </div>
                    <Badge variant="secondary">{selectedMessage.type}</Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    {formatDateTime(selectedMessage.createdAt)}
                  </p>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4 max-h-[400px] overflow-y-auto">
                    {selectedMessage.content.split('\n\n---\n').map((part, index) => {
                      // Check if this is a reply (starts with **Reply from)
                      const isReply = part.startsWith('**Reply from')
                      if (isReply) {
                        // Parse reply header and content
                        const lines = part.split('\n')
                        const header = lines[0].replace(/\*\*/g, '') // Remove markdown bold
                        const replyContent = lines.slice(1).join('\n')
                        return (
                          <div key={index} className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                            <p className="text-xs text-blue-600 font-medium mb-2">{header}</p>
                            <p className="text-sm whitespace-pre-wrap">{replyContent}</p>
                          </div>
                        )
                      }
                      // Original message
                      return (
                        <div key={index} className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-500 font-medium mb-2">
                            Original message from {getClientName(selectedMessage.client)}
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{part}</p>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-6 pt-6 border-t">
                    <div className="space-y-4">
                      <Textarea
                        placeholder="Type your reply..."
                        rows={4}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                      />
                      <div className="flex justify-end">
                        <Button
                          disabled={!replyText.trim()}
                          onClick={handleSendReply}
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Send Reply
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Mail className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">Select a message to view</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
