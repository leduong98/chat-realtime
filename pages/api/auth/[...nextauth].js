import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getDb } from "../../../lib/db";

export const authOptions = {
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const u = String(credentials?.username || "").trim().toLowerCase();
          const p = String(credentials?.password || "");
          if (!u || !p) return null;

          const db = await getDb();
          const user = await db.collection("users").findOne({ username: u });
          if (!user) return null;

          const ok = await bcrypt.compare(p, String(user.passwordHash || ""));
          if (!ok) return null;

          return { id: String(user._id), username: u };
        } catch (e) {
          const msg = String(e?.message || "");
          const name = String(e?.name || "");
          const code = String(e?.code || "");
          console.error("[nextauth][authorize] error", { name, code, msg });
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = session.user || {};
      session.user.id = token.userId;
      session.user.username = token.username;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};

export default NextAuth(authOptions);

