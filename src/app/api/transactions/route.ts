import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { transaction, financeAccount, category, payee, tag, subscriptionTracking } from "@/db/schema";
import { eq, desc, and, sql, or, inArray } from "drizzle-orm";
import { z } from "zod";

const createTransactionSchema = z.object({
    amount: z.number().or(z.string()).transform(val => val.toString()),
    feeAmount: z.number().or(z.string()).optional().transform(val => val ? val.toString() : "0"),
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
    date: z.string().transform(str => new Date(str)),
    description: z.string().optional(),
    accountId: z.string().min(1),
    toAccountId: z.string().optional(),
    categoryId: z.string().optional(),
    payeeId: z.string().optional(),
    tagIds: z.array(z.string()).optional(),
    subscriptionId: z.string().optional(),
    status: z.enum(["pending", "completed", "failed"]).default("completed"),
}).refine((data) => {
    if (data.type === "TRANSFER" && !data.toAccountId) return false;
    if (data.type === "TRANSFER" && data.accountId === data.toAccountId) return false;
    return true;
}, {
    message: "Transfer requires a valid destination account different from source",
    path: ["toAccountId"],
});

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

        let tagsMap = new Map();
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
        console.error("Error fetching transactions:", error);
        return NextResponse.json(
            { error: "Failed to fetch transactions" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const headersList = await headers();
    const activeOrgId = headersList.get("X-Organization-Id");
    const userId = session.user.id;

    type TransactionResponse = {
        id: string;
        // add other fields if needed for the response
    };

    try {
        const body = await req.json();
        const validatedData = createTransactionSchema.parse(body);
        const amount = parseFloat(validatedData.amount);
        const fee = parseFloat(validatedData.feeAmount || "0");

        if (isNaN(amount) || amount <= 0) {
            return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
        }
        if (isNaN(fee) || fee < 0) {
            return NextResponse.json({ error: "Invalid fee amount" }, { status: 400 });
        }

        // Use a transaction to ensure atomicity
        const result = await db.transaction(async (tx): Promise<TransactionResponse> => {
            // 1. Verify Source Account Ownership & Balance
            const [sourceAccount] = await tx
                .select()
                .from(financeAccount)
                .where(eq(financeAccount.id, validatedData.accountId))
                .limit(1);

            if (!sourceAccount) {
                throw new Error("Source account not found");
            }

            const isSourceOwner = (sourceAccount.organizationId && sourceAccount.organizationId === activeOrgId) ||
                (sourceAccount.userId && sourceAccount.userId === userId);

            if (!isSourceOwner) {
                throw new Error("Forbidden access to source account");
            }

            const currentBalance = parseFloat(sourceAccount.currentBalance);
            const totalDeduction = amount + fee;

            // 2. Handle Logic based on type
            if (validatedData.type === "EXPENSE" || validatedData.type === "TRANSFER") {
                if (currentBalance < totalDeduction) {
                    throw new Error("Insufficient balance (including fee)");
                }

                // Deduct from source (Amount + Fee)
                await tx
                    .update(financeAccount)
                    .set({
                        currentBalance: sql`${financeAccount.currentBalance} - ${totalDeduction.toString()}`,
                        updatedAt: new Date(),
                    })
                    .where(eq(financeAccount.id, validatedData.accountId));
            } else if (validatedData.type === "INCOME") {
                // Add to source (Amount - Fee) -> Net Income
                const netIncome = amount - fee;

                await tx
                    .update(financeAccount)
                    .set({
                        currentBalance: sql`${financeAccount.currentBalance} + ${netIncome.toString()}`,
                        updatedAt: new Date(),
                    })
                    .where(eq(financeAccount.id, validatedData.accountId));
            }

            // 3. Handle Transfer Destination
            if (validatedData.type === "TRANSFER") {
                const [destAccount] = await tx
                    .select()
                    .from(financeAccount)
                    .where(eq(financeAccount.id, validatedData.toAccountId!))
                    .limit(1);

                if (!destAccount) {
                    throw new Error("Destination account not found");
                }

                // Add to destination (Only Amount, Fee is consumed)
                await tx
                    .update(financeAccount)
                    .set({
                        currentBalance: sql`${financeAccount.currentBalance} + ${validatedData.amount}`,
                        updatedAt: new Date(),
                    })
                    .where(eq(financeAccount.id, validatedData.toAccountId!));
            }

            // 4. Create Transaction Record
            const [newTransaction] = await tx
                .insert(transaction)
                .values({
                    amount: validatedData.amount,
                    feeAmount: validatedData.feeAmount,
                    type: validatedData.type as any,
                    date: validatedData.date,
                    description: validatedData.description,
                    accountId: validatedData.accountId,
                    toAccountId: validatedData.toAccountId || null,
                    categoryId: validatedData.categoryId || null,
                    payeeId: validatedData.payeeId || null,
                    tagIds: validatedData.tagIds || null,
                    subscriptionId: validatedData.subscriptionId || null,
                    status: validatedData.status,
                })
                .returning();

            return newTransaction;
        });

        return NextResponse.json(result);

    } catch (error: any) {
        console.error("Error creating transaction:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { error: error.message || "Failed to create transaction" },
            { status: 400 }
        );
    }
}
