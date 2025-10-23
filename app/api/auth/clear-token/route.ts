import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();

    // Delete the firebase-token cookie
    cookieStore.delete("firebase-token");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Clear token error:", error);
    return NextResponse.json(
      { error: "Failed to clear token" },
      { status: 500 }
    );
  }
}
