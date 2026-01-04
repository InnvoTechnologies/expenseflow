import { NextRequest, NextResponse } from "next/server";
import { auth } from "./auth";

export async function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Public routes that don't require authentication
  const publicRoutes = [
    "/auth/login",
    "/auth/register", 
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/verify-email",
    "/api/auth",
  ];
  
  // Special case: root route is handled client-side with auth check
  const isRootRoute = pathname === "/";
  
  // Special case: OAuth callback routes should be allowed
  const isOAuthCallbackRoute = pathname.includes('/api/auth/callback/') || 
                               pathname.includes('/auth/callback/') ||
                               pathname.includes('/api/auth');
  
  // Check if the current route is public
  const isPublicRoute = 
    isOAuthCallbackRoute || 
    publicRoutes.some(route => pathname === route || 
                     (route !== "/" && pathname.startsWith(route)));
  
  // All routes are protected by default except for:
  // 1. Public routes explicitly listed above
  // 2. Static assets and API routes handled separately
  // 3. The root route which is handled client-side
  // 4. OAuth callback routes
  const isProtectedRoute = !isPublicRoute && !isRootRoute;
  
  // Static assets, public APIs, and Next.js internals should pass through without auth checks
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth/") ||
    pathname.includes("favicon.ico") ||
    pathname.match(/\.(jpg|jpeg|png|gif|svg|ico|css|js)$/) ||
    pathname.startsWith("/public/") ||
    pathname === "/api/webhooks" ||  // Add any public API endpoints here
    pathname.match(/^\/sitemap.*\.xml$/) ||  // SEO-related files
    pathname === "/robots.txt"
  ) {
    return NextResponse.next();
  }
  
  try {
    // Get session from the request with strict validation
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    // Debug logging
    console.log(`[Auth Middleware] Path: ${pathname}, Protected: ${isProtectedRoute}, Public: ${isPublicRoute}, Root: ${isRootRoute}, Session: ${!!session}`);
    
    // Root route is handled by client-side component
    if (isRootRoute) {
      return NextResponse.next();
    }
    
    // PROTECTED ROUTE ACCESS: If no session and trying to access protected route
    if (!session && isProtectedRoute) {
      console.log(`[Auth Middleware] Redirecting unauthenticated user from ${pathname} to login`);
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("callbackUrl", encodeURIComponent(pathname));
      return NextResponse.redirect(loginUrl);
    }
    
    // AUTH PAGES PROTECTION: If authenticated user tries to access auth pages (except logout)
    if (session && pathname.startsWith("/auth/") && 
        pathname !== "/auth/logout" && 
        !pathname.startsWith("/auth/api/")) {
      console.log(`[Auth Middleware] Redirecting authenticated user from ${pathname} to dashboard`);
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    
    // Add session info to the request headers for client components
    const response = NextResponse.next();
    if (session) {
      // Set an auth cookie that client-side code can check
      response.cookies.set("auth_check", "authenticated", {
        httpOnly: false, // Readable by client JavaScript
        maxAge: 60 * 60 * 24, // 1 day
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      
      // Add session user ID to headers for client components
      if (session.user?.id) {
        response.headers.set("x-auth-user-id", session.user.id);
      }
      
      response.headers.set("x-auth-user", "authenticated");
    } else if (isProtectedRoute) {
      // Double-check protection: if somehow we got here without a session on a protected route
      console.log(`[Auth Middleware] Safety redirect - no session on protected route: ${pathname}`);
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    
    return response;
  } catch (error) {
    console.error("Auth middleware error:", error);
    
    // If there's an error and route is protected, redirect to login
    if (!isPublicRoute) {
      console.log(`[Auth Middleware] Error redirect from ${pathname} to login`);
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
    
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
}; 