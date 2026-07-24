import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json(); const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
    if (!prompt || prompt.length > 4000) return NextResponse.json({ error: 'Prompt must contain 1-4000 characters' }, { status: 400 })
    const apiKey=process.env.OPENROUTER_API_KEY?.trim(); const model=process.env.OPENROUTER_MODEL?.trim(); const baseUrl=process.env.OPENROUTER_BASE_URL?.replace(/\/+$/,'')
    if(!apiKey||!model||baseUrl!=='https://openrouter.ai/api/v1')return NextResponse.json({error:'Exact OpenRouter configuration is required'},{status:503})
    const response=await fetch(`${baseUrl}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:'Give concise law-firm operations guidance. Do not provide legal advice and require attorney review for legal decisions.'},{role:'user',content:prompt}],max_tokens:180}),signal:AbortSignal.timeout(45000),cache:'no-store'})
    const payload=await response.json().catch(()=>({})) as {id?:string;model?:string;provider?:string;created?:number;choices?:Array<{message?:{content?:string}}>} ; const content=payload.choices?.[0]?.message?.content?.trim()
    if(!response.ok||!payload.id||!content)throw new Error(`OpenRouter request failed with HTTP ${response.status}`)
    const receipt=await prisma.aiProviderReceipt.create({data:{userId:user.id,provider:'openrouter',providerRequestId:payload.id,model:payload.model||model,prompt,content},select:{id:true,provider:true,providerRequestId:true,model:true,createdAt:true}})
    const providerReceipt={requestId:receipt.providerRequestId,provider:payload.provider||receipt.provider,upstreamModel:receipt.model,created:Number(payload.created||0)}
    return NextResponse.json({content,model:receipt.model,providerReceipt,interactionId:receipt.id,feature:'law-firm-operations-recommendation'})
  } catch(error) { console.error('Runtime AI request failed',error instanceof Error?error.message:'unknown'); return NextResponse.json({error:'AI provider request failed'},{status:502}) }
}
