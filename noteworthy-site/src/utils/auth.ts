import bcrypt from "bcrypt";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import { prisma } from "./prismaDB";
import type { Adapter } from "next-auth/adapters";

export const authOptions: NextAuthOptions = {
  pages: {
    signIn: "/signin",
  },
  adapter: PrismaAdapter(prisma) as Adapter,
  secret: process.env.SECRET,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ account, profile, user }) {
      // If the sign in is using an OAuth provider
      if (account?.provider === 'google' || account?.provider === 'github') {
        // Check if this OAuth account email already exists in the database
        if (profile?.email) {
          try {
            // Look for existing user with this email
            const existingUser = await prisma.user.findUnique({
              where: { email: profile.email as string },
            });
            
            // If the user exists, link this OAuth provider to the existing account
            if (existingUser) {
              // Check if the user already has an account with this provider
              const existingAccount = await prisma.account.findFirst({
                where: {
                  userId: existingUser.id,
                  provider: account.provider,
                },
              });
              
              // If no existing account with this provider, create one
              if (!existingAccount) {
                await prisma.account.create({
                  data: {
                    userId: existingUser.id,
                    type: account.type,
                    provider: account.provider,
                    providerAccountId: account.providerAccountId,
                    refresh_token: account.refresh_token,
                    access_token: account.access_token,
                    expires_at: account.expires_at,
                    token_type: account.token_type,
                    scope: account.scope,
                    id_token: account.id_token,
                    session_state: account.session_state,
                  },
                });
              }
              
              // Return true to allow sign in with the existing user
              return true;
            }
          } catch (error) {
            console.error("Error in signIn callback:", error);
            return true; // Still allow the sign in process to continue
          }
        }
      }
      
      // Default: allow sign in
      return true;
    },

    jwt: async (payload: any) => {
      const { token } = payload;
      const user = payload.user;

      if (user) {
        return {
          ...token,
          id: user.id,
        };
      }
      return token;
    },

    session: async ({ session, token }) => {
      if (session?.user) {
        return {
          ...session,
          user: {
            ...session.user,
            id: token?.id,
          },
        };
      }
      return session;
    },
    
    async redirect({ url, baseUrl }) {
      // Redirect to convert page when landing on the base URL after signin
      if (url.startsWith(baseUrl) || url === baseUrl || url === `${baseUrl}/`) {
        return `${baseUrl}/convert`;
      }
      // Otherwise respect the callbackUrl
      return url;
    },
  },

  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text", placeholder: "Jhondoe" },
        password: { label: "Password", type: "password" },
        username: { label: "Username", type: "text", placeholder: "Jhon Doe" },
      },

      async authorize(credentials) {
        // check to see if email and password is there
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Please enter an email or password");
        }

        // check to see if user already exist
        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email,
          },
        });

        // if user was not found
        if (!user || !user?.password) {
          throw new Error("Invalid email or password");
        }

        // check to see if passwords match
        const passwordMatch = await bcrypt.compare(
          credentials.password,
          user.password,
        );

        // console.log(passwordMatch);

        if (!passwordMatch) {
          console.log("test", passwordMatch);
          throw new Error("Incorrect password");
        }

        return user;
      },
    }),

    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
        },
      },
    }),

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      }
    }),

    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],

  // debug: process.env.NODE_ENV === "developement",
};
