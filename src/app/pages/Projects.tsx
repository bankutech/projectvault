import { Archive, Clock3, Copy, FolderKanban, Grid2X2, Heart, List, MoreHorizontal, Plus, Search, Sparkles, Upload, X } from 'lucide-react'
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import type { ProjectRecord, ProjectSpecifications, Requirement } from '../../shared/projectvault'
import { STARTER_TEMPLATES } from '../../shared/templates'
import { createProject, deleteProject, duplicateProject, seedStarterProjects, useProjectSave, useProjects } from '../lib/projectvault'
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, Field, Input, Menu, PageHeader, Select, Textarea, useToast } from '../components/ui'

const labels: Record<string, string> = {
  draft: 'Draft',
  planning: 'Planning',
  ready_for_export: 'Ready for export',
  exported: 'Exported',
  in_development: 'In development',
  testing: 'Testing',
  completed: 'Completed',
  archived: 'Archived',
}

const tones: Record<string, 'neutral' | 'accent' | 'success' | 'warning' | 'info'> = {
  draft: 'neutral',
  planning: 'info',
  ready_for_export: 'success',
  exported: 'accent',
  in_development: 'info',
  testing: 'warning',
  completed: 'success',
  archived: 'neutral',
}

const fmt = (n: number | null) => (n ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(n) : 'Never exported')

