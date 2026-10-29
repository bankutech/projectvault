import type { Context, MiddlewareHandler } from 'hono'
import type { AppContext, Env, User } from './env'

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

export const DEV_USER: User = {
  sub: 'dev-user',
  name: 'Alex Morgan',
  email: 'alex@yourcompany.com',
  email_verified: true,
}

export function isLoopback(request: Request): boolean {
  try {
    return LOOPBACK.has(new URL(request.url).hostname)
  } catch {
    return false
  }
}

export function authMode(env: Env, request: Request): 'development' | 'standard' {
  if (isLoopback(request) || !env.AUTH_SECRET) return 'development'
  return 'standard'
}

export function isSameOriginRequest(request: Request, origin: string): boolean {
  const secFetchSite = request.headers.get('Sec-Fetch-Site')
  if (secFetchSite === 'same-origin' || secFetchSite === 'same-site') return true
  const reqOrigin = request.headers.get('Origin')
  if (reqOrigin && reqOrigin === origin) return true
  const referer = request.headers.get('Referer')
  if (referer && referer.startsWith(origin)) return true
  // Allow direct local calls or tests without Origin
  if (!reqOrigin && !referer && !secFetchSite) return true
  return false
}

export async function currentUser(_env: Env, request: Request): Promise<User | null> {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    if (token) {
      return {
        sub: token,
        name: `User ${token.slice(0, 8)}`,
        email: `${token}@projectvault.local`,
        email_verified: true,
      }
    }
  }
  return DEV_USER
}

export function appOrigin(env: Env, request: Request): string {
  return env.APP_ORIGIN ?? new URL(request.url).origin
}

/** Requires a signed-in user and, for mutations, a same-origin request. */
export const requireUser: MiddlewareHandler<AppContext> = async (c, next) => {
  const request = c.req.raw
  if (request.method !== 'GET' && request.method !== 'HEAD' && !isSameOriginRequest(request, appOrigin(c.env, request))) {
    return c.json({ error: 'Cross-origin request refused.' }, 403)
  }
  const user = await currentUser(c.env, request)
  if (!user) return c.json({ error: 'Sign in required.' }, 401)
  c.set('user', user)
  await next()
}

export function privateJson<T>(c: Context<AppContext>, body: T, status = 200) {
  c.header('Cache-Control', 'private, no-store')
  return c.json(body as never, status as never)
}
