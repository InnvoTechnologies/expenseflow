import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { organization, member } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { randomUUID } from "crypto";

// GET: List user's organizations
export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookieHeader }),
    });

    if (!session || !session.user?.id) {
      return NextResponse.json({
        status: 401,
        message: "Unauthorized: You must be logged in to access organizations",
      }, { status: 401 });
    }

    // Get organizations where user is a member
    const userOrganizations = await db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        metadata: organization.metadata,
        createdAt: organization.createdAt,
        role: member.role,
      })
      .from(organization)
      .innerJoin(member, eq(organization.id, member.organizationId))
      .where(eq(member.userId, session.user.id))
      .orderBy(organization.createdAt);

    return NextResponse.json({
      status: 200,
      data: userOrganizations,
      message: "Organizations retrieved successfully",
    });
  } catch (error) {
    console.error("Failed to fetch organizations:", error);
    return NextResponse.json({
      status: 500,
      message: "Internal server error",
    }, { status: 500 });
  }
}

// POST: Create new organization
export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookieHeader }),
    });

    if (!session || !session.user?.id) {
      return NextResponse.json({
        status: 401,
        message: "Unauthorized: You must be logged in to create organizations",
      }, { status: 401 });
    }

    const body = await req.json();
    const { name, slug, keepCurrentActiveOrganization = false } = body;

    if (!name || !slug) {
      return NextResponse.json({
        status: 400,
        message: "Name and slug are required",
      }, { status: 400 });
    }

    // Check if slug is already taken
    const existingOrg = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, slug.trim().toLowerCase()))
      .limit(1);

    if (existingOrg.length > 0) {
      return NextResponse.json({
        status: 400,
        message: "Organization slug already exists",
      }, { status: 400 });
    }

    // Create organization with explicit UUID
    // const orgId = randomUUID();
    // console.log("🚀 ~ POST ~ orgId:", orgId);
    const [newOrg] = await db
      .insert(organization)
      .values({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        createdAt: new Date(),
        userId: session.user.id,
      })
      .returning();

    // Add user as owner
    await db.insert(member).values({
      userId: session.user.id,
      organizationId: newOrg.id,
      role: "owner",
      createdAt: new Date(),
    });

    return NextResponse.json({
      status: 201,
      data: newOrg,
      message: "Organization created successfully",
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to create organization:", error);
    return NextResponse.json({
      status: 500,
      message: "Internal server error",
    }, { status: 500 });
  }
}
