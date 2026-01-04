import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { financeAccount, financeAccountTypeEnum } from "@/db/schema";
import { eq, or, and, desc } from "drizzle-orm";
import { z } from "zod";

const createAccountSchema = z.object({
    name: z.string().min(1),
    type: z.enum(["BANK", "CASH", "MOBILE_WALLET", "CREDIT_CARD"]),
    currency: z.string().default("USD"),
    currentBalance: z.number().or(z.string()).transform(val => val.toString()),
    isDefault: z.boolean().optional(),
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
        let whereClause;

        if (activeOrgId) {
            whereClause = eq(financeAccount.organizationId, activeOrgId);
        } else {
            whereClause = eq(financeAccount.userId, userId);
        }

        const accounts = await db
            .select()
            .from(financeAccount)
            .where(whereClause)
            .orderBy(desc(financeAccount.createdAt));

        return NextResponse.json(accounts);
    } catch (error) {
        console.error("Error fetching accounts:", error);
        return NextResponse.json(
            { error: "Failed to fetch accounts" },
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

    try {
        const body = await req.json();
        const validatedData = createAccountSchema.parse(body);

        const [newAccount] = await db
            .insert(financeAccount)
            .values({
                name: validatedData.name,
                type: validatedData.type as any, // Cast to any to satisfy Drizzle enum type check if needed, or precise type
                currency: validatedData.currency,
                currentBalance: validatedData.currentBalance,
                userId: activeOrgId ? null : userId,
                organizationId: activeOrgId ? activeOrgId : null,
                isDefault: validatedData.isDefault || false,
            })
            .returning();

        return NextResponse.json(newAccount);
    } catch (error) {
        console.error("Error creating account:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { error: "Failed to create account" },
            { status: 500 }
        );
    }
}
