import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

export default defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL || "postgres://medusa_user:medusa_password@localhost:5432/medusa_db",
    databaseDriverOptions: process.env.DATABASE_SSL === "false"
      ? { connection: { ssl: false } }
      : undefined,
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
    http: {
      storeCors: process.env.STORE_CORS || "http://localhost:3000",
      adminCors: process.env.ADMIN_CORS || "http://localhost:9000,http://localhost:7001",
      authCors: process.env.AUTH_CORS || "http://localhost:3000,http://localhost:9000",
      jwtSecret: process.env.JWT_SECRET || "supersecret-acme-jwt-token-key-2026",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret-acme-cookie-key-2026",
    },
    cookieOptions: process.env.COOKIE_SECURE === "false"
      ? { secure: false }
      : undefined,
  },
  admin: {
    disable: false,
    path: "/app",
  },
  modules: [
    {
      resolve: "./src/modules/b2b-company",
    },
    ...(process.env.STRIPE_API_KEY
      ? [
          {
            resolve: "@medusajs/medusa/payment",
            options: {
              providers: [
                {
                  resolve: "@medusajs/payment-stripe",
                  id: "stripe",
                  options: {
                    apiKey: process.env.STRIPE_API_KEY,
                    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
                  },
                },
              ],
            },
          },
        ]
      : []),
  ],
})
