import { NextResponse } from 'next/server';

// Decodes a base64url encoded string in the Next.js Edge Runtime
function base64urlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  try {
    return atob(base64);
  } catch (e) {
    return '';
  }
}

// Parses the JWT token payload securely
function parseJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = base64urlDecode(parts[1]);
    return JSON.parse(payload);
  } catch (error) {
    return null;
  }
}

export function proxy(request) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  const payload = token ? parseJwt(token) : null;
  const isExpired = payload ? (payload.exp * 1000 < Date.now()) : true;

  // Protect Admin Panel routes
  if (pathname.startsWith('/admin')) {
    if (!token || isExpired) {
      return NextResponse.redirect(new URL(`/login?from=${pathname}`, request.url));
    }
    if (payload.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Protect Submit Model routes
  if (pathname.startsWith('/submit')) {
    if (!token || isExpired) {
      return NextResponse.redirect(new URL(`/login?from=${pathname}`, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/submit/:path*'],
};
