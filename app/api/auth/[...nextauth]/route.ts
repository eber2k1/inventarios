import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Endpoints de NextAuth: /api/auth/signin, /callback/github, /session, /signout, /csrf...
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
