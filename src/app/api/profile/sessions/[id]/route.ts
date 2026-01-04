import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { session } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// DELETE: Revoke a specific session
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Verify the session belongs to the user and is not the current session
    const sessionRecord = await db
      .select({ id: session.id, userId: session.userId })
      .from(session)
      .where(
        and(
          eq(session.id, id),
          eq(session.userId, sessionData.user.id)
        )
      )
      .limit(1);

    if (sessionRecord.length === 0) {
      return NextResponse.json({
        status: 404,
        message: "Session not found",
      }, { status: 404 });
    }

    // Prevent revoking the current session
    if (id === sessionData.session?.id) {
      return NextResponse.json({
        status: 400,
        message: "Cannot revoke your current session",
      }, { status: 400 });
    }

    // Delete the session
    await db
      .delete(session)
      .where(
        and(
          eq(session.id, id),
          eq(session.userId, sessionData.user.id)
        )
      );

    return NextResponse.json({
      status: 200,
      message: "Session revoked successfully",
    });
  } catch (error) {
    console.error("Failed to revoke session:", error);
    return NextResponse.json({
      status: 500,
      message: "Internal server error",
    });
  }
}