export function Projects() {
  const navigate = useNavigate()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'modified' | 'name' | 'created' | 'progress'>('modified')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [category, setCategory] = useState('')
  const [completion, setCompletion] = useState('')
  const [tab, setTab] = useState<'all' | 'pinned' | 'archived'>('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [createOpen, setCreateOpen] = useState(false)
  const [deleting, setDeleting] = useState<ProjectRecord | null>(null)
  const [seeding, setSeeding] = useState(false)

  const isArchivedTab = tab === 'archived'
  const projectsQuery = useProjects(query, isArchivedTab)
  const projects = projectsQuery.data?.projects ?? []

  const items = useMemo(() => {
    return projects
      .filter((p) => {
        if (tab === 'pinned' && !p.pinned) return false
        if (status && p.status !== status) return false
        if (priority && p.priority !== priority) return false
        const reqs = p.requirements ?? []
        if (completion === 'done') return reqs.length > 0 && reqs.every((r) => r.completed)
        if (completion === 'todo') return reqs.some((r) => !r.completed)
        return true
      })
      .sort((a, b) => {
        if (sort === 'name') return a.title.localeCompare(b.title)
        if (sort === 'created') return a.createdAt - b.createdAt
        if (sort === 'progress') return progress(b) - progress(a)
        return b.updatedAt - a.updatedAt
      })
  }, [projects, tab, status, priority, category, completion, sort])

  const categories = useMemo(() => [...new Set(projects.map((p) => p.category))].sort(), [projects])

  async function handleCreate(values: {
    title: string
    description: string
    projectCode: string
    category: string
    priority: string
    requirements?: Requirement[]
    specifications?: ProjectSpecifications
  }) {
    try {
      const result = await createProject(values)
      await projectsQuery.refetch()
      setCreateOpen(false)
      toast('Project created successfully')
      navigate(`/projects/${result.project.id}/overview`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create project', 'danger')
    }
  }

  async function handleRemove() {
    if (!deleting) return
    try {
      await deleteProject(deleting.id)
      await projectsQuery.refetch()
      toast('Project permanently deleted')
      setDeleting(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete project', 'danger')
    }
  }

  async function handleDuplicate(p: ProjectRecord) {
    try {
      const result = await duplicateProject(p.id)
      await projectsQuery.refetch()
      toast('Project duplicated')
      navigate(`/projects/${result.project.id}/overview`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not duplicate project', 'danger')
    }
  }

  async function handleSeedTemplates() {
    setSeeding(true)
    try {
      const res = await seedStarterProjects()
      await projectsQuery.refetch()
      toast(res.count > 0 ? `Loaded ${res.count} starter projects (Projects 01-04)` : 'Starter projects already exist')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not load starter projects', 'danger')
    } finally {
      setSeeding(false)
    }
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      if (file.name.toLowerCase().endsWith('.zip')) {
        throw new Error('ZIP import requires extracting its JSON manifest first. Import the included REQUIREMENTS_CHECKLIST.json or PROJECT_MANIFEST.json file instead.')
      }
      const data = JSON.parse(await file.text()) as {
        project?: { name?: string; description?: string; code?: string; category?: string; priority?: string }
        projectId?: string
        requirements?: Requirement[]
        specifications?: ProjectSpecifications
      }
      if (!Array.isArray(data.requirements)) {
        throw new Error('This JSON file does not contain a valid ProjectVault requirements array.')
      }
      const title = data.project?.name ?? `Imported ${file.name.replace(/\.json$/i, '')}`
      const description = data.project?.description ?? `Imported ProjectVault specification package ${data.projectId ? `(${data.projectId})` : ''}`.trim()
      const project = await createProject({
        title,
        description,
        projectCode: data.project?.code ?? '',
        category: data.project?.category ?? 'Imported',
        priority: data.project?.priority ?? 'medium',
        requirements: data.requirements,
        specifications: data.specifications,
      })
      await projectsQuery.refetch()
      toast('Project imported successfully')
      navigate(`/projects/${project.project.id}/overview`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not import project', 'danger')
    }
  }

  return (
    <div className="mx-auto max-w-[1360px] p-4 sm:p-7">
      <PageHeader
        title="ProjectVault"
        subtitle="Manage independent development projects, interactive checklists, and verified Antigravity specification exports."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSeedTemplates} loading={seeding} title="Preload standard Projects 01 to 04">
              <Sparkles className="size-4 text-accent" />
              Load Starter Projects
            </Button>
            <Button title="Import a project JSON manifest" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" />
              Import Package
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importFile} />
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New Project
            </Button>
          </div>
        }
      />

      {/* Metric Cards */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">Active Projects</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{projects.filter((p) => !p.archived).length}</p>
          <p className="mt-1 text-xs text-faint">Isolated workspaces</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">Pinned Projects</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{projects.filter((p) => p.pinned).length}</p>
          <p className="mt-1 text-xs text-faint">Priority focus</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">Recently Opened</p>
          <p className="mt-2 truncate text-sm font-semibold">
            {[...projects].sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))[0]?.title ?? 'None recently opened'}
          </p>
          <p className="mt-1 text-xs text-faint">
            {[...projects].sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))[0]?.projectCode || 'Create or open a project'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">Generated Exports</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{projects.reduce((n, p) => n + p.exportCount, 0)}</p>
          <p className="mt-1 text-xs text-faint">Validated ZIP packages</p>
        </Card>
      </section>

      {/* Tabs & Filters */}
      <section className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setTab('all')}
              className={`rounded-control px-3 py-1.5 text-xs font-medium transition ${tab === 'all' ? 'bg-fg text-bg' : 'text-muted hover:bg-surface-2 hover:text-fg'}`}
            >
              All Projects ({projects.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('pinned')}
              className={`flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-medium transition ${tab === 'pinned' ? 'bg-fg text-bg' : 'text-muted hover:bg-surface-2 hover:text-fg'}`}
            >
              <Heart className="size-3.5 fill-current" />
              Pinned ({projects.filter((p) => p.pinned).length})
            </button>
            <button
              type="button"
              onClick={() => setTab('archived')}
              className={`flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-medium transition ${tab === 'archived' ? 'bg-fg text-bg' : 'text-muted hover:bg-surface-2 hover:text-fg'}`}
            >
              <Archive className="size-3.5" />
              Archived ({projects.filter((p) => p.archived).length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-control border border-line bg-bg p-0.5">
              <Button aria-label="Grid view" variant={view === 'grid' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setView('grid')}>
                <Grid2X2 className="size-4" />
              </Button>
              <Button aria-label="List view" variant={view === 'list' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setView('list')}>
                <List className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects by name, code, category..." className="pl-9" />
          </div>

          <Select className="w-[145px]" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(labels).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </Select>

          <Select className="w-[130px]" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">All priorities</option>
            {['critical', 'high', 'medium', 'low'].map((x) => (
              <option key={x} value={x}>
                {x[0].toUpperCase() + x.slice(1)}
              </option>
            ))}
          </Select>

          <Select className="w-[150px]" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>

          <Select className="w-[150px]" value={completion} onChange={(e) => setCompletion(e.target.value)}>
            <option value="">Any progress</option>
            <option value="done">100% complete</option>
            <option value="todo">Has remaining tasks</option>
          </Select>

          <Select className="w-[155px]" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="modified">Recently modified</option>
            <option value="name">Project Name (A-Z)</option>
            <option value="created">Creation date</option>
            <option value="progress">Checklist progress</option>
          </Select>
        </div>
      </section>

      {projectsQuery.error && <Card className="mt-4 border border-danger/40 p-4 text-sm text-danger">{projectsQuery.error.message}</Card>}

      {projectsQuery.isLoading ? (
        <div className="py-24 text-center text-sm text-muted">Loading projects…</div>
      ) : items.length === 0 ? (
        <Card className="mt-5 p-8 text-center">
          <EmptyState
            icon={<FolderKanban className="size-8" />}
            title={query ? 'No matching projects found' : isArchivedTab ? 'No archived projects' : 'No projects in workspace yet'}
            description={
              query
                ? 'Try adjusting your search keywords or filter dropdowns.'
                : 'Create your first project or load the built-in starter projects (Email Automation, School ERP, AI Portfolio, Student Management) with one click.'
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  <Plus className="size-4" />
                  Create Project
                </Button>
                <Button onClick={handleSeedTemplates} loading={seeding}>
                  <Sparkles className="size-4 text-accent" />
                  Load Projects 01 - 04
                </Button>
              </div>
            }
          />
        </Card>
      ) : view === 'grid' ? (
        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpen={() => navigate(`/projects/${p.id}/overview`)}
              onDuplicate={() => handleDuplicate(p)}
              onDelete={() => setDeleting(p)}
              onRefresh={() => projectsQuery.refetch()}
            />
          ))}
        </section>
      ) : (
        <section className="mt-5 overflow-hidden rounded-card border border-line bg-surface">
          <div className="grid grid-cols-[1fr_130px_130px_130px_110px_40px] gap-3 border-b border-line bg-bg/70 px-4 py-3 text-xs font-semibold text-muted">
            <span>Project</span>
            <span>Category</span>
            <span>Status</span>
            <span>Checklist</span>
            <span>Modified</span>
            <span />
          </div>
          {items.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}/overview`)}
              className="grid cursor-pointer grid-cols-[1fr_130px_130px_130px_110px_40px] items-center gap-3 border-b border-line px-4 py-3 text-sm transition last:border-0 hover:bg-surface-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-semibold">{p.title}</p>
                  {p.pinned && <Heart className="size-3 shrink-0 fill-danger text-danger" />}
                </div>
                <p className="truncate text-xs text-faint">
                  {p.projectCode || `PV-${p.id.slice(0, 8)}`} · {p.id.slice(0, 8)}
                </p>
              </div>
              <span className="truncate text-xs text-muted">{p.category}</span>
              <div>
                <Badge tone={tones[p.status] ?? 'neutral'} dot>
                  {labels[p.status] ?? p.status}
                </Badge>
              </div>
              <div className="text-xs">
                <span className="font-medium tabular-nums">{progress(p)}%</span>
                <span className="text-faint">
                  {' '}
                  ({(p.requirements ?? []).filter((r) => r.completed).length}/{(p.requirements ?? []).length})
                </span>
              </div>
              <span className="text-xs text-faint">{fmt(p.updatedAt)}</span>
              <span onClick={(e) => e.stopPropagation()}>
                <ProjectMenu project={p} onDuplicate={() => handleDuplicate(p)} onDelete={() => setDeleting(p)} onRefresh={() => projectsQuery.refetch()} />
              </span>
            </div>
          ))}
        </section>
      )}

      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreate} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleRemove}
        title={`Delete "${deleting?.title ?? 'project'}"?`}
        description="This permanently removes this project, its requirements checklist, specifications, and all export history. Other projects remain strictly isolated and unaffected."
      />
    </div>
  )
}

function progress(p: ProjectRecord) {
  const reqs = p.requirements ?? []
  return reqs.length ? Math.round((reqs.filter((r) => r.completed).length / reqs.length) * 100) : 0
}

function ProjectCard({
  project: p,
  onOpen,
  onDuplicate,
  onDelete,
  onRefresh,
}: {
  project: ProjectRecord
  onOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
  onRefresh: () => void
}) {
  const save = useProjectSave(p.id)
  const tone = tones[p.status] ?? 'neutral'
  const reqs = p.requirements ?? []
  const doneCount = reqs.filter((r) => r.completed).length
  const totalCount = reqs.length
  const pct = progress(p)

  return (
    <Card className="group cursor-pointer p-4 transition-all hover:-translate-y-0.5 hover:shadow-pop" onClick={onOpen}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-control bg-accent-soft text-accent">
          <FolderKanban className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="truncate text-[15px] font-semibold text-fg">{p.title}</p>
            {p.pinned && <Heart className="size-3.5 shrink-0 fill-danger text-danger" />}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted">
            <span className="font-mono font-medium text-fg">{p.projectCode || `PV-${p.id.slice(0, 8)}`}</span> · {p.category}
          </p>
        </div>
        <span onClick={(e) => e.stopPropagation()}>
          <ProjectMenu project={p} onDuplicate={onDuplicate} onDelete={onDelete} onRefresh={onRefresh} />
        </span>
      </div>

      <p className="mt-3 line-clamp-2 min-h-10 text-[13px] leading-5 text-muted">{p.description || 'Add purpose and requirements to define this project.'}</p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <Badge tone={tone} dot>
          {labels[p.status] ?? p.status}
        </Badge>
        <span className="text-xs text-faint">
          {reqs.filter((r) => !r.completed).length} remaining of {totalCount}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs">
          <span className="text-muted">Checklist Progress</span>
          <span className="font-medium tabular-nums">{pct}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-faint">
          <span>
            {doneCount} of {totalCount} items verified
          </span>
          {reqs.some((r) => r.unresolved) && <span className="font-medium text-warning">Needs clarification</span>}
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[11px] text-faint">
        <span className="flex items-center gap-1">
          <Clock3 className="size-3" />
          {fmt(p.updatedAt)}
        </span>
        <span className={p.lastExportOutdated ? 'font-medium text-warning' : p.lastExportAt ? 'text-success' : 'text-faint'}>
          {p.lastExportOutdated ? 'Export outdated' : p.lastExportAt ? `Export v${p.exportCount}` : 'Not exported'}
        </span>
      </div>

      {save.error && <p className="mt-2 text-xs text-danger">{save.error.message}</p>}
    </Card>
  )
}

function ProjectMenu({
  project: p,
  onDuplicate,
  onDelete,
  onRefresh,
}: {
  project: ProjectRecord
  onDuplicate: () => void
  onDelete: () => void
  onRefresh: () => void
}) {
  const save = useProjectSave(p.id)
  return (
    <Menu
      trigger={
        <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${p.title}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      }
      items={[
        {
          label: p.pinned ? 'Unpin project' : 'Pin to favorites',
          icon: <Heart className="size-4" />,
          onSelect: async () => {
            await save.mutateAsync({ pinned: !p.pinned })
            onRefresh()
          },
        },
        {
          label: p.archived ? 'Restore from archive' : 'Archive project',
          icon: <Archive className="size-4" />,
          onSelect: async () => {
            await save.mutateAsync({ archived: !p.archived })
            onRefresh()
          },
        },
        {
          label: 'Duplicate project',
          icon: <Copy className="size-4" />,
          onSelect: onDuplicate,
        },
        {
          label: 'Delete project',
          danger: true,
          icon: <X className="size-4" />,
          onSelect: onDelete,
        },
      ]}
    />
  )
}

function CreateDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (value: {
    title: string
    description: string
    projectCode: string
    category: string
    priority: string
    requirements?: Requirement[]
    specifications?: ProjectSpecifications
  }) => void
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('custom')
  const [form, setForm] = useState({
    title: '',
    description: '',
    projectCode: '',
    category: 'Web application',
    priority: 'medium',
  })

  function onSelectTemplate(tplId: string) {
    setSelectedTemplateId(tplId)
    if (tplId === 'custom') {
      setForm({
        title: '',
        description: '',
        projectCode: '',
        category: 'Web application',
        priority: 'medium',
      })
      return
    }
    const tpl = STARTER_TEMPLATES.find((t) => t.id === tplId)
    if (tpl) {
      setForm({
        title: tpl.title,
        description: tpl.description,
        projectCode: tpl.projectCode,
        category: tpl.category,
        priority: tpl.priority,
      })
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const tpl = STARTER_TEMPLATES.find((t) => t.id === selectedTemplateId)
    onCreate({
      ...form,
      requirements: tpl?.requirements,
      specifications: tpl?.specifications,
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create New Project"
      description="Create an independent workspace with its own requirements, design decisions, and Antigravity specification package."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="vault-create">
            Create Project
          </Button>
        </>
      }
    >
      <form id="vault-create" className="grid gap-4" onSubmit={submit}>
        <Field label="Starter Template / Preset">
          <Select value={selectedTemplateId} onChange={(e) => onSelectTemplate(e.target.value)}>
            <option value="custom">Custom Blank Project</option>
            {STARTER_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.projectCode})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Project Name">
          <Input required maxLength={160} autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Email Automation Platform" />
        </Field>

        <Field label="Short Purpose / Description">
          <Textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What should this project accomplish? What problem does it solve?"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Project Code / ID">
            <Input maxLength={64} value={form.projectCode} onChange={(e) => setForm({ ...form, projectCode: e.target.value })} placeholder="e.g. PV-01, ERP-02" />
          </Field>
          <Field label="Category">
            <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Full-Stack, Backend, 3D" />
          </Field>
        </div>

        <Field label="Priority Level">
          <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {['critical', 'high', 'medium', 'low'].map((x) => (
              <option key={x} value={x}>
                {x[0].toUpperCase() + x.slice(1)}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Dialog>
  )
}
