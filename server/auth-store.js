import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { appConfig } from './config.js'
import { withDb } from './db.js'

const encoder = new TextEncoder()

function getJwtSecret() {
  if (!appConfig.jwtSecret) {
    throw new Error('AUTH_SECRET_MISSING')
  }

  return encoder.encode(appConfig.jwtSecret)
}

export async function ensureAuthSchema() {
  await withDb(async (db) => {
    await db.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto
    `).catch(() => null)

    await db.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await db.query(`
      CREATE TABLE IF NOT EXISTS app_sessions (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        token_jti TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ
      )
    `)

    await db.query(`
      CREATE INDEX IF NOT EXISTS app_sessions_user_id_idx
      ON app_sessions(user_id)
    `)
  })
}

export async function createUser(email, password) {
  const passwordHash = await bcrypt.hash(password, 12)
  const userId = crypto.randomUUID()

  return withDb(async (db) => {
    const result = await db.query(
      `
        INSERT INTO app_users (id, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, email, created_at
      `,
      [userId, email, passwordHash],
    )

    return result.rows[0]
  })
}

export async function findUserByEmail(email) {
  return withDb(async (db) => {
    const result = await db.query(
      `
        SELECT id, email, password_hash, created_at
        FROM app_users
        WHERE email = $1
        LIMIT 1
      `,
      [email],
    )

    return result.rows[0] ?? null
  })
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash)
}

export async function issueSession(user) {
  const expiresAt = new Date(Date.now() + appConfig.sessionTtlSeconds * 1000)
  const tokenJti = crypto.randomUUID()
  const sessionId = crypto.randomUUID()

  await withDb((db) =>
    db.query(
      `
        INSERT INTO app_sessions (id, user_id, token_jti, expires_at)
        VALUES ($1, $2, $3, $4)
      `,
      [sessionId, user.id, tokenJti, expiresAt],
    ),
  )

  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    jti: tokenJti,
    type: 'session',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${appConfig.sessionTtlSeconds}s`)
    .sign(getJwtSecret())

  return { token, expiresAt }
}

export async function readSession(token) {
  const verified = await jwtVerify(token, getJwtSecret())
  const payload = verified.payload

  const session = await withDb(async (db) => {
    const result = await db.query(
      `
        SELECT s.id, s.user_id, s.expires_at, s.revoked_at, u.email
        FROM app_sessions s
        JOIN app_users u ON u.id = s.user_id
        WHERE s.token_jti = $1
        LIMIT 1
      `,
      [payload.jti],
    )

    return result.rows[0] ?? null
  })

  if (!session || session.revoked_at || new Date(session.expires_at).getTime() < Date.now()) {
    throw new Error('SESSION_INVALID')
  }

  return {
    user: {
      id: session.user_id,
      email: session.email,
    },
    jti: payload.jti,
  }
}

export async function revokeSession(token) {
  try {
    const verified = await jwtVerify(token, getJwtSecret())
    const tokenJti = String(verified.payload.jti ?? '')
    if (!tokenJti) return

    await withDb((db) =>
      db.query(
        `
          UPDATE app_sessions
          SET revoked_at = NOW()
          WHERE token_jti = $1
        `,
        [tokenJti],
      ),
    )
  } catch {
    return
  }
}
