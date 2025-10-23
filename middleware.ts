import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Get the Firebase token from cookies
  const token = request.cookies.get("firebase-token")?.value;

  console.log("Middleware: Checking auth for", request.nextUrl.pathname);
  console.log("Middleware: Token exists?", !!token);

  // If no token, redirect to login
  if (!token) {
    console.log("Middleware: No token found, redirecting to login");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    // Verify the token using our API route
    // We need to do this because firebase-admin doesn't work in Edge Runtime
    const verifyUrl = new URL("/api/auth/verify-token", request.url);
    console.log("Middleware: Verifying token...");

    const verifyResponse = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });

    if (!verifyResponse.ok) {
      // Token verification failed
      console.log("Middleware: Token verification failed, status:", verifyResponse.status);
      return NextResponse.redirect(new URL("/login", request.url));
    }

    console.log("Middleware: Token verified successfully");
    // Token is valid, allow the request
    return NextResponse.next();
  } catch (error) {
    console.error("Middleware: Token verification error:", error);

    // Token is invalid or expired, redirect to login
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
