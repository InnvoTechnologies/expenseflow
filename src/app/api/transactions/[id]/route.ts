import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { transaction, financeAccount } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
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
        await db.transaction(async (tx) => {
            // 1. Fetch existing transaction with Account details
            const [existingTx] = await tx
                .select({
                    id: transaction.id,
                    amount: transaction.amount,
                    feeAmount: transaction.feeAmount,
                    type: transaction.type,
                    accountId: transaction.accountId,
                    toAccountId: transaction.toAccountId,
                    // Account details for ownership check
                    accountOrganizationId: financeAccount.organizationId,
                    accountUserId: financeAccount.userId
                })
                .from(transaction)
                .innerJoin(financeAccount, eq(transaction.accountId, financeAccount.id))
                .where(eq(transaction.id, id))
                .limit(1);

            if (!existingTx) {
                throw new Error("Transaction not found");
            }

            // 2. Check Ownership
            const isOwner = (existingTx.accountOrganizationId && existingTx.accountOrganizationId === activeOrgId) ||
                (existingTx.accountUserId && existingTx.accountUserId === userId);

            if (!isOwner) {
                throw new Error("Forbidden");
            }

            // 3. Revert Balance Changes
            // Need to handle fee reversal as well
            const fee = existingTx.feeAmount ? existingTx.feeAmount : "0";
            const totalDeductionFromSource = `(${existingTx.amount} + ${fee})`;
            const netIncome = `(${existingTx.amount} - ${fee})`;

            if (existingTx.type === "INCOME") {
                // Was Income (Amount - Fee added), so we subtract Net Income from balance
                await tx.update(financeAccount)
                    .set({
                        currentBalance: sql`${financeAccount.currentBalance} - ${sql.raw(netIncome)}`,
                        updatedAt: new Date(),
                    })
                    .where(eq(financeAccount.id, existingTx.accountId));
            } else if (existingTx.type === "EXPENSE") {
                // Was Expense (Amount + Fee subtracted), so we add Total Deduction back to balance
                await tx.update(financeAccount)
                    .set({
                        currentBalance: sql`${financeAccount.currentBalance} + ${sql.raw(totalDeductionFromSource)}`,
                        updatedAt: new Date(),
                    })
                    .where(eq(financeAccount.id, existingTx.accountId));
            } else if (existingTx.type === "TRANSFER") {
                // Was Transfer:
                // 1. Add back to Source (Amount + Fee)
                await tx.update(financeAccount)
                    .set({
                        currentBalance: sql`${financeAccount.currentBalance} + ${sql.raw(totalDeductionFromSource)}`,
                        updatedAt: new Date(),
                    })
                    .where(eq(financeAccount.id, existingTx.accountId));

                // 2. Subtract from Dest (Only Amount)
                if (existingTx.toAccountId) {
                    await tx.update(financeAccount)
                        .set({
                            currentBalance: sql`${financeAccount.currentBalance} - ${existingTx.amount}`,
                            updatedAt: new Date(),
                        })
                        .where(eq(financeAccount.id, existingTx.toAccountId));
                }
            }

            // 4. Delete Record
            await tx.delete(transaction).where(eq(transaction.id, id));
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error deleting transaction:", error);
        return NextResponse.json(
            { error: error.message || "Failed to delete transaction" },
            { status: 500 }
        );
    }
}

