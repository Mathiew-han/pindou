import { appConfig } from '../server/config.js'
import { getClientKey, isRateLimited } from '../server/http.js'
import {
  assertAllowedOrigin,
  buildCsrfCookie,
  handleOptions,
  issueCsrfToken,
  sendJson,
} from '../server/security.js'

export default function handler(request, response) {
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

  const clientKey = `bootstrap:${getClientKey(request)}`
  if (isRateLimited(clientKey, appConfig.rateLimits.bootstrap)) {
    sendJson(response, 429, { ok: false, error: 'RATE_LIMITED' }, { origin: originCheck.origin })
    return
  }

  const csrfToken = issueCsrfToken()
  sendJson(
    response,
    200,
    { ok: true, csrfToken },
    {
      origin: originCheck.origin,
      headers: {
        'set-cookie': buildCsrfCookie(csrfToken, request),
      },
    },
  )
}
