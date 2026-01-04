import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { reminder } from "@/db/schema";
import { eq, desc, and, or } from "drizzle-orm";
import { z } from "zod";

const createReminderSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    dueDate: z.string().transform(str => new Date(str)),
    status: z.enum(["PENDING", "COMPLETED", "SKIPPED"]).default("PENDING"),
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
            whereClause = eq(reminder.organizationId, activeOrgId);
        } else {
            whereClause = eq(reminder.userId, userId);
        }

        const reminders = await db
            .select()
            .from(reminder)
            .where(whereClause)
            .orderBy(desc(reminder.dueDate));

        return NextResponse.json(reminders);
    } catch (error) {
        console.error("Error fetching reminders:", error);
        return NextResponse.json(
            { error: "Failed to fetch reminders" },
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
        const validatedData = createReminderSchema.parse(body);

        const [newReminder] = await db
            .insert(reminder)
            .values({
                title: validatedData.title,
                description: validatedData.description || null,
                dueDate: validatedData.dueDate,
                status: validatedData.status,
                userId: activeOrgId ? null : userId,
                organizationId: activeOrgId ? activeOrgId : null,
            })
            .returning();

        return NextResponse.json(newReminder);
    } catch (error) {
        console.error("Error creating reminder:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { error: "Failed to create reminder" },
            { status: 500 }
        );
    }
}
