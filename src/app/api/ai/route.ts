import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

const systemPrompts: Record<string, string> = {
  document_draft: `You are an expert legal document drafter. Generate professional legal documents based on the user's requirements. Include proper legal formatting, citations where appropriate, and ensure the document follows standard legal conventions.`,
  contract_review: `You are an expert contract review attorney. Analyze the provided contract and identify:
1. Key terms and obligations
2. Potential risks or issues
3. Missing or unclear provisions
4. Recommendations for changes
Format your response clearly with sections for each finding.`,
  legal_research: `You are an expert legal researcher. Provide comprehensive research on the legal question asked. Include:
1. Relevant legal principles
2. Key case law references
3. Statutory provisions
4. Practical implications
Note: This is for reference only and should be verified with proper legal research tools.`,
  deposition_summary: `You are an expert at summarizing legal depositions. Analyze the transcript and provide:
1. Key admissions or statements
2. Important timeline events
3. Contradictions or inconsistencies
4. Notable quotes
5. Summary of witness credibility indicators`,
  conflict_check: `You are an expert at conflict of interest analysis. Review the provided party names and identify any potential conflicts. Consider:
1. Direct adverse relationships
2. Business relationships
3. Personal relationships
4. Former representations
Note: This is a preliminary check and should be verified against the firm's conflict database.`,
  time_entry: `You are an expert at converting activity descriptions into billable time entries. For each activity, provide:
1. Task description (professional and specific)
2. Suggested time (in hours)
3. LEDES activity code if applicable
Format as structured entries that can be imported into a billing system.`,
  email_draft: `You are an expert legal professional drafting professional correspondence. Write clear, professional emails that are:
1. Appropriately formal
2. Clear and concise
3. Legally appropriate
4. Action-oriented when needed`,
  document_summary: `You are an expert at summarizing legal documents. Provide a comprehensive summary including:
1. Document type and purpose
2. Key parties and their obligations
3. Important dates and deadlines
4. Critical clauses or provisions
5. Overall assessment`
}

