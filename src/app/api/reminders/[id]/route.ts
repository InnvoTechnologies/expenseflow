import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { reminder } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updateReminderSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    dueDate: z.string().transform(str => new Date(str)).optional(),
    status: z.enum(["PENDING", "COMPLETED", "SKIPPED"]).optional(),
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

    const headersList = await headers();
    const activeOrgId = headersList.get("X-Organization-Id");
    const userId = session.user.id;
    const { id: reminderId } = await params;

    try {
        // Verify ownership
        const [existingReminder] = await db
            .select()
            .from(reminder)
            .where(eq(reminder.id, reminderId))
            .limit(1);

        if (!existingReminder) {
            return NextResponse.json(
                { error: "Reminder not found" },
                { status: 404 }
            );
        }

        const isOwner =
            (existingReminder.organizationId && existingReminder.organizationId === activeOrgId) ||
            (existingReminder.userId && existingReminder.userId === userId);

        if (!isOwner) {
            return NextResponse.json(
                { error: "Forbidden" },
                { status: 403 }
            );
        }

        const body = await req.json();
        const validatedData = updateReminderSchema.parse(body);

        const [updatedReminder] = await db
            .update(reminder)
            .set({
                ...validatedData,
                updatedAt: new Date(),
            })
            .where(eq(reminder.id, reminderId))
            .returning();

        return NextResponse.json(updatedReminder);
    } catch (error) {
        console.error("Error updating reminder:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { error: "Failed to update reminder" },
            { status: 500 }
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

    const headersList = await headers();
    const activeOrgId = headersList.get("X-Organization-Id");
    const userId = session.user.id;
    const { id: reminderId } = await params;

    try {
        // Verify ownership
        const [existingReminder] = await db
            .select()
            .from(reminder)
            .where(eq(reminder.id, reminderId))
            .limit(1);

        if (!existingReminder) {
            return NextResponse.json(
                { error: "Reminder not found" },
                { status: 404 }
            );
        }

        const isOwner =
            (existingReminder.organizationId && existingReminder.organizationId === activeOrgId) ||
            (existingReminder.userId && existingReminder.userId === userId);

        if (!isOwner) {
            return NextResponse.json(
                { error: "Forbidden" },
                { status: 403 }
            );
        }

        await db
            .delete(reminder)
            .where(eq(reminder.id, reminderId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting reminder:", error);
        return NextResponse.json(
            { error: "Failed to delete reminder" },
            { status: 500 }
        );
    }
}
