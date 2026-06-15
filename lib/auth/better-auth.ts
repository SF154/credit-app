import { betterAuth } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL!,
  secret: process.env.BETTER_AUTH_SECRET!,
  database: pool,
  emailAndPassword: { enabled: true },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Phase 1: companies are seeded manually — user_profiles is inserted manually after user creation.
          // Future phases: insert user_profiles row here when company_id is available via sign-up metadata.
          console.log('[auth] user created:', user.id, user.email)
        },
      },
    },
  },
  plugins: [nextCookies()], // must be last
})

export type Session = typeof auth.$Infer.Session
