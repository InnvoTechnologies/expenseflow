import { mutate, requestScope } from "@/lib/chat/rest";
import { ChatError, failure } from "@/lib/chat/core";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { transaction, financeAccount, category, payee, tag, subscriptionTracking } from "@/db/schema";
import { eq, desc, and, sql, or, inArray } from "drizzle-orm";

export async function GET(req: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const headersList = await headers();
    const activeOrgId = headersList.get("X-Organization-Id");
    const userId = session.user.id;

    // 1. Parse Query Params
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const type = url.searchParams.get("type"); // INCOME, EXPENSE, TRANSFER
    const accountId = url.searchParams.get("accountId");
    const search = url.searchParams.get("search");

    const offset = (page - 1) * limit;

    try {
        await requestScope(req, session.user.id);
        // 2. Define Account Scoping
        let accountWhereClause;
        if (activeOrgId) {
            accountWhereClause = eq(financeAccount.organizationId, activeOrgId);
        } else {
            accountWhereClause = eq(financeAccount.userId, userId);
        }

        const userAccounts = await db
            .select({ id: financeAccount.id })
            .from(financeAccount)
            .where(accountWhereClause);

        if (userAccounts.length === 0) {
            return NextResponse.json({
                data: [],
                metadata: {
                    total: 0,
                    page,
                    limit,
                    totalPages: 0,
                }
            });
        }

        const accountIds = userAccounts.map(a => a.id);

        // 3. Build Filters
        const conditions = [
            or(
                inArray(transaction.accountId, accountIds),
                inArray(transaction.toAccountId, accountIds)
            )
        ];

        if (type && ["INCOME", "EXPENSE", "TRANSFER"].includes(type)) {
            conditions.push(eq(transaction.type, type as any));
        }

        if (accountId) {
            conditions.push(
                or(
                    eq(transaction.accountId, accountId),
                    eq(transaction.toAccountId, accountId)
                )
            );
        }

        if (search) {
            const searchLower = `%${search.toLowerCase()}%`;
            conditions.push(
                or(
                    sql`lower(${transaction.description}) LIKE ${searchLower}`,
                    sql`lower(${payee.name}) LIKE ${searchLower}`,
                    sql`lower(${category.name}) LIKE ${searchLower}`
                )
            );
        }

        const whereClause = and(...conditions);

        // 4. Get Total Count (for pagination)
        const [countResult] = await db
            .select({ count: sql<number>`count(distinct ${transaction.id})` })
            .from(transaction)
            .leftJoin(payee, eq(transaction.payeeId, payee.id)) // Joined for search
            .leftJoin(category, eq(transaction.categoryId, category.id)) // Joined for search
            .where(whereClause);

        const total = Number(countResult?.count || 0);

        // 5. Fetch Transactions
        const rows = await db
            .select({
                id: transaction.id,
                amount: transaction.amount,
                feeAmount: transaction.feeAmount,
                type: transaction.type,
                status: transaction.status,
                date: transaction.date,
                description: transaction.description,
                tagIds: transaction.tagIds,
                subscriptionId: transaction.subscriptionId,
                accountId: transaction.accountId,
                toAccountId: transaction.toAccountId,
                categoryId: transaction.categoryId,
                payeeId: transaction.payeeId,
                categoryName: category.name,
                categoryColor: category.color,
                payeeName: payee.name,
                accountName: financeAccount.name,
                subscriptionTitle: subscriptionTracking.title,
            })
            .from(transaction)
            .leftJoin(category, eq(transaction.categoryId, category.id))
            .leftJoin(payee, eq(transaction.payeeId, payee.id))
            .leftJoin(subscriptionTracking, eq(transaction.subscriptionId, subscriptionTracking.id))
            .innerJoin(financeAccount, eq(transaction.accountId, financeAccount.id))
            .where(whereClause)
            .orderBy(desc(transaction.date), desc(transaction.createdAt))
            .limit(limit)
            .offset(offset);

        // 6. Fetch Tags for these transactions
        // Collect all tag IDs
        const allTagIds = Array.from(new Set(rows.flatMap(r => r.tagIds || []).filter(id => id !== null)));

        const tagsMap = new Map();
        if (allTagIds.length > 0) {
            const tags = await db.select().from(tag).where(inArray(tag.id, allTagIds as string[]));
            tags.forEach(t => tagsMap.set(t.id, t));
        }

        const formattedTransactions = rows.map(r => ({
            id: r.id,
            amount: r.amount,
            feeAmount: r.feeAmount,
            type: r.type,
            status: r.status,
            date: r.date,
            description: r.description,
            tagIds: r.tagIds,
            accountId: r.accountId,
            toAccountId: r.toAccountId,
            categoryId: r.categoryId,
            payeeId: r.payeeId,
            tags: r.tagIds ? r.tagIds.map(id => tagsMap.get(id)).filter(Boolean) : [],
            category: r.categoryName ? { id: r.categoryId, name: r.categoryName, color: r.categoryColor } : null,
            payee: r.payeeName ? { id: r.payeeId, name: r.payeeName } : null,
            subscription: r.subscriptionTitle ? { id: r.subscriptionId, title: r.subscriptionTitle } : null,
            account: { id: r.accountId, name: r.accountName },
            toAccount: r.toAccountId ? { id: r.toAccountId } : null
        }));

        return NextResponse.json({
            data: formattedTransactions,
            metadata: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            }
        });

    } catch (error) {
        if (error instanceof ChatError) return failure(error);
        console.error("Error fetching transactions:", error);
        return NextResponse.json(
            { error: "Failed to fetch transactions" },
            { status: 500 }
        );
    }
}


export async function POST(req: NextRequest) {
    // Authentication, workspace checks, validation and creation are shared with copilot tools.
    return mutate(req, "create_transaction");
}
