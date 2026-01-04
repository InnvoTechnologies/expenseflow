"use server"

import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/db/drizzle"
import { transaction, financeAccount, category } from "@/db/schema"
import { eq, and, desc, isNull, sql } from "drizzle-orm"

export async function getTransactions({
    organizationId
}: {
    organizationId?: string | null
} = {}) {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (!session?.user) {
        throw new Error("Unauthorized")
    }

    const userId = session.user.id

    // Base conditions for the join
    // We want transactions where the account belongs to the scope

    let whereCondition;

    if (organizationId) {
        // Organization Scope: Accounts belonging to the org
        whereCondition = eq(financeAccount.organizationId, organizationId)
    } else {
        // Personal Scope: Accounts belonging to the user AND not belonging to any org
        // (Though the schema says userId OR organizationId, being explicit is safer)
        whereCondition = and(
            eq(financeAccount.userId, userId),
            isNull(financeAccount.organizationId)
        )
    }

    const data = await db
        .select({
            id: transaction.id,
            amount: transaction.amount,
            kind: transaction.type, // Map 'type' to 'kind' to match UI expectation if needed, or update UI
            transactionDate: transaction.date,
            description: transaction.description,
            status: transaction.status,
            categoryName: category.name,
            accountName: financeAccount.name,
            accountId: financeAccount.id,
        })
        .from(transaction)
        .innerJoin(financeAccount, eq(transaction.accountId, financeAccount.id))
        .leftJoin(category, eq(transaction.categoryId, category.id))
        .where(whereCondition)
        .orderBy(desc(transaction.date))

    // Map the data to match the UI's expected format if there are discrepancies
    // UI usage: 
    // kind (expense, income, transfer, person) - DB has 'EXPENSE', 'INCOME', 'TRANSFER'
    // transactionDate
    // description
    // categoryName
    // accountName
    // amount

    return data.map(tx => ({
        ...tx,
        kind: tx.kind.toLowerCase(), // generic mapping, enum is uppercase in DB
        amount: Number(tx.amount), // ensure number for math
    }))
}
