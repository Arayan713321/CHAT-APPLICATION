import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Routes accessible without authentication
const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

/**
 * Route protection strategy:
 *   - Public routes (/, /sign-in, /sign-up) → allow through
 *   - All other routes (e.g. /chat/*) → require Clerk session.
 *     Unauthenticated requests are redirected to "/" (landing page).
 *
 * Using redirectToSignIn ensures no redirect loop — Clerk will not
 * redirect from "/" since it is explicitly listed as public.
 */
export default clerkMiddleware(async (auth, request) => {
    if (!isPublicRoute(request)) {
        const { userId } = await auth();
        if (!userId) {
            // Redirect to landing page instead of Clerk's hosted sign-in
            // to avoid dependency on CLERK_SIGN_IN_URL in production
            return NextResponse.redirect(new URL("/", request.url));
        }
    }
});

export const config = {
    matcher: [
        // Run on all routes except static files and Next.js internals
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
