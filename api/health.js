import { sendJson } from './_utils.js'

export default function handler(request, response) {
  if (request.method !== 'GET') {
    sendJson(response, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' })
    return
  }

  sendJson(response, 200, {
    ok: true,
    service: 'bead-pixel-studio-api',
    deployTarget: 'vercel',
    timestamp: new Date().toISOString(),
  })
}
