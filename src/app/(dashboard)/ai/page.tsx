"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Brain,
  FileText,
  Search,
  Clock,
  Mail,
  Scale,
  Users,
  Loader2,
  Sparkles,
  MessageSquare,
  BookOpen
} from 'lucide-react'

const aiFeatures = [
  {
    id: 'document_draft',
    name: 'Document Drafting',
    description: 'Generate legal documents from templates',
    icon: FileText
  },
  {
    id: 'contract_review',
    name: 'Contract Review',
    description: 'Analyze contracts for issues and risks',
    icon: Search
  },
  {
    id: 'legal_research',
    name: 'Legal Research',
    description: 'Research case law and legal precedents',
    icon: BookOpen
  },
  {
    id: 'deposition_summary',
    name: 'Deposition Summary',
    description: 'Summarize deposition transcripts',
    icon: MessageSquare
  },
  {
    id: 'conflict_check',
    name: 'Conflict Checker',
    description: 'Automated conflict of interest detection',
    icon: Users
  },
  {
    id: 'time_entry',
    name: 'Time Entry Assistant',
    description: 'Capture billable time from activities',
    icon: Clock
  },
  {
    id: 'email_draft',
    name: 'Email Drafter',
    description: 'Draft professional correspondence',
    icon: Mail
  },
  {
    id: 'document_summary',
    name: 'Document Summarizer',
    description: 'Summarize lengthy legal documents',
    icon: FileText
  }
]

export default function AIAssistantPage() {
  const [selectedFeature, setSelectedFeature] = useState('document_draft')
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [documentType, setDocumentType] = useState('')
  const [documentText, setDocumentText] = useState('')

  const handleSubmit = async () => {
    setLoading(true)
    setResponse('')

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedFeature,
          prompt,
          documentType,
          documentText
        })
      })

      const data = await res.json()

      if (res.ok) {
        setResponse(data.response)
      } else {
        setResponse(`Error: ${data.error}`)
      }
    } catch (error) {
      setResponse('Failed to process request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const currentFeature = aiFeatures.find(f => f.id === selectedFeature)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
          <p className="text-gray-500">Powered by advanced AI for legal workflows</p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          AI Powered
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Feature Selection */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AI Features</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {aiFeatures.map((feature) => (
                  <button
                    key={feature.id}
                    onClick={() => {
                      setSelectedFeature(feature.id)
                      setPrompt('')
                      setResponse('')
                    }}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedFeature === feature.id ? 'bg-gray-100' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <feature.icon className={`w-5 h-5 ${
                        selectedFeature === feature.id ? 'text-gray-900' : 'text-gray-400'
                      }`} />
                      <div>
                        <p className={`text-sm font-medium ${
                          selectedFeature === feature.id ? 'text-gray-900' : 'text-gray-600'
                        }`}>
                          {feature.name}
                        </p>
                        <p className="text-xs text-gray-500">{feature.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                {currentFeature && <currentFeature.icon className="w-6 h-6 text-gray-900" />}
                <div>
                  <CardTitle>{currentFeature?.name}</CardTitle>
                  <CardDescription>{currentFeature?.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedFeature === 'document_draft' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Document Type</Label>
                    <Select value={documentType} onValueChange={setDocumentType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select document type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="motion">Motion</SelectItem>
                        <SelectItem value="brief">Legal Brief</SelectItem>
                        <SelectItem value="letter">Demand Letter</SelectItem>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="complaint">Complaint</SelectItem>
                        <SelectItem value="answer">Answer</SelectItem>
                        <SelectItem value="discovery">Discovery Request</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Instructions</Label>
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe the document you need. Include relevant facts, parties involved, and key points to address..."
                      rows={5}
                    />
                  </div>
                </div>
              )}

              {(selectedFeature === 'contract_review' || selectedFeature === 'document_summary' || selectedFeature === 'deposition_summary') && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Paste Document Text</Label>
                    <Textarea
                      value={documentText}
                      onChange={(e) => setDocumentText(e.target.value)}
                      placeholder="Paste the document text here for analysis..."
                      rows={10}
                    />
                  </div>
                  {selectedFeature === 'contract_review' && (
                    <div className="space-y-2">
                      <Label>Focus Areas (Optional)</Label>
                      <Input
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., liability clauses, termination terms, payment terms..."
                      />
                    </div>
                  )}
                </div>
              )}

              {selectedFeature === 'legal_research' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Research Query</Label>
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe your legal research question. Include jurisdiction, relevant facts, and specific legal issues..."
                      rows={5}
                    />
                  </div>
                </div>
              )}

              {selectedFeature === 'conflict_check' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Party Names</Label>
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Enter names of all parties to check for conflicts (one per line)..."
                      rows={5}
                    />
                  </div>
                </div>
              )}

              {selectedFeature === 'time_entry' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Activity Description</Label>
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe your activities today. The AI will help format them into billable time entries..."
                      rows={5}
                    />
                  </div>
                </div>
              )}

              {selectedFeature === 'email_draft' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email Purpose</Label>
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe the email you need to write. Include recipient type, purpose, and key points..."
                      rows={5}
                    />
                  </div>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={loading || (!prompt && !documentText)}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    Generate with AI
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Response */}
          {response && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  AI Response
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 rounded-lg p-4">
                  <pre className="whitespace-pre-wrap text-sm font-mono">{response}</pre>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={() => navigator.clipboard.writeText(response)}>
                    Copy to Clipboard
                  </Button>
                  <Button variant="outline">Save as Document</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
