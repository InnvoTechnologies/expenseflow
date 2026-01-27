import { Resend } from "resend"
import type React from "react"
import { render, toPlainText } from "@react-email/render"

type SendEmailParams = {
  to: string | string[]
  subject: string
  text?: string
  html?: string
  react?: React.ReactElement
}

const resendApiKey = process.env.RESEND_API_KEY
const resendFrom = process.env.RESEND_FROM || "Acme <onboarding@resend.dev>"

let resend: Resend | null = null
if (resendApiKey) {
  resend = new Resend(resendApiKey)
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  if (!resend) {
    // Fallback to console if not configured
    console.log("[Mailer] RESEND_API_KEY not set. Email (simulated):", params)
    return
  }
  const toValue = Array.isArray(params.to) ? params.to : params.to
  const options: any = {
    from: resendFrom,
    to: toValue as any,
    subject: params.subject,
  }
  if (params.react) {
    const html = await render(params.react)
    options.html = html
    options.text = params.text ?? toPlainText(html)
  } else {
    if (params.html) options.html = params.html
    if (params.text) options.text = params.text
  }

  try {
    const result: any = await resend.emails.send(options)
    if (result?.error) {
      console.error('[Mailer] Resend API error:', result.error)
      // Throw the raw API error object to surface details to callers
      throw result.error
    }
    console.log('[Mailer] Email sent:', result?.data?.id, 'to:', params.to)
  } catch (error) {
    console.error('[Mailer] Resend send error:', error)
    throw error
  }
}

