export interface User {
  sub: string
  name?: string
  email?: string
  email_verified?: boolean
  picture?: string
}

export interface Env {
  ASSETS: Fetcher
  DB?: D1Database
  FILES?: R2Bucket
  AUTH_SECRET?: string
  APP_ORIGIN?: string
}

export type Variables = {
  user: User
  db: D1Database
}

export type AppContext = { Bindings: Env; Variables: Variables }
