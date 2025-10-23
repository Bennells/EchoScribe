import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: "No token provided" },
        { status: 400 }
      );
    }

    // Set the token as an httpOnly cookie
    const cookieStore = await cookies();

    // Determine if we're in development or production
    const isProduction = process.env.NODE_ENV === "production";

    cookieStore.set("firebase-token", token, {
      httpOnly: true,
      secure: isProduction, // Only use secure in production (HTTPS)
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Set token error:", error);
    return NextResponse.json(
      { error: "Failed to set token" },
      { status: 500 }
    );
  }
}
