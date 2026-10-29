import { Hono } from 'hono'

import { authMode, privateJson } from '../auth'
import { now } from '../db'
import type { AppContext } from '../env'
import type { Me } from '../../shared/types'

export const workspace = new Hono<AppContext>()

async function ensureWorkspace(db: D1Database, owner: string, name: string) {
  const row = await db.prepare(`SELECT name, seeded_at FROM workspaces WHERE owner_sub = ?`).bind(owner).first<{ name: string; seeded_at: number | null }>()
  if (row) return row
  await db.prepare(`INSERT INTO workspaces (owner_sub, name, created_at) VALUES (?, ?, ?)`).bind(owner, name, now()).run()
  // ProjectVault starts with real user-created records, never fabricated CRM samples.
  return { name, seeded_at: null }
}

workspace.get('/me', async (c) => {
  const user = c.get('user')
  const db = c.get('db')
  const ws = await ensureWorkspace(db, user.sub, `${user.name?.split(' ')[0] ?? 'Your'}'s workspace`)
  const body: Me = {
    user: { sub: user.sub, name: user.name, email: user.email, picture: user.picture },
    workspace: { name: ws.name, seededAt: ws.seeded_at },
    capabilities: {
      database: true,
      files: Boolean(c.env.FILES),
      auth: authMode(c.env, c.req.raw),
    },
  }
  return privateJson(c, body)
})

workspace.patch('/workspace', async (c) => {
  const { name } = await c.req.json<{ name?: string }>()
  const clean = name?.trim().slice(0, 60)
  if (!clean) return c.json({ error: 'Name is required.' }, 400)
  await c.get('db').prepare(`UPDATE workspaces SET name = ? WHERE owner_sub = ?`).bind(clean, c.get('user').sub).run()
  return privateJson(c, { ok: true })
})

