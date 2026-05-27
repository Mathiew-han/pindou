import {
  getClientKey,
  hasSuspiciousInput,
  isRateLimited,
  isValidEmail,
  readJsonBody,
  sanitizeText,
  sendJson,
} from './_utils.js'

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' })
    return
  }

  const clientKey = `auth:${getClientKey(request)}`
  if (isRateLimited(clientKey, { windowMs: 60_000, max: 10 })) {
    sendJson(response, 429, { ok: false, error: 'RATE_LIMITED', message: '提交过于频繁，请稍后再试。' })
    return
  }

  try {
    const body = await readJsonBody(request)
    const mode = sanitizeText(body.mode, 16)
    const email = sanitizeText(body.email, 120).toLowerCase()
    const password = String(body.password ?? '').slice(0, 128)
    const confirmPassword = String(body.confirmPassword ?? '').slice(0, 128)

    if (mode !== 'login' && mode !== 'register') {
      sendJson(response, 400, { ok: false, error: 'INVALID_MODE' })
      return
    }

    if (!isValidEmail(email)) {
      sendJson(response, 400, { ok: false, error: 'INVALID_EMAIL', message: '请输入有效邮箱地址。' })
      return
    }

    if (password.length < 8) {
      sendJson(response, 400, { ok: false, error: 'WEAK_PASSWORD', message: '密码至少需要 8 位。' })
      return
    }

    if (hasSuspiciousInput(email, password, confirmPassword)) {
      sendJson(response, 400, { ok: false, error: 'SUSPICIOUS_INPUT', message: '输入包含不允许的特殊片段。' })
      return
    }

    if (mode === 'register' && password !== confirmPassword) {
      sendJson(response, 400, { ok: false, error: 'PASSWORD_MISMATCH', message: '两次输入的密码不一致。' })
      return
    }

    sendJson(response, 200, {
      ok: true,
      mode,
      email,
      demo: true,
      message: mode === 'register' ? '注册请求已通过后端校验。当前为演示模式，未创建真实账户。' : '登录请求已通过后端校验。当前为演示模式，未签发真实会话。',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    sendJson(response, message === 'PAYLOAD_TOO_LARGE' ? 413 : 400, { ok: false, error: message })
  }
}
