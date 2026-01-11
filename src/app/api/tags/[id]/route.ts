import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { tag } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updateTagSchema = z.object({
    name: z.string().min(1, "Name is required").optional(),
    color: z.string().optional(),
});

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
        let whereClause;
        if (activeOrgId) {
            whereClause = and(eq(tag.id, id), eq(tag.organizationId, activeOrgId));
        } else {
            whereClause = and(eq(tag.id, id), eq(tag.userId, userId));
        }

        const [deletedTag] = await db
            .delete(tag)
            .where(whereClause)
            .returning();

        if (!deletedTag) {
            return NextResponse.json({ error: "Tag not found or unauthorized" }, { status: 404 });
        }

        return NextResponse.json(deletedTag);
    } catch (error) {
        console.error("Error deleting tag:", error);
        return NextResponse.json(
            { error: "Failed to delete tag" },
            { status: 500 }
        );
    }
}

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
        const validatedData = updateTagSchema.parse(body);

        let whereClause;
        if (activeOrgId) {
            whereClause = and(eq(tag.id, id), eq(tag.organizationId, activeOrgId));
        } else {
            whereClause = and(eq(tag.id, id), eq(tag.userId, userId));
        }

        const [updatedTag] = await db
            .update(tag)
            .set({
                ...validatedData,
                updatedAt: new Date(),
            })
            .where(whereClause)
            .returning();

        if (!updatedTag) {
            return NextResponse.json({ error: "Tag not found or unauthorized" }, { status: 404 });
        }

        return NextResponse.json(updatedTag);
    } catch (error: any) {
        console.error("Error updating tag:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { error: error.message || "Failed to update tag" },
            { status: 400 }
        );
    }
}
