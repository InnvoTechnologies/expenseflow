import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { organization, member } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// POST: Delete organization
export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookieHeader }),
    });

    if (!session || !session.user?.id) {
      return NextResponse.json({
        status: 401,
        message: "Unauthorized: You must be logged in to delete organization",
      }, { status: 401 });
    }

    const body = await req.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json({
        status: 400,
        message: "Organization ID is required",
      }, { status: 400 });
    }

    // Verify user is the owner of the organization
    const membership = await db
      .select({ role: member.role })
      .from(member)
      .where(
        and(
          eq(member.userId, session.user.id),
          eq(member.organizationId, organizationId)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json({
        status: 403,
        message: "You are not a member of this organization",
      }, { status: 403 });
    }

    // Only owners can delete organizations
    if (membership[0].role !== 'owner') {
      return NextResponse.json({
        status: 403,
        message: "Only organization owners can delete organizations",
      }, { status: 403 });
    }

    // Delete the organization (this will cascade to members and other related data)
    await db
      .delete(organization)
      .where(eq(organization.id, organizationId));

    return NextResponse.json({
      status: 200,
      data: { deleted: true },
      message: "Organization deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete organization:", error);
    return NextResponse.json({
      status: 500,
      message: "Internal server error",
    }, { status: 500 });
  }
}
