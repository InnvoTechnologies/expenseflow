import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { subscriptionTracking } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

const createSubscriptionSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    startDate: z.string().transform(str => new Date(str)),
    billingCycle: z.enum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]),
    amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Amount must be greater than 0"),
    currency: z.string().default("USD"),
    categoryId: z.string().uuid().optional().nullable(),
    accountId: z.string().uuid().optional().nullable(),
    notifyDaysBefore: z.number().min(0).optional().nullable(),
    reminderEnabled: z.boolean().default(true),
    status: z.enum(["ACTIVE", "CANCELLED", "PAUSED", "EXPIRED"]).default("ACTIVE"),
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
            whereClause = eq(subscriptionTracking.organizationId, activeOrgId);
        } else {
            whereClause = eq(subscriptionTracking.userId, userId);
        }

        const subscriptions = await db
            .select()
            .from(subscriptionTracking)
            .where(whereClause)
            .orderBy(desc(subscriptionTracking.createdAt));

        return NextResponse.json(subscriptions);
    } catch (error) {
        console.error("Error fetching subscriptions:", error);
        return NextResponse.json(
            { error: "Failed to fetch subscriptions" },
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
        const validatedData = createSubscriptionSchema.parse(body);

        const [newSubscription] = await db
            .insert(subscriptionTracking)
            .values({
                title: validatedData.title,
                description: validatedData.description || null,
                startDate: validatedData.startDate,
                billingCycle: validatedData.billingCycle,
                amount: validatedData.amount,
                currency: validatedData.currency,
                categoryId: validatedData.categoryId || null,
                accountId: validatedData.accountId || null,
                notifyDaysBefore: validatedData.notifyDaysBefore || null,
                reminderEnabled: validatedData.reminderEnabled,
                status: validatedData.status,
                userId: activeOrgId ? null : userId,
                organizationId: activeOrgId || null,
            })
            .returning();

        return NextResponse.json(newSubscription);
    } catch (error) {
        console.error("Error creating subscription:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { error: "Failed to create subscription" },
            { status: 500 }
        );
    }
}

