import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

// NextAuth requires both GET (OAuth redirect) and POST (sign-in/sign-out) methods
export { handler as GET, handler as POST };
