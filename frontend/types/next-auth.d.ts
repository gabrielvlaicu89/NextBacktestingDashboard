import { DefaultSession } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

// Augment the built-in Session type to include the database user id
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

// Augment the JWT type so token.id is typed
declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
  }
}
