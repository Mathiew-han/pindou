import { revokeSession } from '../server/auth-store.js'
import { appConfig } from '../server/config.js'
import { getClientKey, isRateLimited } from '../server/http.js'
import {
  assertAllowedOrigin,
  assertCsrf,
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

  if (request.method !== 'POST') {
    sendJson(response, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' }, { origin: request.headers.origin })
    return
  }

  const originCheck = assertAllowedOrigin(request)
  if (!originCheck.ok) {
    sendJson(response, 403, { ok: false, error: 'ORIGIN_NOT_ALLOWED' }, { origin: request.headers.origin })
    return
  }

  if (!assertCsrf(request)) {
    sendJson(response, 403, { ok: false, error: 'CSRF_VALIDATION_FAILED' }, { origin: originCheck.origin })
    return
  }

  const clientKey = `logout:${getClientKey(request)}`
  if (isRateLimited(clientKey, appConfig.rateLimits.session)) {
    sendJson(response, 429, { ok: false, error: 'RATE_LIMITED' }, { origin: originCheck.origin })
    return
  }

  const cookies = parseCookies(request)
  const token = cookies[appConfig.sessionCookieName]

  if (token) {
    try {
      await revokeSession(token)
    } catch {
      // Always clear client session cookie even if storage revocation fails.
    }
  }

  sendJson(
    response,
    200,
    { ok: true, message: '已退出登录。' },
    {
      origin: originCheck.origin,
      headers: {
        'set-cookie': clearSessionCookie(request),
      },
    },
  )
}
