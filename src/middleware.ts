export { auth as middleware } from "@/auth";

// Protect everything except the login page, auth endpoints, static assets,
// and PWA files. Unauthenticated requests are redirected to /login.
export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/).*)",
  ],
};
