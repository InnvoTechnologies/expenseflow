import { mutate, requestScope } from "@/lib/chat/rest";
import { ChatError, failure } from "@/lib/chat/core";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { payee } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

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
            whereClause = eq(payee.organizationId, activeOrgId);
        } else {
            whereClause = eq(payee.userId, userId);
        }

        const payees = await db
            .select()
            .from(payee)
            .where(whereClause)
            .orderBy(asc(payee.name));

        return NextResponse.json(payees);
    } catch (error) {
        if (error instanceof ChatError) return failure(error);
        console.error("Error fetching payees:", error);
        return NextResponse.json(
            { error: "Failed to fetch payees" },
            { status: 500 }
        );
    }
}


export async function POST(req: NextRequest) {
    // Authentication, workspace checks, validation and creation are shared with copilot tools.
    return mutate(req, "create_payee");
}
