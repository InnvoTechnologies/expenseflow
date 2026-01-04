import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { transaction, financeAccount, category, payee } from "@/db/schema";
import { eq, desc, and, sql, or } from "drizzle-orm";
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

    try {
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
            return NextResponse.json([]);
        }

        const accountIds = userAccounts.map(a => a.id);

        // Fetch transactions
        const rows = await db
            .select({
                id: transaction.id,
                amount: transaction.amount,
                feeAmount: transaction.feeAmount,
                type: transaction.type,
                status: transaction.status,
                date: transaction.date,
                description: transaction.description,
                categoryName: category.name,
                categoryColor: category.color,
                payeeName: payee.name,
                accountName: financeAccount.name,
            })
            .from(transaction)
            .leftJoin(category, eq(transaction.categoryId, category.id))
            .leftJoin(payee, eq(transaction.payeeId, payee.id))
            .innerJoin(financeAccount, eq(transaction.accountId, financeAccount.id))
            .where(
                or(
                    sql`${transaction.accountId} IN ${accountIds}`,
                    sql`${transaction.toAccountId} IN ${accountIds}`
                )
            )
            .orderBy(desc(transaction.date), desc(transaction.createdAt))
            .limit(100);

        const formattedTransactions = rows.map(r => ({
            id: r.id,
            amount: r.amount,
            feeAmount: r.feeAmount,
            type: r.type,
            status: r.status,
            date: r.date,
            description: r.description,
            category: r.categoryName ? { name: r.categoryName, color: r.categoryColor } : null,
            payee: r.payeeName ? { name: r.payeeName } : null,
            account: { name: r.accountName },
            toAccount: null
        }));

        return NextResponse.json(formattedTransactions);
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
