import React from "react"
import { Hr, Link, Tailwind, Text } from "@react-email/components"

type FooterProps = {
  email: string
  marketing?: boolean
  unsubscribeUrl?: string
  notificationSettingsUrl?: string
}

export function Footer({
  email,
  marketing,
  unsubscribeUrl,
  notificationSettingsUrl,
}: FooterProps) {
  if (marketing) {
    const unsubscribeHref =
      unsubscribeUrl || `${process.env.NEXT_PUBLIC_APP_URL || ""}/settings`

    return (
      <Tailwind>
        <Hr className="mx-0 my-6 w-full border border-neutral-200" />
        <Text className="text-[12px] leading-6 text-neutral-500">
          We send product updates occasionally — no spam.{" "}
          <Link className="text-neutral-700 underline" href={unsubscribeHref}>
            Manage your email preferences.
          </Link>
        </Text>
        <Text className="text-[12px] text-neutral-500">
          ExpenseFlow Inc.
          {/* <br />
          2261 Market Street STE 5906
          <br />
          San Francisco, CA 941114 */}
        </Text>
      </Tailwind>
    )
  }

  return (
    <Tailwind>
      <Hr className="mx-0 my-6 w-full border border-neutral-200" />
      <Text className="text-[12px] leading-6 text-neutral-500">
        This email was intended for <span className="text-black">{email}</span>. If you
        were not expecting this, you can ignore it. If you are concerned about your
        account’s safety, reply to this email to get in touch with us.
      </Text>
      {notificationSettingsUrl && (
        <Text className="text-[12px] leading-6 text-neutral-500">
          Don’t want to get these emails?{" "}
          <Link className="text-neutral-700 underline" href={notificationSettingsUrl}>
            Adjust your notification settings
          </Link>
        </Text>
      )}
      <Text className="text-[12px] text-neutral-500">
        ExpenseFlow Inc.
        <br />
        2261 Market Street STE 5906
        <br />
        San Francisco, CA 941114
      </Text>
    </Tailwind>
  )
}

