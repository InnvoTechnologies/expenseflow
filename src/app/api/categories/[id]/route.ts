import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { category } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateCategorySchema = z.object({
    name: z.string().min(1).optional(),
    type: z.enum(["EXPENSE", "INCOME"]).optional(),
    color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color hex code").optional(),
    parentId: z.string().optional().nullable(),
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
        const validatedData = updateCategorySchema.parse(body);

        const existingCategories = await db
            .select()
            .from(category)
            .where(eq(category.id, id))
            .limit(1);

        if (existingCategories.length === 0) {
            return NextResponse.json({ error: "Category not found" }, { status: 404 });
        }

        const cat = existingCategories[0];
        const isOwner = (cat.organizationId && cat.organizationId === activeOrgId) ||
            (cat.userId && cat.userId === userId);

        if (!isOwner) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const [updatedCategory] = await db
            .update(category)
            .set({
                ...validatedData,
                type: validatedData.type as any,
                parentId: validatedData.parentId === undefined ? undefined : validatedData.parentId,
            })
            .where(eq(category.id, id))
            .returning();

        return NextResponse.json(updatedCategory);
    } catch (error) {
        console.error("Error updating category:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { error: "Failed to update category" },
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
        const existingCategories = await db
            .select()
            .from(category)
            .where(eq(category.id, id))
            .limit(1);

        if (existingCategories.length === 0) {
            return NextResponse.json({ error: "Category not found" }, { status: 404 });
        }

        const cat = existingCategories[0];
        const isOwner = (cat.organizationId && cat.organizationId === activeOrgId) ||
            (cat.userId && cat.userId === userId);

        if (!isOwner) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await db.delete(category).where(eq(category.id, id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting category:", error);
        return NextResponse.json(
            { error: "Failed to delete category" },
            { status: 500 }
        );
    }
}
