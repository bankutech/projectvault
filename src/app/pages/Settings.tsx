import { useState } from 'react'

import { Avatar, Badge, Button, Field, Input, PageHeader, useToast } from '../components/ui'
import { api, useApiMutation, useMe } from '../lib/api'

export function Settings() {
  const { data: me } = useMe()
  const toast = useToast()
  const [name, setName] = useState<string | null>(null)

  const rename = useApiMutation((value: string) => api('/workspace', { method: 'PATCH', json: { name: value } }), ['me'], {
    onSuccess: () => toast('Workspace renamed'),
  })
  if (!me) return null
  const value = name ?? me.workspace.name

  return (
    <div className="mx-auto max-w-[720px] p-5 sm:p-8">
      <PageHeader title="Settings" />

      <section className="mt-8">
        <h2 className="text-[14px] font-semibold">Account</h2>
        <div className="mt-3 flex items-center gap-4 rounded-card border border-line p-4">
          <Avatar name={me.user.name ?? me.user.email ?? 'You'} hue={210} src={me.user.picture} size={48} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium">{me.user.name ?? 'Signed in'}</p>
            {me.user.email && <p className="truncate text-[13px] text-muted">{me.user.email}</p>}
          </div>
          <Badge tone="accent">Developer identity</Badge>
        </div>
        <p className="mt-2 text-[12.5px] text-faint">Local development identity active. Projects and specifications are isolated to your workspace.</p>
      </section>

      <section className="mt-8">
        <h2 className="text-[14px] font-semibold">Workspace</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (value.trim() && value !== me.workspace.name) rename.mutate(value.trim())
          }}
          className="mt-3 flex items-end gap-2"
        >
          <Field label="Name" className="flex-1">
            <Input value={value} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </Field>
          <Button variant="primary" type="submit" loading={rename.isPending} disabled={!value.trim() || value === me.workspace.name}>
            Save
          </Button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-[14px] font-semibold">Connections</h2>
        <ul className="mt-3 divide-y divide-line rounded-card border border-line">
          {[
            ['Database', me.capabilities.database, 'D1 via the DB binding'],
            ['File storage', me.capabilities.files, 'R2 via the FILES binding'],
            ['Authentication', true, 'Local loopback developer session'],
          ].map(([label, ok, detail]) => (
            <li key={label as string} className="flex h-13 items-center gap-3 px-4">
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">{label}</span>
                <span className="block truncate text-[12px] text-faint">{detail}</span>
              </span>
              <Badge tone={ok ? 'success' : 'neutral'} dot>
                {ok ? 'Connected' : 'Not connected'}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-card border border-line p-4">
        <h2 className="text-[14px] font-semibold">Project data</h2>
        <p className="mt-1 text-[13px] text-muted">Projects and export history are stored in the connected database and isolated by your signed-in account. Manage or remove individual projects from the Projects dashboard.</p>
      </section>
    </div>
  )
}
