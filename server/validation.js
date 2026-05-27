const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const suspiciousSqlPattern = /('|--|;|\/\*|\*\/|\b(select|insert|update|delete|drop|union|alter|exec|truncate)\b)/i

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

export function validatePassword(password) {
  if (password.length < 8) {
    return '密码至少需要 8 位。'
  }

  if (password.length > 128) {
    return '密码长度不能超过 128 位。'
  }

  if (hasSuspiciousInput(password)) {
    return '输入包含不允许的特殊片段。'
  }

  return ''
}
