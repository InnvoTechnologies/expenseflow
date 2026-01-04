import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { session } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";

// POST: Revoke all other sessions (except current)
export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const sessionData = await auth.api.getSession({
      headers: new Headers({ cookie: cookieHeader }),
    });

    if (!sessionData || !sessionData.user?.id) {
      return NextResponse.json({
        status: 401,
        message: "Unauthorized: You must be logged in to revoke sessions",
      }, { status: 401 });
    }

    const currentSessionId = sessionData.session?.id;

    if (!currentSessionId) {
      return NextResponse.json({
        status: 400,
        message: "Current session not found",
      }, { status: 400 });
    }

    // Delete all sessions except the current one
    const result = await db
      .delete(session)
      .where(
        and(
          eq(session.userId, sessionData.user.id),
          ne(session.id, currentSessionId)
        )
      );

    return NextResponse.json({
      status: 200,
      message: "All other sessions revoked successfully",
      data: {
        revokedCount: result.rowCount || 0,
      },
    });
  } catch (error) {
    console.error("Failed to revoke all other sessions:", error);
    return NextResponse.json({
      status: 500,
      message: "Internal server error",
    });
  }
}
