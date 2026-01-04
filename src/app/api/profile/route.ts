import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db/drizzle'
import { user as userTable } from '@/db/schema'
import { eq } from 'drizzle-orm'

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

    if (baseCurrency) {
      updateData.baseCurrency = baseCurrency
    }

    if (country) {
      updateData.country = country
    }

    if (numberFormat !== undefined) {
      updateData.numberFormat = numberFormat
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


