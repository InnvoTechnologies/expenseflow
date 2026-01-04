import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { session } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

// GET: Fetch user sessions
export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const sessionData = await auth.api.getSession({
      headers: new Headers({ cookie: cookieHeader }),
    });

    if (!sessionData || !sessionData.user?.id) {
      return NextResponse.json({
        status: 401,
        message: "Unauthorized: You must be logged in to view sessions",
      }, { status: 401 });
    }

    // Get all sessions for the user
    const userSessions = await db
      .select({
        id: session.id,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        expiresAt: session.expiresAt,
      })
      .from(session)
      .where(eq(session.userId, sessionData.user.id))
      .orderBy(desc(session.updatedAt));

    // Process sessions to add device and browser information
    const processedSessions = userSessions.map((sessionRecord) => {
      const userAgent = sessionRecord.userAgent || "";
      const isCurrent = sessionRecord.id === sessionData.session?.id;
      
      // Parse user agent to get device and browser info
      let deviceType = "unknown";
      let browser = "Unknown";
      let os = "Unknown";

      if (userAgent.includes("Mobile")) {
        deviceType = "mobile";
      } else if (userAgent.includes("Windows") || userAgent.includes("Mac") || userAgent.includes("Linux")) {
        deviceType = "desktop";
      }

      if (userAgent.includes("Chrome")) {
        browser = "Chrome";
      } else if (userAgent.includes("Firefox")) {
        browser = "Firefox";
      } else if (userAgent.includes("Safari")) {
        browser = "Safari";
      } else if (userAgent.includes("Edge")) {
        browser = "Edge";
      }

      if (userAgent.includes("Windows")) {
        os = "Windows";
      } else if (userAgent.includes("Mac")) {
        os = "macOS";
      } else if (userAgent.includes("Linux")) {
        os = "Linux";
      } else if (userAgent.includes("Android")) {
        os = "Android";
      } else if (userAgent.includes("iOS")) {
        os = "iOS";
      }

      return {
        ...sessionRecord,
        deviceType,
        browser,
        os,
        isCurrent,
        lastActive: sessionRecord.updatedAt,
        ipAddress: sessionRecord.ipAddress || "Unknown",
      };
    });

    return NextResponse.json({
      status: 200,
      data: processedSessions,
      message: "Sessions fetched successfully",
    });
  } catch (error) {
    console.error("Failed to fetch sessions:", error);
    return NextResponse.json({
      status: 500,
      message: "Internal server error",
    });
  }
}
