import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { category, categoryTypeEnum } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

const createCategorySchema = z.object({
    name: z.string().min(1),
    type: z.enum(["EXPENSE", "INCOME"]),
    color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color hex code").default("#9CA3AF"),
    parentId: z.string().optional(),
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
            whereClause = eq(category.organizationId, activeOrgId);
        } else {
            whereClause = eq(category.userId, userId);
        }

        const categories = await db
            .select()
            .from(category)
            .where(whereClause)
            .orderBy(desc(category.createdAt));

        return NextResponse.json(categories);
    } catch (error) {
        console.error("Error fetching categories:", error);
        return NextResponse.json(
            { error: "Failed to fetch categories" },
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
        const validatedData = createCategorySchema.parse(body);

        const [newCategory] = await db
            .insert(category)
            .values({
                name: validatedData.name,
                type: validatedData.type as any,
                color: validatedData.color,
                parentId: validatedData.parentId || null,
                userId: activeOrgId ? null : userId,
                organizationId: activeOrgId ? activeOrgId : null,
            })
            .returning();

        return NextResponse.json(newCategory);
    } catch (error) {
        console.error("Error creating category:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { error: "Failed to create category" },
            { status: 500 }
        );
    }
}
