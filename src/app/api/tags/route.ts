import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { tag } from "@/db/schema";
import { eq, desc, and, or } from "drizzle-orm";
import { z } from "zod";

const createTagSchema = z.object({
    name: z.string().min(1, "Name is required"),
    color: z.string().default("#000000"),
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
            whereClause = eq(tag.organizationId, activeOrgId);
        } else {
            whereClause = eq(tag.userId, userId);
        }

        const tags = await db
            .select()
            .from(tag)
            .where(whereClause)
            .orderBy(desc(tag.createdAt));

        return NextResponse.json(tags);
    } catch (error) {
        console.error("Error fetching tags:", error);
        return NextResponse.json(
            { error: "Failed to fetch tags" },
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
        const validatedData = createTagSchema.parse(body);

        const [newTag] = await db
            .insert(tag)
            .values({
                name: validatedData.name,
                color: validatedData.color,
                userId: activeOrgId ? null : userId,
                organizationId: activeOrgId ? activeOrgId : null,
            })
            .returning();

        return NextResponse.json(newTag);
    } catch (error: any) {
        console.error("Error creating tag:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { error: error.message || "Failed to create tag" },
            { status: 400 }
        );
    }
}
