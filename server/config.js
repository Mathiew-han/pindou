function splitCsv(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildAllowedOrigins() {
  const configuredOrigins = splitCsv(process.env.ALLOWED_ORIGINS)
  const vercelOrigins = [
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : '',
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '',
  ].filter(Boolean)

  const localOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
  ]

  return [...new Set([...configuredOrigins, ...vercelOrigins, ...localOrigins])]
}

export const appConfig = {
  allowedOrigins: buildAllowedOrigins(),
  csrfCookieName: 'pb_csrf',
  csrfHeaderName: 'x-csrf-token',
  csrfTtlSeconds: 60 * 60 * 2,
  sessionCookieName: 'pb_session',
  sessionTtlSeconds: 60 * 60 * 24 * 30,
  jsonBodyLimitBytes: 32_768,
  databaseUrl: process.env.POSTGRES_URL || process.env.DATABASE_URL || '',
  jwtSecret: process.env.AUTH_SECRET || '',
  rateLimits: {
    auth: { windowMs: 60_000, max: 10 },
    contact: { windowMs: 60_000, max: 6 },
    bootstrap: { windowMs: 60_000, max: 30 },
    session: { windowMs: 60_000, max: 30 },
  },
}
