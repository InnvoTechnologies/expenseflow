import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { organization, member } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { headers } from "next/headers";

// POST: Update organization
export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookieHeader }),
    });

    if (!session || !session.user?.id) {
      return NextResponse.json({
        status: 401,
        message: "Unauthorized: You must be logged in to update organization",
      }, { status: 401 });
    }

    const body = await req.json();
    const { data, organizationId } = body;

    if (!data || typeof data !== 'object') {
      return NextResponse.json({
        status: 400,
        message: "Update data is required",
      }, { status: 400 });
    }

    // Determine which organization to update
    let targetOrgId = organizationId;
    
    // If no organizationId provided, use the active organization from session
    if (!targetOrgId) {
      const headersList = await headers();
      targetOrgId = headersList.get("X-Organization-Id");
    }

    if (!targetOrgId) {
      return NextResponse.json({
        status: 400,
        message: "Organization ID is required",
      }, { status: 400 });
    }

    // Verify user has permission to update the organization (owner or admin)
    const membership = await db
      .select({ role: member.role })
      .from(member)
      .where(
        and(
          eq(member.userId, session.user.id),
          eq(member.organizationId, targetOrgId)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json({
        status: 403,
        message: "You are not a member of this organization",
      }, { status: 403 });
    }

    // Only owners can update organization details
    if (membership[0].role !== 'owner') {
      return NextResponse.json({
        status: 403,
        message: "Only organization owners can update organization details",
      }, { status: 403 });
    }

    // Prepare update data
    const updateData: any = {};
    if (data.name) updateData.name = data.name.trim();
    if (data.slug) updateData.slug = data.slug.trim().toLowerCase();
    if (data.logo !== undefined) updateData.logo = data.logo;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    // If slug is being updated, check if it's already taken by another organization
    if (data.slug) {
      const existingOrg = await db
        .select({ id: organization.id })
        .from(organization)
        .where(
          and(
            eq(organization.slug, data.slug.trim().toLowerCase()),
            sql`${organization.id} != ${targetOrgId}`
          )
        )
        .limit(1);

      if (existingOrg.length > 0) {
        return NextResponse.json({
          status: 400,
          message: "Organization slug already exists",
        }, { status: 400 });
      }
    }

    // Update the organization
    const [updatedOrg] = await db
      .update(organization)
      .set(updateData)
      .where(eq(organization.id, targetOrgId))
      .returning();

    return NextResponse.json({
      status: 200,
      data: updatedOrg,
      message: "Organization updated successfully",
    });
  } catch (error) {
    console.error("Failed to update organization:", error);
    return NextResponse.json({
      status: 500,
      message: "Internal server error",
    }, { status: 500 });
  }
}
