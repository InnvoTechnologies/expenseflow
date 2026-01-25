import React from "react"
import { Html, Head, Preview, Body, Container, Section, Text, Link, Hr, Img, Heading, Tailwind } from "@react-email/components"
import { Footer } from "@/emails/components/Footer"

type ActionEmailProps = {
  appName?: string
  title: string
  description: string
  actionText: string
  actionUrl: string
  footerNote?: string
  email?: string
}

export function ActionEmail({
  appName,
  title,
  description,
  actionText,
  actionUrl,
  footerNote,
  email,
}: ActionEmailProps) {
  const name = appName || process.env.NEXT_PUBLIC_APP_NAME || "ExpenseFlow"
  const footer = footerNote || `${name} • Do not reply to this email.`
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ""
  const wordmark = baseUrl ? `${baseUrl}/logo-dark.svg` : undefined
  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
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
              {title}
            </Heading>
            <Text className="mx-auto text-sm leading-6 text-black">
              {description}
            </Text>

            <Section className="my-8 text-center">
              <Link
                href={actionUrl}
                className="inline-block rounded bg-black px-4 py-2 text-sm font-semibold text-white no-underline"
              >
                {actionText}
              </Link>
            </Section>

            <Text className="break-all text-center text-xs text-neutral-500">{actionUrl}</Text>

            <Footer email={email || ""} />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
