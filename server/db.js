import { attachDatabasePool } from '@vercel/functions'
import { Pool } from 'pg'
import { appConfig } from './config.js'

let pool

export function getDb() {
  if (!appConfig.databaseUrl) {
    throw new Error('DATABASE_URL_MISSING')
  }

  if (!pool) {
    pool = new Pool({
      connectionString: appConfig.databaseUrl,
      max: 5,
      idleTimeoutMillis: 10_000,
      ssl: appConfig.databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
    })
    attachDatabasePool(pool)
  }

  return pool
}

export async function withDb(callback) {
  const db = getDb()
  return callback(db)
}
