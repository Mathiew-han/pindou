import crypto from 'node:crypto'
import { appConfig } from './config.js'

const securityHeaders = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'x-xss-protection': '0',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
}

export function buildCorsHeaders(origin) {
  const allowOrigin = isAllowedOrigin(origin) ? origin : appConfig.allowedOrigins[0] ?? ''
  return allowOrigin
    ? {
        'access-control-allow-origin': allowOrigin,
        'access-control-allow-credentials': 'true',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': `content-type, ${appConfig.csrfHeaderName}`,
        vary: 'Origin',
      }
    : {}
}

export function sendJson(response, statusCode, payload, options = {}) {
  const headers = {
    ...securityHeaders,
    ...buildCorsHeaders(options.origin),
    ...(options.headers ?? {}),
  }

  response.writeHead(statusCode, headers)
  response.end(JSON.stringify(payload))
}

export function isAllowedOrigin(origin) {
  if (!origin) return false
  return appConfig.allowedOrigins.includes(origin)
}

export function assertAllowedOrigin(request) {
  const origin = request.headers.origin
  if (!origin) return { ok: true, origin: '' }
  return { ok: isAllowedOrigin(origin), origin }
}

export function handleOptions(request, response) {
  const origin = request.headers.origin
  response.writeHead(204, {
    ...buildCorsHeaders(origin),
    'cache-control': 'no-store',
  })
  response.end()
}

export function parseCookies(request) {
  const rawCookie = request.headers.cookie ?? ''
  return rawCookie.split(';').reduce((result, cookiePart) => {
    const [key, ...rest] = cookiePart.trim().split('=')
    if (!key) return result
    result[key] = decodeURIComponent(rest.join('='))
    return result
  }, {})
}

export function issueCsrfToken() {
  return crypto.randomBytes(24).toString('base64url')
}

function shouldUseSecureCookie(request) {
  const origin = String(request?.headers?.origin ?? '')
  const host = String(request?.headers?.host ?? '')
  return !(origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || host.startsWith('localhost') || host.startsWith('127.0.0.1'))
}

function buildCookie(name, value, maxAgeSeconds, request) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
  ]

  if (shouldUseSecureCookie(request)) {
    parts.push('Secure')
  }

  return parts.join('; ')
}

export function buildCsrfCookie(token, request) {
  return buildCookie(appConfig.csrfCookieName, token, appConfig.csrfTtlSeconds, request)
}

export function buildSessionCookie(token, request) {
  return buildCookie(appConfig.sessionCookieName, token, appConfig.sessionTtlSeconds, request)
}

export function clearSessionCookie(request) {
  return buildCookie(appConfig.sessionCookieName, '', 0, request)
}

export function assertCsrf(request) {
  const cookies = parseCookies(request)
  const cookieToken = cookies[appConfig.csrfCookieName]
  const headerToken = request.headers[appConfig.csrfHeaderName]

  return Boolean(cookieToken && headerToken && cookieToken === headerToken)
}
