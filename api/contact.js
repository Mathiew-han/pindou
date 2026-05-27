import { appConfig } from '../server/config.js'
import { getClientKey, isRateLimited, parseJsonOrReply } from '../server/http.js'
import { assertAllowedOrigin, assertCsrf, handleOptions, sendJson } from '../server/security.js'
import { hasSuspiciousInput, isValidEmail, sanitizeText } from '../server/validation.js'

const salesEmail = process.env.AD_SALES_EMAIL || '2072719218@qq.com'

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

  const clientKey = `contact:${getClientKey(request)}`
  if (isRateLimited(clientKey, appConfig.rateLimits.contact)) {
    sendJson(response, 429, { ok: false, error: 'RATE_LIMITED', message: '提交过于频繁，请稍后再试。' }, { origin: originCheck.origin })
    return
  }

  const body = await parseJsonOrReply(request, response)
  if (!body) return
  const name = sanitizeText(body.name, 80)
  const email = sanitizeText(body.email, 120).toLowerCase()
  const brand = sanitizeText(body.brand, 120)
  const message = sanitizeText(body.message, 1_000)

  if (!name || !brand || message.length < 8) {
    sendJson(response, 400, { ok: false, error: 'MISSING_FIELDS', message: '请补充姓名、品牌和合作需求。' }, { origin: originCheck.origin })
    return
  }

  if (!isValidEmail(email)) {
    sendJson(response, 400, { ok: false, error: 'INVALID_EMAIL', message: '请输入有效邮箱地址。' }, { origin: originCheck.origin })
    return
  }

  if (hasSuspiciousInput(name, email, brand, message)) {
    sendJson(response, 400, { ok: false, error: 'SUSPICIOUS_INPUT', message: '输入包含不允许的特殊片段。' }, { origin: originCheck.origin })
    return
  }

  sendJson(response, 200, {
      ok: true,
      salesEmail,
      demo: true,
      message: '合作咨询已通过后端校验。当前未接入邮件服务，请同时发送邮件确认。',
    }, { origin: originCheck.origin })
}
