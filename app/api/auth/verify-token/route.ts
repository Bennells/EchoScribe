import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "No token provided" },
        { status: 400 }
      );
    }

    // In emulator mode, just decode the JWT without verification
    // Emulator tokens don't have proper signatures
    if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true") {
      try {
        // Decode JWT payload (base64 decode the middle part)
        const parts = token.split('.');
        if (parts.length !== 3) {
          throw new Error('Invalid token format');
        }

        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

        console.log("Decoded token payload:", payload);

        // Firebase emulator tokens use 'user_id' instead of 'uid'
        const uid = payload.uid || payload.user_id;
        const email = payload.email;

        // Basic validation
        if (!uid) {
          console.error('Missing uid in token payload');
          throw new Error('Invalid token payload - missing uid');
        }

        console.log("Emulator token decoded successfully:", uid);

        return NextResponse.json({
          valid: true,
          uid: uid,
          email: email,
        });
      } catch (error: any) {
        console.error("Emulator token decode error:", error);
        return NextResponse.json(
          { valid: false, error: "Invalid emulator token" },
          { status: 401 }
        );
      }
    }

    // Production mode - verify the token with Firebase Admin
    const decodedToken = await adminAuth.verifyIdToken(token);

    return NextResponse.json({
      valid: true,
      uid: decodedToken.uid,
      email: decodedToken.email,
    });
  } catch (error: any) {
    console.error("Token verification error:", error);

    // Handle specific error cases
    if (error.code === "auth/id-token-expired") {
      return NextResponse.json(
        { valid: false, error: "Token expired" },
        { status: 401 }
      );
    }

    if (error.code === "auth/argument-error") {
      return NextResponse.json(
        { valid: false, error: "Invalid token format" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { valid: false, error: "Token verification failed" },
      { status: 401 }
    );
  }
}
