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
    // Verify token using existing API endpoint
    const verifyUrl = new URL('/api/auth/verify-token', request.url);
    const verifyResponse = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `firebase-token=${token}`,
      },
      body: JSON.stringify({ token }),
    });

    if (!verifyResponse.ok) {
      throw new Error('Token verification failed');
    }

    const { email } = await verifyResponse.json();

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
