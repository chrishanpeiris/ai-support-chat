import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { SignJWT } from 'jose';

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

async function signBFFToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(secret);
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const res = await fetch(`${process.env.BFF_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: credentials.email, password: credentials.password }),
        });

        if (!res.ok) return null;

        return res.json() as Promise<{ id: string; email: string; name: string }>;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.bffToken = await signBFFToken(user.id, user.email!);
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.bffToken = token.bffToken as string;
      return session;
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
};

declare module 'next-auth' {
  interface User {
    id: string;
  }
  interface Session {
    user: { id: string; email?: string | null; name?: string | null };
    bffToken: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string;
    bffToken: string;
  }
}
