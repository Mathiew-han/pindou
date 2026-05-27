import { appConfig } from '../server/config.js'
import { handleOptions, sendJson } from '../server/security.js'

export default function handler(request, response) {
  if (request.method === 'OPTIONS') {
    handleOptions(request, response)
    return
  }

  if (request.method !== 'GET') {
    sendJson(response, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' }, { origin: request.headers.origin })
    return
  }

  sendJson(response, 200, {
    ok: true,
    service: 'bead-pixel-studio-api',
    deployTarget: 'vercel',
    timestamp: new Date().toISOString(),
    checks: {
      databaseConfigured: Boolean(appConfig.databaseUrl),
      authSecretConfigured: Boolean(appConfig.jwtSecret),
      analyticsEnabled: true,
      speedInsightsEnabled: true,
    },
  }, { origin: request.headers.origin })
}
