import { atomic, body, endpoint } from "@/lib/chat/core";
import { executeOperation } from "@/lib/chat/finance";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { organization, member } from "@/db/schema";
import { eq, and } from "drizzle-orm";

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
      .where(and(eq(member.userId, session.user.id), eq(member.status, "active")))
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

export async function POST(req: NextRequest) {
  return endpoint(req, async userId => {
    const input = await body(req);
    const args = { ...input };
    delete args.keepCurrentActiveOrganization;
    const result = await atomic(async c => executeOperation(c, {userId, organizationId:null}, {toolName:'create_workspace',toolCallId:crypto.randomUUID(),arguments:args}));
    return Response.json({ status:201, data:result.resource, message:'Organization created successfully' }, {status:201});
  });
}