const updateTransactionSchema = z.object({
    amount: z.number().or(z.string()).transform(val => val.toString()).optional(),
    feeAmount: z.number().or(z.string()).optional().transform(val => val ? val.toString() : "0"),
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional(),
    date: z.string().transform(str => new Date(str)).optional(),
    description: z.string().optional(),
    accountId: z.string().min(1).optional(),
    toAccountId: z.string().optional(),
    categoryId: z.string().optional(),
    payeeId: z.string().nullable().optional(),
    tagIds: z.array(z.string()).nullable().optional(),
    subscriptionId: z.string().nullable().optional(),
    status: z.enum(["pending", "completed", "failed"]).optional(),
});

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
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
        const body = await req.json();
        const validatedData = updateTransactionSchema.parse(body);

        const result = await db.transaction(async (tx) => {
            // 1. Fetch Existing Transaction
            const [existingTx] = await tx
                .select({
                    id: transaction.id,
                    amount: transaction.amount,
                    feeAmount: transaction.feeAmount,
                    type: transaction.type,
                    accountId: transaction.accountId,
                    toAccountId: transaction.toAccountId,
                    categoryId: transaction.categoryId,
                    description: transaction.description,
                    date: transaction.date,
                    status: transaction.status,
                    payeeId: transaction.payeeId,
                    tagIds: transaction.tagIds,
                    subscriptionId: transaction.subscriptionId,
                    accountOrganizationId: financeAccount.organizationId,
                    accountUserId: financeAccount.userId
                })
                .from(transaction)
                .innerJoin(financeAccount, eq(transaction.accountId, financeAccount.id))
                .where(eq(transaction.id, id))
                .limit(1);

            if (!existingTx) throw new Error("Transaction not found");

            // 2. Verify Ownership
            const isOwner = (existingTx.accountOrganizationId && existingTx.accountOrganizationId === activeOrgId) ||
                (existingTx.accountUserId && existingTx.accountUserId === userId);

            if (!isOwner) throw new Error("Forbidden");

            // 3. New Values (Fallback to existing if not provided)
            const newType = validatedData.type || existingTx.type;
            const newAmount = validatedData.amount ? parseFloat(validatedData.amount) : parseFloat(existingTx.amount);
            const newFee = validatedData.feeAmount ? parseFloat(validatedData.feeAmount) : (existingTx.feeAmount ? parseFloat(existingTx.feeAmount) : 0);
            const newAccountId = validatedData.accountId || existingTx.accountId;
            const newToAccountId = validatedData.toAccountId !== undefined ? validatedData.toAccountId : existingTx.toAccountId;

            // --- STEP A: REVERT OLD EFFECT ---
            const oldFee = existingTx.feeAmount ? parseFloat(existingTx.feeAmount) : 0;
            const oldAmount = parseFloat(existingTx.amount);

            // Revert Source Account Effect
            if (existingTx.type === "INCOME") {
                // Valid Income: Added (Amount - Fee) -> Revert: Subtract (Amount - Fee)
                const netOld = oldAmount - oldFee;
                await tx.update(financeAccount)
                    .set({ currentBalance: sql`${financeAccount.currentBalance} - ${netOld}` })
                    .where(eq(financeAccount.id, existingTx.accountId));
            } else if (existingTx.type === "EXPENSE") {
                // Valid Expense: Subtracted (Amount + Fee) -> Revert: Add (Amount + Fee)
                const totalOld = oldAmount + oldFee;
                await tx.update(financeAccount)
                    .set({ currentBalance: sql`${financeAccount.currentBalance} + ${totalOld}` })
                    .where(eq(financeAccount.id, existingTx.accountId));
            } else if (existingTx.type === "TRANSFER") {
                // Valid Transfer: Source Subtracted (Amount + Fee) -> Revert: Source Add (Amount + Fee)
                const totalOld = oldAmount + oldFee;
                await tx.update(financeAccount)
                    .set({ currentBalance: sql`${financeAccount.currentBalance} + ${totalOld}` })
                    .where(eq(financeAccount.id, existingTx.accountId));

                // Revert Dest Effect: Dest Added (Amount) -> Revert: Dest Subtract (Amount)
                if (existingTx.toAccountId) {
                    await tx.update(financeAccount)
                        .set({ currentBalance: sql`${financeAccount.currentBalance} - ${oldAmount}` })
                        .where(eq(financeAccount.id, existingTx.toAccountId));
                }
            }

            // --- STEP B: CHECK FOR NEW CONDITIONS ---
            // Verify New Source Account Ownership & Fetch Current Balance (after Revert)
            const [sourceAccount] = await tx
                .select()
                .from(financeAccount)
                .where(eq(financeAccount.id, newAccountId))
                .limit(1);

            if (!sourceAccount) throw new Error("New source account not found");
            // Simplified ownership check
            const isNewSourceOwner = (sourceAccount.organizationId && sourceAccount.organizationId === activeOrgId) ||
                (sourceAccount.userId && sourceAccount.userId === userId);
            if (!isNewSourceOwner) throw new Error("Forbidden access to new source account");


            // --- STEP C: APPLY NEW EFFECT ---
            const currentBalance = parseFloat(sourceAccount.currentBalance);
            const totalNewDeduction = newAmount + newFee;
            const netNewIncome = newAmount - newFee;

            if (newType === "EXPENSE" || newType === "TRANSFER") {
                if (currentBalance < totalNewDeduction) {
                    throw new Error("Insufficient balance for updated transaction");
                }
                // Deduct from Source
                await tx.update(financeAccount)
                    .set({ currentBalance: sql`${financeAccount.currentBalance} - ${totalNewDeduction}` })
                    .where(eq(financeAccount.id, newAccountId));

                // Handle Transfer Destination
                if (newType === "TRANSFER") {
                    if (!newToAccountId) throw new Error("Transfer requires destination account");
                    if (newAccountId === newToAccountId) throw new Error("Cannot transfer to same account");

                    // Add to Dest
                    await tx.update(financeAccount)
                        .set({ currentBalance: sql`${financeAccount.currentBalance} + ${newAmount}` })
                        .where(eq(financeAccount.id, newToAccountId));
                }
            } else if (newType === "INCOME") {
                // Add to Source
                await tx.update(financeAccount)
                    .set({ currentBalance: sql`${financeAccount.currentBalance} + ${netNewIncome}` })
                    .where(eq(financeAccount.id, newAccountId));
            }

            // --- STEP D: UPDATE TRANSACTION RECORD ---
            const [updatedTx] = await tx
                .update(transaction)
                .set({
                    amount: newAmount.toString(),
                    feeAmount: newFee.toString(),
                    type: newType as any,
                    date: validatedData.date || existingTx.date,
                    description: validatedData.description !== undefined ? validatedData.description : existingTx.description,
                    accountId: newAccountId,
                    toAccountId: newToAccountId || null,
                    categoryId: validatedData.categoryId !== undefined ? validatedData.categoryId : existingTx.categoryId,
                    status: validatedData.status || existingTx.status,

                    // Added fields
                    payeeId: validatedData.payeeId !== undefined ? validatedData.payeeId : existingTx.payeeId,
                    tagIds: validatedData.tagIds !== undefined ? validatedData.tagIds : existingTx.tagIds,
                    subscriptionId: validatedData.subscriptionId !== undefined ? validatedData.subscriptionId : existingTx.subscriptionId,

                    updatedAt: new Date(),
                })
                .where(eq(transaction.id, id))
                .returning();

            return updatedTx;
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Error updating transaction:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { error: error.message || "Failed to update transaction" },
            { status: 500 }
        );
    }
}
