import { appConfig } from '../server/config.js'
import {
  createUser,
  ensureAuthSchema,
  findUserByEmail,
  issueSession,
  verifyPassword,
} from '../server/auth-store.js'
import { getClientKey, isRateLimited, parseJsonOrReply } from '../server/http.js'
import {
  assertAllowedOrigin,
  assertCsrf,
  buildSessionCookie,
  handleOptions,
  sendJson,
} from '../server/security.js'
import { hasSuspiciousInput, isValidEmail, sanitizeText, validatePassword } from '../server/validation.js'

function sendAuthSuccess(response, origin, request, payload) {
  const { sessionToken, ...responsePayload } = payload
  sendJson(
    response,
    200,
    responsePayload,
    {
      origin,
      headers: {
        'set-cookie': buildSessionCookie(sessionToken, request),
      },
    },
  )
}

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

  const clientKey = `auth:${getClientKey(request)}`
  if (isRateLimited(clientKey, appConfig.rateLimits.auth)) {
    sendJson(
      response,
      429,
      { ok: false, error: 'RATE_LIMITED', message: '提交过于频繁，请稍后再试。' },
      { origin: originCheck.origin },
    )
    return
  }

  const body = await parseJsonOrReply(request, response)
  if (!body) return

  const mode = sanitizeText(body.mode, 16)
  const email = sanitizeText(body.email, 120).toLowerCase()
  const password = String(body.password ?? '').slice(0, 128)
  const confirmPassword = String(body.confirmPassword ?? '').slice(0, 128)
  const passwordError = validatePassword(password)

  if (mode !== 'login' && mode !== 'register') {
    sendJson(response, 400, { ok: false, error: 'INVALID_MODE' }, { origin: originCheck.origin })
    return
  }

  if (!isValidEmail(email)) {
    sendJson(
      response,
      400,
      { ok: false, error: 'INVALID_EMAIL', message: '请输入有效邮箱地址。' },
      { origin: originCheck.origin },
    )
    return
  }

  if (passwordError) {
    sendJson(
      response,
      400,
      { ok: false, error: 'WEAK_PASSWORD', message: passwordError },
      { origin: originCheck.origin },
    )
    return
  }

  if (hasSuspiciousInput(email, password, confirmPassword)) {
    sendJson(
      response,
      400,
      { ok: false, error: 'SUSPICIOUS_INPUT', message: '输入包含不允许的特殊片段。' },
      { origin: originCheck.origin },
    )
    return
  }

  if (mode === 'register' && password !== confirmPassword) {
    sendJson(
      response,
      400,
      { ok: false, error: 'PASSWORD_MISMATCH', message: '两次输入的密码不一致。' },
      { origin: originCheck.origin },
    )
    return
  }

  try {
    await ensureAuthSchema()

    if (mode === 'register') {
      const existingUser = await findUserByEmail(email)
      if (existingUser) {
        sendJson(
          response,
          409,
          { ok: false, error: 'EMAIL_EXISTS', message: '该邮箱已注册，请直接登录。' },
          { origin: originCheck.origin },
        )
        return
      }

      const user = await createUser(email, password)
      const { token } = await issueSession(user)

      sendAuthSuccess(response, originCheck.origin, request, {
        ok: true,
        message: '注册成功，已自动登录。',
        user: {
          id: user.id,
          email: user.email,
        },
        sessionToken: token,
      })
      return
    }

    const user = await findUserByEmail(email)
    if (!user) {
      sendJson(
        response,
        401,
        { ok: false, error: 'INVALID_CREDENTIALS', message: '邮箱或密码错误。' },
        { origin: originCheck.origin },
      )
      return
    }

    const passwordMatched = await verifyPassword(password, user.password_hash)
    if (!passwordMatched) {
      sendJson(
        response,
        401,
        { ok: false, error: 'INVALID_CREDENTIALS', message: '邮箱或密码错误。' },
        { origin: originCheck.origin },
      )
      return
    }

    const { token } = await issueSession(user)
    sendAuthSuccess(response, originCheck.origin, request, {
      ok: true,
      message: '登录成功。',
      user: {
        id: user.id,
        email: user.email,
      },
      sessionToken: token,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AUTH_FAILED'

    if (message === 'DATABASE_URL_MISSING') {
      sendJson(
        response,
        500,
        { ok: false, error: message, message: '未配置数据库连接，请先在 Vercel 中设置 DATABASE_URL 或 POSTGRES_URL。' },
        { origin: originCheck.origin },
      )
      return
    }

    if (message === 'AUTH_SECRET_MISSING') {
      sendJson(
        response,
        500,
        { ok: false, error: message, message: '未配置 AUTH_SECRET，无法签发登录会话。' },
        { origin: originCheck.origin },
      )
      return
    }

    sendJson(
      response,
      500,
      { ok: false, error: 'AUTH_FAILED', message: '认证服务暂时不可用，请稍后再试。' },
      { origin: originCheck.origin },
    )
  }
}
