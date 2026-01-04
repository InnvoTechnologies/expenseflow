import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { payee } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

const createPayeeSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string().optional(),
    address: z.string().optional(),
    description: z.string().optional(),
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
            whereClause = eq(payee.organizationId, activeOrgId);
        } else {
            whereClause = eq(payee.userId, userId);
        }

        const payees = await db
            .select()
            .from(payee)
            .where(whereClause)
            .orderBy(desc(payee.createdAt));

        return NextResponse.json(payees);
    } catch (error) {
        console.error("Error fetching payees:", error);
        return NextResponse.json(
            { error: "Failed to fetch payees" },
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
        const validatedData = createPayeeSchema.parse(body);

        const [newPayee] = await db
            .insert(payee)
            .values({
                name: validatedData.name,
                email: validatedData.email || null,
                phone: validatedData.phone || null,
                address: validatedData.address || null,
                description: validatedData.description || null,
                userId: activeOrgId ? null : userId,
                organizationId: activeOrgId || null,
            })
            .returning();

        return NextResponse.json(newPayee);
    } catch (error: any) {
        console.error("Error creating payee:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 });
        }
        return NextResponse.json(
            { error: "Failed to create payee" },
            { status: 400 }
        );
    }
}
