# Backend Architecture

This project uses a Vercel-friendly backend split into thin API handlers and shared server modules.

## Layers

1. `api/*.js`
   These are deployment entrypoints only. Each file should stay small and delegate to shared modules.

2. `server/config.js`
   Central runtime configuration for allowed origins, CSRF settings, body size limits, and rate-limit windows.

3. `server/security.js`
   Security middleware helpers:
   - CORS/origin validation
   - CSRF cookie issuance and validation
   - unified secure JSON responses
   - preflight handling

4. `server/http.js`
   HTTP utility helpers:
   - JSON body parsing with size limit
   - client fingerprint extraction
   - in-memory fallback rate limiting

5. `server/validation.js`
   Input sanitization and validation rules shared across routes.

## Current request flow

1. Frontend boots and calls `GET /api/bootstrap`.
2. Backend validates origin and issues:
   - an HttpOnly CSRF cookie
   - a matching CSRF token in JSON response
3. Frontend stores the token in memory.
4. Sensitive POST routes send:
   - `credentials: include`
   - `x-csrf-token` header
5. Backend validates:
   - allowed origin
   - CSRF header vs cookie
   - request rate limit
   - payload shape and field rules

## Current routes

- `GET /api/bootstrap`
- `GET /api/health`
- `POST /api/auth`
- `POST /api/contact`

## Security posture today

Implemented:
- Vercel security headers via `vercel.json`
- strict origin allowlist
- CSRF cookie + header double-submit check
- body size limits
- field sanitization
- rate limiting fallback

Still required for production-grade auth:
- persistent rate limiting via Redis / Upstash / KV
- real user database
- password hashing with Argon2 or bcrypt
- session or JWT issuance and rotation
- CAPTCHA / bot challenge on abuse signals
- audit logging and alerting
- email provider integration for contact flow
- WAF rules and DDoS controls at the platform edge
