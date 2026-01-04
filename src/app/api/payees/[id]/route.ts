import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { payee } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updatePayeeSchema = z.object({
    name: z.string().min(1, "Name is required").optional(),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string().optional(),
    address: z.string().optional(),
    description: z.string().optional(),
});

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const headersList = await headers();
    const activeOrgId = headersList.get("X-Organization-Id");
    const userId = session.user.id;

    try {
        const body = await req.json();
        const validatedData = updatePayeeSchema.parse(body);

        // Verify ownership
        let ownershipClause;
        if (activeOrgId) {
            ownershipClause = eq(payee.organizationId, activeOrgId);
        } else {
            ownershipClause = eq(payee.userId, userId);
        }

        const [existingPayee] = await db
            .select()
            .from(payee)
            .where(and(eq(payee.id, id), ownershipClause))
            .limit(1);

        if (!existingPayee) {
            return NextResponse.json({ error: "Payee not found" }, { status: 404 });
        }

        const [updatedPayee] = await db
            .update(payee)
            .set({
                ...validatedData,
                email: validatedData.email || null,
                updatedAt: new Date(),
            })
            .where(eq(payee.id, id))
            .returning();

        return NextResponse.json(updatedPayee);
    } catch (error: any) {
        console.error("Error updating payee:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { error: "Failed to update payee" },
            { status: 400 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const headersList = await headers();
    const activeOrgId = headersList.get("X-Organization-Id");
    const userId = session.user.id;

    try {
        // Verify ownership
        let ownershipClause;
        if (activeOrgId) {
            ownershipClause = eq(payee.organizationId, activeOrgId);
        } else {
            ownershipClause = eq(payee.userId, userId);
        }

        const [existingPayee] = await db
            .select()
            .from(payee)
            .where(and(eq(payee.id, id), ownershipClause))
            .limit(1);

        if (!existingPayee) {
            return NextResponse.json({ error: "Payee not found" }, { status: 404 });
        }

        await db.delete(payee).where(eq(payee.id, id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting payee:", error);
        return NextResponse.json(
            { error: "Failed to delete payee" },
            { status: 500 }
        );
    }
}
