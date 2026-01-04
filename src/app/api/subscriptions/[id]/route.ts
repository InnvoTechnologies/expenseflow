import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { subscriptionTracking } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updateSubscriptionSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    startDate: z.string().transform(str => new Date(str)).optional(),
    billingCycle: z.enum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]).optional(),
    amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0).optional(),
    currency: z.string().optional(),
    categoryId: z.string().uuid().optional().nullable(),
    accountId: z.string().uuid().optional().nullable(),
    notifyDaysBefore: z.number().min(0).optional().nullable(),
    reminderEnabled: z.boolean().optional(),
    status: z.enum(["ACTIVE", "CANCELLED", "PAUSED", "EXPIRED"]).optional(),
    endDate: z.string().transform(str => new Date(str)).optional().nullable(),
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
        const validatedData = updateSubscriptionSchema.parse(body);

        // Verify ownership
        let ownershipClause;
        if (activeOrgId) {
            ownershipClause = eq(subscriptionTracking.organizationId, activeOrgId);
        } else {
            ownershipClause = eq(subscriptionTracking.userId, userId);
        }

        const [existingSubscription] = await db
            .select()
            .from(subscriptionTracking)
            .where(and(eq(subscriptionTracking.id, id), ownershipClause))
            .limit(1);

        if (!existingSubscription) {
            return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
        }

        const updateData: any = {
            ...validatedData,
            updatedAt: new Date(),
        };

        // Handle optional fields
        if (validatedData.amount) {
            updateData.amount = validatedData.amount;
        }
        if (validatedData.startDate !== undefined) {
            updateData.startDate = validatedData.startDate;
        }
        if (validatedData.endDate !== undefined) {
            updateData.endDate = validatedData.endDate;
        }

        const [updatedSubscription] = await db
            .update(subscriptionTracking)
            .set(updateData)
            .where(eq(subscriptionTracking.id, id))
            .returning();

        return NextResponse.json(updatedSubscription);
    } catch (error) {
        console.error("Error updating subscription:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { error: "Failed to update subscription" },
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
        // Verify ownership
        let ownershipClause;
        if (activeOrgId) {
            ownershipClause = eq(subscriptionTracking.organizationId, activeOrgId);
        } else {
            ownershipClause = eq(subscriptionTracking.userId, userId);
        }

        const [existingSubscription] = await db
            .select()
            .from(subscriptionTracking)
            .where(and(eq(subscriptionTracking.id, id), ownershipClause))
            .limit(1);

        if (!existingSubscription) {
            return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
        }

        await db.delete(subscriptionTracking).where(eq(subscriptionTracking.id, id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting subscription:", error);
        return NextResponse.json(
            { error: "Failed to delete subscription" },
            { status: 500 }
        );
    }
}

