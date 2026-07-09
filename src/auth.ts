import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * The only account permitted to use this application.
 * Kept in an env var so it can be rotated without a code change;
 * defaults to the owner's address.
 */
const ALLOWED_EMAIL = (
  process.env.ALLOWED_EMAIL ?? "jatinmangla123@gmail.com"
).toLowerCase();

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  callbacks: {
    // Hard allowlist: any other Google account is rejected at sign-in.
    signIn({ user }) {
      return (user.email ?? "").toLowerCase() === ALLOWED_EMAIL;
    },
    // Used by middleware to gate every route.
    authorized({ auth: session }) {
      return (session?.user?.email ?? "").toLowerCase() === ALLOWED_EMAIL;
    },
  },
});