async function callOpenRouter(systemPrompt: string, userMessage: string): Promise<{ content: string; tokensUsed?: number }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku'

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'LegalFlow AI Platform'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })
  })

  if (!response.ok) {
    const errorData = await response.text()
    console.error('OpenRouter API error:', errorData)
    throw new Error(`OpenRouter API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || 'No response generated.'
  const tokensUsed = data.usage?.total_tokens

  return { content, tokensUsed }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, prompt, documentType, documentText } = body

    const systemPrompt = systemPrompts[type] || systemPrompts.document_draft

    let userMessage = ''

    switch (type) {
      case 'document_draft':
        userMessage = `Document Type: ${documentType}\n\nInstructions: ${prompt}`
        break
      case 'contract_review':
      case 'document_summary':
      case 'deposition_summary':
        userMessage = `Document to analyze:\n\n${documentText}\n\n${prompt ? `Additional focus areas: ${prompt}` : ''}`
        break
      default:
        userMessage = prompt
    }

    // Check if OpenRouter API key is configured
    if (!process.env.OPENROUTER_API_KEY) {
      // Return a mock response for demo purposes
      const mockResponse = getMockResponse(type, userMessage)

      // Save AI request to database
      await prisma.aIRequest.create({
        data: {
          userId: user.id,
          type: type.toUpperCase().replace('_', '_') as any,
          prompt: userMessage,
          response: mockResponse,
          status: 'COMPLETED',
          completedAt: new Date()
        }
      })

      return NextResponse.json({ response: mockResponse })
    }

    const { content: response, tokensUsed } = await callOpenRouter(systemPrompt, userMessage)

    // Save AI request to database
    await prisma.aIRequest.create({
      data: {
        userId: user.id,
        type: type.toUpperCase().replace('_', '_') as any,
        prompt: userMessage,
        response,
        status: 'COMPLETED',
        tokensUsed,
        completedAt: new Date()
      }
    })

    return NextResponse.json({ response })
  } catch (error) {
    console.error('AI POST error:', error)
    return NextResponse.json({ error: 'Failed to process AI request' }, { status: 500 })
  }
}

function getMockResponse(type: string, prompt: string): string {
  const responses: Record<string, string> = {
    document_draft: `[DEMO MODE - OpenRouter API key not configured]

MOTION FOR SUMMARY JUDGMENT

I. INTRODUCTION

This motion is submitted on behalf of the Plaintiff in the above-captioned matter. Based on the undisputed material facts and applicable law, Plaintiff respectfully requests that this Court grant summary judgment in their favor.

II. STATEMENT OF FACTS

[The facts would be generated based on your specific input]

III. LEGAL ARGUMENT

A. Standard of Review
Summary judgment is appropriate when there is no genuine dispute as to any material fact and the moving party is entitled to judgment as a matter of law.

B. Application
[Legal arguments would be tailored to your case]

IV. CONCLUSION

For the foregoing reasons, Plaintiff respectfully requests that this Court grant summary judgment in their favor.

---
Note: This is a demonstration. Configure your OPENROUTER_API_KEY in .env for full AI capabilities.`,

    contract_review: `[DEMO MODE - OpenRouter API key not configured]

CONTRACT REVIEW ANALYSIS

DOCUMENT OVERVIEW:
- Type: Service Agreement
- Parties Identified: [Based on document]

KEY FINDINGS:

1. FAVORABLE TERMS:
   - Payment terms appear standard
   - Liability limitations present

2. AREAS OF CONCERN:
   - Indemnification clause may be overly broad
   - Termination provisions need clarification
   - Dispute resolution clause missing venue specification

3. MISSING PROVISIONS:
   - Force majeure clause
   - Data protection provisions
   - Confidentiality terms

RECOMMENDATIONS:
1. Negotiate indemnification scope
2. Add specific termination procedures
3. Include data protection clause

---
Note: This is a demonstration. Configure your OPENROUTER_API_KEY in .env for full AI capabilities.`,

    legal_research: `[DEMO MODE - OpenRouter API key not configured]

LEGAL RESEARCH MEMORANDUM

QUESTION PRESENTED:
[Your research question]

BRIEF ANSWER:
Based on preliminary research, the following legal principles apply...

RELEVANT AUTHORITY:

1. Statutory Framework:
   - Applicable statutes would be listed here

2. Case Law:
   - Leading cases would be analyzed

3. Secondary Sources:
   - Treatises and law reviews

ANALYSIS:
[Detailed legal analysis]

CONCLUSION:
[Summary of findings]

---
Note: This is a demonstration. Configure your OPENROUTER_API_KEY in .env for full AI capabilities.`,

    time_entry: `[DEMO MODE - OpenRouter API key not configured]

SUGGESTED TIME ENTRIES:

1. Review and analysis of client documents
   Time: 1.5 hours
   Activity Code: A101

2. Legal research on applicable issues
   Time: 2.0 hours
   Activity Code: A102

3. Draft correspondence to opposing counsel
   Time: 0.5 hours
   Activity Code: A105

4. Client telephone conference
   Time: 0.3 hours
   Activity Code: A106

TOTAL: 4.3 hours

---
Note: This is a demonstration. Configure your OPENROUTER_API_KEY in .env for full AI capabilities.`,

    email_draft: `[DEMO MODE - OpenRouter API key not configured]

Subject: [Your Subject Here]

Dear [Recipient],

I am writing on behalf of [Client Name] regarding [Matter].

[Body of email would be generated based on your input]

Please do not hesitate to contact me if you have any questions or require additional information.

Best regards,

[Your Name]
[Title]
[Firm Name]
[Contact Information]

---
Note: This is a demonstration. Configure your OPENROUTER_API_KEY in .env for full AI capabilities.`
  }

  return responses[type] || `[DEMO MODE] AI response for ${type} request.\n\nConfigure your OPENROUTER_API_KEY in .env for full AI capabilities.`
}
