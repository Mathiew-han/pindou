import { ensureAuthSchema, readSession } from '../server/auth-store.js'
import { appConfig } from '../server/config.js'
import { getClientKey, isRateLimited } from '../server/http.js'
import {
  assertAllowedOrigin,
  clearSessionCookie,
  handleOptions,
  parseCookies,
  sendJson,
} from '../server/security.js'

export default async function handler(request, response) {
  if (request.method === 'OPTIONS') {
    handleOptions(request, response)
    return
  }

  if (request.method !== 'GET') {
    sendJson(response, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' }, { origin: request.headers.origin })
    return
  }

  const originCheck = assertAllowedOrigin(request)
  if (!originCheck.ok) {
    sendJson(response, 403, { ok: false, error: 'ORIGIN_NOT_ALLOWED' }, { origin: request.headers.origin })
    return
  }

  const clientKey = `session:${getClientKey(request)}`
  if (isRateLimited(clientKey, appConfig.rateLimits.session)) {
    sendJson(response, 429, { ok: false, error: 'RATE_LIMITED' }, { origin: originCheck.origin })
    return
  }

  const cookies = parseCookies(request)
  const token = cookies[appConfig.sessionCookieName]
  if (!token) {
    sendJson(response, 401, { ok: false, error: 'SESSION_MISSING' }, { origin: originCheck.origin })
    return
  }

  try {
    await ensureAuthSchema()
    const session = await readSession(token)
    sendJson(
      response,
      200,
      {
        ok: true,
        user: session.user,
      },
      { origin: originCheck.origin },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SESSION_INVALID'
    const statusCode = message === 'DATABASE_URL_MISSING' || message === 'AUTH_SECRET_MISSING' ? 500 : 401
    sendJson(
      response,
      statusCode,
      {
        ok: false,
        error: statusCode === 500 ? message : 'SESSION_INVALID',
      },
      statusCode === 500
        ? { origin: originCheck.origin }
        : {
            origin: originCheck.origin,
            headers: {
              'set-cookie': clearSessionCookie(request),
            },
          },
    )
  }
}
