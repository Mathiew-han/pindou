const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const suspiciousSqlPattern = /('|--|;|\/\*|\*\/|\b(select|insert|update|delete|drop|union|alter|exec|truncate)\b)/i
const memoryBuckets = new Map()

export function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, jsonHeaders)
  response.end(JSON.stringify(payload))
}

export function readJsonBody(request, limit = 32_768) {
  return new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk
      if (Buffer.byteLength(body) > limit) {
        reject(new Error('PAYLOAD_TOO_LARGE'))
        request.destroy()
      }
    })

    request.on('end', () => {
      if (!body) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('INVALID_JSON'))
      }
    })

    request.on('error', reject)
  })
}

export function sanitizeText(value, maxLength = 500) {
  return String(value ?? '')
    .trim()
    .replace(/[<>"`\\]/g, '')
    .slice(0, maxLength)
}

export function isValidEmail(value) {
  const email = sanitizeText(value, 120).toLowerCase()
  return email.length <= 120 && emailPattern.test(email) && !suspiciousSqlPattern.test(email)
}

export function hasSuspiciousInput(...values) {
  return values.some((value) => suspiciousSqlPattern.test(String(value ?? '')))
}

export function getClientKey(request) {
  const forwardedFor = request.headers['x-forwarded-for']
  const firstForwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0]
  return firstForwardedIp?.trim() || request.socket.remoteAddress || 'anonymous'
}

export function isRateLimited(key, options = {}) {
  const windowMs = options.windowMs ?? 60_000
  const max = options.max ?? 20
  const now = Date.now()
  const bucket = memoryBuckets.get(key)?.filter((timestamp) => now - timestamp < windowMs) ?? []

  if (bucket.length >= max) {
    memoryBuckets.set(key, bucket)
    return true
  }

  bucket.push(now)
  memoryBuckets.set(key, bucket)
  return false
}
