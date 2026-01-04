import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { organization } from "@/db/schema";
import { eq } from "drizzle-orm";

// POST: Check if organization slug is available
export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookieHeader }),
    });

    if (!session || !session.user?.id) {
      return NextResponse.json({
        status: 401,
        message: "Unauthorized: You must be logged in to check slug availability",
      }, { status: 401 });
    }

    const body = await req.json();
    const { slug } = body;

    if (!slug) {
      return NextResponse.json({
        status: 400,
        message: "Slug is required",
      }, { status: 400 });
    }

    // Check if slug is already taken
    const existingOrg = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, slug.trim().toLowerCase()))
      .limit(1);

    const isAvailable = existingOrg.length === 0;

    return NextResponse.json({
      status: 200,
      data: {
        slug: slug.trim().toLowerCase(),
        available: isAvailable,
      },
      message: isAvailable ? "Slug is available" : "Slug is already taken",
    });
  } catch (error) {
    console.error("Failed to check slug availability:", error);
    return NextResponse.json({
      status: 500,
      message: "Internal server error",
    }, { status: 500 });
  }
}
