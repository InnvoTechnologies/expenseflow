import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db/drizzle'
import { user as userTable, organization as organizationTable, financeAccount } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const activeOrgId = request.headers.get("X-Organization-Id")

    if (activeOrgId) {
      // Fetch organization settings
      const [org] = await db
        .select({
          baseCurrency: organizationTable.baseCurrency,
          country: organizationTable.country,
          numberFormat: organizationTable.numberFormat,
        })
        .from(organizationTable)
        .where(eq(organizationTable.id, activeOrgId))
        .limit(1)

      if (org) {
        return NextResponse.json({
          baseCurrency: org.baseCurrency,
          country: org.country,
          numberFormat: org.numberFormat,
        })
      }
    }

    // Default to user settings
    const [u] = await db
      .select({
        baseCurrency: userTable.baseCurrency,
        country: userTable.country,
        numberFormat: userTable.numberFormat,
      })
      .from(userTable)
      .where(eq(userTable.id, session.user.id))
      .limit(1)

    return NextResponse.json({
      baseCurrency: u?.baseCurrency || "USD",
      country: u?.country || "US",
      numberFormat: u?.numberFormat ?? 2,
    })
  } catch (error: any) {
    console.error('[Profile GET] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const firstName: string | undefined = body.firstName
    const lastName: string | undefined = body.lastName
    const baseCurrency: string | undefined = body.baseCurrency
    const country: string | undefined = body.country
    const numberFormat: number | undefined = body.numberFormat

    // 1. Update user's name if provided
    if (firstName || lastName) {
      const trimmedFirst = (firstName ?? '').trim()
      const trimmedLast = (lastName ?? '').trim()
      const fullName = [trimmedFirst, trimmedLast].filter(Boolean).join(' ')

      if (!fullName) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
      }

      await db.update(userTable)
        .set({
          name: fullName,
          updatedAt: new Date()
        })
        .where(eq(userTable.id, session.user.id))
    }

    // 2. Update currency and locale formatting settings if provided
    if (baseCurrency || country || numberFormat !== undefined) {
      const updateData: any = {}
      if (baseCurrency) updateData.baseCurrency = baseCurrency
      if (country) updateData.country = country
      if (numberFormat !== undefined) updateData.numberFormat = numberFormat

      const activeOrgId = request.headers.get("X-Organization-Id")
      if (activeOrgId) {
        // Update organization settings
        await db.update(organizationTable)
          .set(updateData)
          .where(eq(organizationTable.id, activeOrgId))

        // Cascade currency change to all organization finance accounts
        if (baseCurrency) {
          await db.update(financeAccount)
            .set({ currency: baseCurrency })
            .where(eq(financeAccount.organizationId, activeOrgId))
        }
      } else {
        // Update user settings
        updateData.updatedAt = new Date()
        await db.update(userTable)
          .set(updateData)
          .where(eq(userTable.id, session.user.id))

        // Cascade currency change to user's personal finance accounts (not belonging to any org)
        if (baseCurrency) {
          await db.update(financeAccount)
            .set({ currency: baseCurrency })
            .where(
              and(
                eq(financeAccount.userId, session.user.id),
                isNull(financeAccount.organizationId)
              )
            )
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Profile PATCH] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}



