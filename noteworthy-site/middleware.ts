import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only run this middleware for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // You can't actually increase the body size limit in middleware
    // But we can adjust headers for better error handling
    const response = NextResponse.next();
    
    // Add custom header to track API requests
    response.headers.set('x-middleware-cache', 'no-cache');
    
    return response;
  }
  
  return NextResponse.next();
}

// See: https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
export const config = {
  matcher: ['/api/:path*'],
};
