import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    
    // RBAC: Organizer Dashboard Protection
    if (path.startsWith("/dashboard/organizer") && token?.role !== "ORGANIZER" && token?.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    
    // RBAC: Captain Dashboard Protection
    if (path.startsWith("/dashboard/captain") && token?.role !== "CAPTAIN" && token?.role !== "ORGANIZER" && token?.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    
    // RBAC: Player Dashboard Protection (Captains/Organizers can also view player dashboard if needed)
    if (path.startsWith("/dashboard/player") && token?.role !== "PLAYER" && token?.role !== "CAPTAIN" && token?.role !== "ORGANIZER" && token?.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*"],
};
