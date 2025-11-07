import { NextRequest, NextResponse } from 'next/server';

// Public paths that don't require authentication
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/privacy',
  '/imprint',
  '/terms',
  '/pricing',
];

// Whitelist configuration - only active in test environment
const WHITELIST_ENABLED = process.env.WHITELIST_ENABLED === 'true';
const WHITELISTED_EMAILS = process.env.WHITELISTED_EMAILS?.split(',').map(e => e.trim()) || [];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip whitelisting if not enabled (production environment)
  if (!WHITELIST_ENABLED) {
    return NextResponse.next();
  }

  // Allow public paths without authentication
  if (PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'))) {
    return NextResponse.next();
  }

  // Allow API routes, static files, and Next.js internal routes
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/not-authorized') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Get Firebase token from cookie
  const token = request.cookies.get('firebase-token')?.value;

  if (!token) {
    // Redirect to login with return URL
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  try {
    // Decode JWT token to extract email (without full verification)
    // Full verification happens in API routes; here we just need the email for whitelist check
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    // Decode the payload (second part)
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    const email = payload.email;

    if (!email) {
      throw new Error('Email not found in token');
    }

    // Check if email is in whitelist
    if (!WHITELISTED_EMAILS.includes(email)) {
      const url = request.nextUrl.clone();
      url.pathname = '/not-authorized';
      url.searchParams.set('email', email);
      return NextResponse.redirect(url);
    }

    // Email is whitelisted, allow access
    return NextResponse.next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    // On error, redirect to login
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Files with extensions (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|api).*)',
  ],
};
