import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Extract role from cookie or auth header if present, fallback to route-based role for client side navigation
  const userRole = request.cookies.get('user_role')?.value || request.headers.get('x-user-role');

  // Role protected route groups
  const isProprietaireRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/(proprietaire)');
  const isAgenceRoute = pathname.startsWith('/agence') || pathname.startsWith('/(agence)');
  const isLocataireRoute = pathname.startsWith('/locataire') || pathname.startsWith('/(locataire)');
  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/(admin)');

  if (userRole) {
    if (isProprietaireRoute && userRole !== 'proprietaire') {
      return NextResponse.redirect(new URL(`/${userRole}/dashboard`, request.url));
    }
    if (isAgenceRoute && userRole !== 'agence') {
      return NextResponse.redirect(new URL(`/${userRole}/dashboard`, request.url));
    }
    if (isLocataireRoute && userRole !== 'locataire') {
      return NextResponse.redirect(new URL(`/${userRole}/dashboard`, request.url));
    }
    if (isAdminRoute && userRole !== 'admin') {
      return NextResponse.redirect(new URL(`/${userRole}/dashboard`, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/agence/:path*',
    '/locataire/:path*',
    '/admin/:path*',
  ],
};
