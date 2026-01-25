import React from "react"
import { Html, Head, Preview, Body, Container, Section, Text, Img, Heading, Tailwind } from "@react-email/components"
import { Footer } from "@/emails/components/Footer"

type MagicCodeEmailProps = {
  appName?: string
  code: string
  footerNote?: string
  email?: string
}

export function MagicCodeEmail({
  appName,
  code,
  footerNote,
  email,
}: MagicCodeEmailProps) {
  const name = appName || process.env.NEXT_PUBLIC_APP_NAME || "ExpenseFlow"
  const footer = footerNote || `${name} • Do not reply to this email.`
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ""
  const wordmark = baseUrl ? `${baseUrl}/logo-dark.svg` : undefined
  return (
    <Html>
      <Head />
      <Preview>Your verification code</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto bg-white font-sans">
          <Container className="mx-auto my-10 max-w-[600px] rounded border border-solid border-neutral-200 px-10 py-5">
            <Section className="mt-8">
              {wordmark ? (
                <Img src={wordmark} height="32" alt={name} />
              ) : (
                <Text className="text-xl font-bold text-black">{name}</Text>
              )}
            </Section>

            <Heading className="mx-0 my-7 p-0 text-xl font-medium text-black">
              Please confirm your email address
            </Heading>
            <Text className="mx-auto text-sm leading-6 text-black">
              Enter this code to complete your sign up:
            </Text>

            <Section className="my-8 rounded-lg border border-solid border-neutral-200">
              <div className="mx-auto w-fit px-6 py-3 text-center font-mono text-2xl font-semibold tracking-[0.25em]">
                {code}
              </div>
            </Section>

            <Text className="text-sm leading-6 text-black">
              This code expires in 10 minutes.
            </Text>

            <Footer email={email || ""} />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
