import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { financeAccount } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateAccountSchema = z.object({
    name: z.string().min(1).optional(),
    type: z.enum(["BANK", "CASH", "MOBILE_WALLET", "CREDIT_CARD"]).optional(),
    currency: z.string().optional(),
    currentBalance: z.number().or(z.string()).transform(val => val.toString()).optional(),
    isDefault: z.boolean().optional(),
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
        const validatedData = updateAccountSchema.parse(body);

        // Check existence and ownership
        const existingAccounts = await db
            .select()
            .from(financeAccount)
            .where(eq(financeAccount.id, id))
            .limit(1);

        if (existingAccounts.length === 0) {
            return NextResponse.json({ error: "Account not found" }, { status: 404 });
        }

        const account = existingAccounts[0];

        // Ownership check
        const isOwner = (account.organizationId && account.organizationId === activeOrgId) ||
            (account.userId && account.userId === userId);

        if (!isOwner) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const [updatedAccount] = await db
            .update(financeAccount)
            .set({
                ...validatedData,
                type: validatedData.type as any, // Cast for enum
                updatedAt: new Date(),
            })
            .where(eq(financeAccount.id, id))
            .returning();

        return NextResponse.json(updatedAccount);
    } catch (error) {
        console.error("Error updating account:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { error: "Failed to update account" },
            { status: 500 }
        );
    }
}

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
        // Check existence and ownership
        const existingAccounts = await db
            .select()
            .from(financeAccount)
            .where(eq(financeAccount.id, id))
            .limit(1);

        if (existingAccounts.length === 0) {
            return NextResponse.json({ error: "Account not found" }, { status: 404 });
        }

        const account = existingAccounts[0];

        // Ownership check
        const isOwner = (account.organizationId && account.organizationId === activeOrgId) ||
            (account.userId && account.userId === userId);

        if (!isOwner) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await db.delete(financeAccount).where(eq(financeAccount.id, id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting account:", error);
        return NextResponse.json(
            { error: "Failed to delete account" },
            { status: 500 }
        );
    }
}
