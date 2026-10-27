import { mutate, requestScope } from "@/lib/chat/rest";
import { ChatError, failure } from "@/lib/chat/core";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { tag } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

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
        await requestScope(req, session.user.id);
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
        if (error instanceof ChatError) return failure(error);
        console.error("Error fetching tags:", error);
        return NextResponse.json(
            { error: "Failed to fetch tags" },
            { status: 500 }
        );
    }
}


export async function POST(req: NextRequest) {
    // Authentication, workspace checks, validation and creation are shared with copilot tools.
    return mutate(req, "create_tag");
}
