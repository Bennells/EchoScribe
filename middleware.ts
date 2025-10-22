import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // For now, we'll just allow all requests
  // TODO: Implement proper auth checking once we have session handling
  // The actual auth protection will be done client-side with useAuth hook

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
