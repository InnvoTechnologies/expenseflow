import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { category } from "@/db/schema";
import { z } from "zod";

const bulkCreateCategorySchema = z.object({
    categories: z.array(z.object({
        name: z.string().min(1),
        type: z.enum(["EXPENSE", "INCOME"]),
        color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color hex code"),
        parentId: z.string().optional().nullable(),
    }))
});

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
        const validatedData = bulkCreateCategorySchema.parse(body);

        // Prepare all categories for insertion
        const categoriesToInsert = validatedData.categories.map(cat => ({
            name: cat.name,
            type: cat.type as any,
            color: cat.color,
            parentId: cat.parentId || null,
            userId: activeOrgId ? null : userId,
            organizationId: activeOrgId ? activeOrgId : null,
        }));

        // Insert all categories in a single transaction
        const createdCategories = await db
            .insert(category)
            .values(categoriesToInsert)
            .returning();

        return NextResponse.json({
            success: true,
            count: createdCategories.length,
            categories: createdCategories
        });
    } catch (error) {
        console.error("Error bulk creating categories:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { error: "Failed to create categories" },
            { status: 500 }
        );
    }
}
