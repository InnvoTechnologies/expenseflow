import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { cookies } from 'next/headers';

// This function handles the Google OAuth callback
export async function GET(request: NextRequest) {
    try {
        console.log('[Google Auth Callback] Processing OAuth callback with URL:', request.url);

        // Get the session token from the request if available
        const searchParams = new URL(request.url).searchParams;
        console.log('[Google Auth Callback] Search params:', Object.fromEntries(searchParams.entries()));

        // Let Better Auth handle the authentication flow
        const response = await auth.handler(request);

        if (response) {
            console.log('[Google Auth Callback] Auth handler provided response');

            // Add a special cookie to force client-side session refresh
            const enhancedResponse = NextResponse.redirect(
                new URL('/dashboard', request.url),
                response
            );

            // Set cookies that can help the client detect successful authentication
            enhancedResponse.cookies.set('auth_refresh_required', 'true', {
                httpOnly: false,
                maxAge: 60, // Short-lived cookie, just for immediate post-auth refresh
                path: '/',
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
            });

            // Add timestamp to help prevent caching issues
            enhancedResponse.cookies.set('auth_timestamp', Date.now().toString(), {
                httpOnly: false,
                maxAge: 60,
                path: '/',
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
            });

            console.log('[Google Auth Callback] Returning enhanced response with cookies');
            return enhancedResponse;
        }

        console.log('[Google Auth Callback] No response from auth handler, redirecting to dashboard');
        const redirectResponse = NextResponse.redirect(new URL('/dashboard?auth_success=true', request.url));

        // Add cookies to ensure client refreshes authentication state
        redirectResponse.cookies.set('auth_refresh_required', 'true', {
            httpOnly: false,
            maxAge: 60,
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
        });

        return redirectResponse;
    } catch (error) {
        console.error('[Google Auth Callback] Error:', error);
        return NextResponse.redirect(
            new URL('/auth/login?error=Authentication+failed', request.url)
        );
    }
}
