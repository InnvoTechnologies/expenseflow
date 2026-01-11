import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db/drizzle'
import { user as userTable, financeAccount } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get default account currency
    const [defaultAccount] = await db
      .select({ currency: financeAccount.currency })
      .from(financeAccount)
      .where(
        and(
          eq(financeAccount.userId, session.user.id),
          eq(financeAccount.isDefault, true)
        )
      )
      .limit(1)

    // Fallback if no default account, check for any account
    let currency = defaultAccount?.currency;

    if (!currency) {
      const [anyAccount] = await db
        .select({ currency: financeAccount.currency })
        .from(financeAccount)
        .where(eq(financeAccount.userId, session.user.id))
        .limit(1)
      currency = anyAccount?.currency
    }

    return NextResponse.json({
      baseCurrency: currency || "USD", // Fallback to USD if no accounts
      country: "US", // Default since not in schema
      numberFormat: 2, // Default since not in schema
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

    // Build update object
    const updateData: any = {}

    if (firstName || lastName) {
      const trimmedFirst = (firstName ?? '').trim()
      const trimmedLast = (lastName ?? '').trim()
      const fullName = [trimmedFirst, trimmedLast].filter(Boolean).join(' ')

      if (!fullName) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
      }
      updateData.name = fullName
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    updateData.updatedAt = new Date()

    await db.update(userTable)
      .set(updateData)
      .where(eq(userTable.id, session.user.id))

    return NextResponse.json({ success: true, ...updateData })
  } catch (error: any) {
    console.error('[Profile PATCH] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}


