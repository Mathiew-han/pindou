import { appConfig } from './config.js'
import { sendJson } from './security.js'

const memoryBuckets = new Map()

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

export function readJsonBody(request, limit = appConfig.jsonBodyLimitBytes) {
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

export async function parseJsonOrReply(request, response) {
  try {
    return await readJsonBody(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'INVALID_REQUEST'
    sendJson(response, message === 'PAYLOAD_TOO_LARGE' ? 413 : 400, { ok: false, error: message }, {
      origin: request.headers.origin,
    })
    return null
  }
}
