"use client"

import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Summary = { id: string; matterId: string; title: string; jurisdiction: string; status: string; version: number; updatedAt: string }
type Matter = { id: string; matterNumber: string; name: string }
type PackageState = Summary & { members: Record<string, unknown>; documents: Record<string, unknown>; reviews: unknown[]; signatures: unknown[]; audit?: unknown[] }

export default function GovernedFilingsPage() {
  const [packages, setPackages] = useState<Summary[]>([])
  const [matters, setMatters] = useState<Matter[]>([])
  const [current, setCurrent] = useState<PackageState | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [create, setCreate] = useState({ matterId: '', title: '', jurisdiction: '', filingDate: new Date().toISOString().slice(0, 10) })
  const [access, setAccess] = useState({ userId: '', permission: 'VIEWER', reason: '' })
  const [document, setDocument] = useState({ name: '', kind: 'PLEADING', sourceReference: '', privileged: true, contentBase64: '' })
  const [review, setReview] = useState({ notes: '', jurisdictionChecked: false, effectiveDateChecked: false })
  const [signer, setSigner] = useState({ email: '', reference: '' })
  const [reason, setReason] = useState('')

  const loadList = async () => {
    const [packageResponse, matterResponse] = await Promise.all([
      fetch('/api/governed-filings'),
      fetch('/api/matters?limit=100'),
    ])
    if (packageResponse.ok) setPackages((await packageResponse.json()).filingPackages || [])
    if (matterResponse.ok) setMatters((await matterResponse.json()).matters || [])
  }

  useEffect(() => { void loadList() }, [])

  const request = async (url: string, body?: Record<string, unknown>) => {
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch(url, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined)
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || 'The governed operation failed')
      const state = value.filingPackage as PackageState
      setCurrent(state)
      setNotice(`Saved ${state.status} package version ${state.version}.`)
      await loadList()
      return state
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The governed operation failed')
      return null
    } finally { setBusy(false) }
  }

  const load = async (id: string) => { await request(`/api/governed-filings/${id}`) }
  const action = async (body: Record<string, unknown>) => {
    if (!current) return
    await request(`/api/governed-filings/${current.id}/actions`, body)
  }
  const upload = async (file: File | null) => {
    if (!file) return
    const bytes = new Uint8Array(await file.arrayBuffer())
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    setDocument((value) => ({ ...value, name: file.name, contentBase64: btoa(binary) }))
  }

  return <div className="space-y-6">
    <div className="flex items-center gap-3">
      <ShieldCheck className="h-8 w-8" />
      <div><h1 className="text-2xl font-bold">Governed Filings</h1><p className="text-sm text-gray-600">Evidence-backed filing packages with independent legal review.</p></div>
    </div>
    {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {notice && <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</div>}

    <div className="grid gap-6 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>Create package</CardTitle><CardDescription>The template provider must return an allow-listed, effective court form.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <Label>Matter</Label><select className="w-full rounded border p-2" value={create.matterId} onChange={(event) => setCreate({ ...create, matterId: event.target.value })}>
            <option value="">Select a matter</option>{matters.map((matter) => <option key={matter.id} value={matter.id}>{matter.matterNumber} — {matter.name}</option>)}
          </select>
          <Label>Title</Label><Input value={create.title} onChange={(event) => setCreate({ ...create, title: event.target.value })} />
          <div className="grid grid-cols-2 gap-3"><div><Label>Jurisdiction</Label><Input value={create.jurisdiction} onChange={(event) => setCreate({ ...create, jurisdiction: event.target.value })} /></div><div><Label>Filing date</Label><Input type="date" value={create.filingDate} onChange={(event) => setCreate({ ...create, filingDate: event.target.value })} /></div></div>
          <Button disabled={busy || !create.matterId} onClick={() => request('/api/governed-filings', { ...create, filingDate: `${create.filingDate}T00:00:00.000Z` })}>Create verified package</Button>
        </CardContent></Card>

      <Card><CardHeader><CardTitle>Accessible packages</CardTitle><CardDescription>Revoked packages are not discoverable.</CardDescription></CardHeader><CardContent className="space-y-2">
        {packages.length === 0 && <p className="text-sm text-gray-500">No governed filing packages are accessible.</p>}
        {packages.map((item) => <button key={item.id} onClick={() => load(item.id)} className="w-full rounded border p-3 text-left hover:bg-gray-50"><div className="font-medium">{item.title}</div><div className="text-xs text-gray-500">{item.jurisdiction} · {item.status} · version {item.version}</div></button>)}
      </CardContent></Card>
    </div>

    {current && <>
      <Card><CardHeader><CardTitle>{current.title}</CardTitle><CardDescription>{current.jurisdiction} · {current.status} · immutable version {current.version}</CardDescription></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3"><div>Documents: {Object.keys(current.documents).length}</div><div>Reviews: {current.reviews.length}</div><div>Audit events: {current.audit?.length || 0}</div></CardContent>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Matter access</CardTitle></CardHeader><CardContent className="space-y-3">
          <Label>User ID</Label><Input value={access.userId} onChange={(event) => setAccess({ ...access, userId: event.target.value })} />
          <Label>Permission</Label><select className="w-full rounded border p-2" value={access.permission} onChange={(event) => setAccess({ ...access, permission: event.target.value })}><option>VIEWER</option><option>EDITOR</option><option>LEGAL_REVIEWER</option></select>
          <Label>Revocation reason</Label><Input value={access.reason} onChange={(event) => setAccess({ ...access, reason: event.target.value })} />
          <div className="flex gap-2"><Button disabled={busy || !access.userId} onClick={() => action({ action: 'grant_access', userId: access.userId, permission: access.permission })}>Grant</Button><Button variant="outline" disabled={busy || !access.userId || !access.reason} onClick={() => action({ action: 'revoke_access', userId: access.userId, reason: access.reason })}>Revoke</Button></div>
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Versioned document</CardTitle><CardDescription>Upload at most 5 MB. Storage and OCR provenance are recorded.</CardDescription></CardHeader><CardContent className="space-y-3">
          <Input type="file" onChange={(event) => upload(event.target.files?.[0] || null)} />
          <div className="grid grid-cols-2 gap-3"><div><Label>Name</Label><Input value={document.name} onChange={(event) => setDocument({ ...document, name: event.target.value })} /></div><div><Label>Kind</Label><Input value={document.kind} onChange={(event) => setDocument({ ...document, kind: event.target.value })} /></div></div>
          <Label>Source reference</Label><Input value={document.sourceReference} onChange={(event) => setDocument({ ...document, sourceReference: event.target.value })} />
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={document.privileged} onChange={(event) => setDocument({ ...document, privileged: event.target.checked })} /> Attorney privileged</label>
          <div className="flex gap-2"><Button disabled={busy || !document.contentBase64 || !document.sourceReference} onClick={() => action({ action: 'add_document', ...document })}>Store and OCR</Button><Button variant="outline" disabled={busy} onClick={() => action({ action: 'create_authoritative_form' })}>Create official form</Button></div>
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Independent legal review</CardTitle></CardHeader><CardContent className="space-y-3">
          <Textarea value={review.notes} onChange={(event) => setReview({ ...review, notes: event.target.value })} placeholder="Counsel review evidence" />
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={review.jurisdictionChecked} onChange={(event) => setReview({ ...review, jurisdictionChecked: event.target.checked })} /> Jurisdiction checked</label>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={review.effectiveDateChecked} onChange={(event) => setReview({ ...review, effectiveDateChecked: event.target.checked })} /> Effective date checked</label>
          <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => action({ action: 'submit_review' })}>Request review</Button><Button disabled={busy || !review.notes} onClick={() => action({ action: 'review', decision: 'APPROVE', ...review })}>Approve</Button><Button variant="outline" disabled={busy || !review.notes} onClick={() => action({ action: 'review', decision: 'REJECT', ...review })}>Reject</Button></div>
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Signature and court filing</CardTitle><CardDescription>Signature completion is verified directly with the configured provider.</CardDescription></CardHeader><CardContent className="space-y-3">
          <Label>Signer email</Label><Input type="email" value={signer.email} onChange={(event) => setSigner({ ...signer, email: event.target.value })} />
          <Button disabled={busy || !signer.email} onClick={() => action({ action: 'request_signature', signerEmail: signer.email, idempotencyKey: `signature:${current.id}:${signer.email}` })}>Request signature</Button>
          <Label>Provider envelope reference</Label><Input value={signer.reference} onChange={(event) => setSigner({ ...signer, reference: event.target.value })} />
          <div className="flex gap-2"><Button variant="outline" disabled={busy || !signer.reference} onClick={() => action({ action: 'reconcile_signature', providerReference: signer.reference })}>Verify signature</Button><Button disabled={busy} onClick={() => action({ action: 'file', idempotencyKey: `filing:${current.id}` })}>Submit to court</Button></div>
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Export, hold, and retention</CardTitle></CardHeader><CardContent className="space-y-3">
          <Label>Reason</Label><Input value={reason} onChange={(event) => setReason(event.target.value)} />
          <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => action({ action: 'export', includePrivileged: false, idempotencyKey: `public-export:${current.id}:${current.version}` })}>Public export</Button><Button variant="outline" disabled={busy} onClick={() => action({ action: 'export', includePrivileged: true, idempotencyKey: `privileged-export:${current.id}:${current.version}` })}>Privileged export</Button></div>
          <div className="flex flex-wrap gap-2"><Button disabled={busy || !reason} onClick={() => action({ action: 'set_legal_hold', active: true, reason })}>Place hold</Button><Button variant="outline" disabled={busy || !reason} onClick={() => action({ action: 'set_legal_hold', active: false, reason })}>Release hold</Button><Button variant="outline" disabled={busy || !reason} onClick={() => action({ action: 'enforce_retention', asOf: new Date().toISOString(), reason })}>Enforce retention</Button></div>
        </CardContent></Card>
      </div>
    </>}
  </div>
}
