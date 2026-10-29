import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  CircleAlert,
  Clipboard,
  Clock3,
  Download,
  Layers3,
  ListChecks,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { ProjectSpecifications, Requirement } from '../../shared/projectvault'
import { REUSABLE_REQUIREMENT_PRESETS } from '../../shared/templates'
import {
  blankSpecifications,
  downloadProjectExport,
  newRequirement,
  useProject,
  useProjectCompare,
  useProjectExports,
  useProjectPrompt,
  useProjectSave,
  useReadiness,
} from '../lib/projectvault'
import { Badge, Button, Card, Checkbox, ConfirmDialog, Dialog, EmptyState, Field, Input, Select, Spinner, Textarea, useToast } from '../components/ui'

const sections = [
  ['overview', 'Overview'],
  ['requirements', 'Requirements Checklist'],
  ['product', 'Product Specification'],
  ['uiux', 'UI/UX Requirements'],
  ['frontend', 'Frontend Specification'],
  ['backend', 'Backend Specification'],
  ['database', 'Database Design'],
  ['auth', 'Authentication & Authorization'],
  ['security', 'Security Requirements'],
  ['integrations', 'Integrations & APIs'],
  ['workflows', 'Business Logic & Workflows'],
  ['architecture', 'Architecture & File Structure'],
  ['testing', 'Testing & Acceptance'],
  ['deployment', 'Deployment Instructions'],
  ['decisions', 'Development Notes & Decisions'],
  ['bugs', 'Bugs & Limitations'],
  ['prompt', 'Antigravity Prompt Builder'],
  ['exports', 'Export Center'],
  ['history', 'Version History'],
] as const

export type SectionTab = (typeof sections)[number][0]

export function ProjectWorkspace() {
  const { id: projectId, section = 'overview' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const projectQuery = useProject(projectId)
  const p = projectQuery.data?.project
  const save = useProjectSave(projectId ?? '')
  const readiness = useReadiness(projectId)
  const promptQuery = useProjectPrompt(projectId)
  const historyQuery = useProjectExports(projectId)

  // Working drafts for unsaved edits
  const [draft, setDraft] = useState<Requirement[]>([])
  const [specDraft, setSpecDraft] = useState<ProjectSpecifications>(blankSpecifications())
  const [dirty, setDirty] = useState(false)

  // Checklist local filters & helpers
  const [reqSearch, setReqSearch] = useState('')
  const [reqCategory, setReqCategory] = useState('')
  const [reqPriority, setReqPriority] = useState('')
  const [reqStatus, setReqStatus] = useState('')
  const [deletingReqIndex, setDeletingReqIndex] = useState<number | null>(null)
  const [presetsOpen, setPresetsOpen] = useState(false)

  // Export center state
  const [exportMode, setExportMode] = useState<'specification' | 'source'>('specification')
  const [exportBusy, setExportBusy] = useState(false)
  const [exportSummary, setExportSummary] = useState<{ warnings: string[]; passed: string[]; unavailable: string[] } | null>(null)

  // Prompt state
  const [promptTab, setPromptTab] = useState<'master' | 'phase1' | 'phase2' | 'phase3' | 'phase4' | 'phase5' | 'phase6'>('master')

  // History comparison state
  const [comparingExportId, setComparingExportId] = useState<string | null>(null)

  useEffect(() => {
    if (p) {
      setDraft(p.requirements)
      setSpecDraft(p.specifications)
      setDirty(false)
    }
  }, [p?.id, p?.updatedAt])

  const currentSection = sections.find(([key]) => key === section)?.[1] ?? 'Overview'
  const doneCount = draft.filter((x) => x.completed).length
  const totalCount = draft.length
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0
  const checks = readiness.data?.checks ?? []
  const unresolvedCount = draft.filter((r) => r.selected && r.unresolved).length

  // Filtered requirements list
  const filteredRequirements = useMemo(() => {
    return draft
      .map((r, originalIndex) => ({ r, originalIndex }))
      .filter(({ r }) => {
        if (reqSearch) {
          const q = reqSearch.toLowerCase()
          const matchTitle = r.title.toLowerCase().includes(q)
          const matchDesc = r.description.toLowerCase().includes(q)
          const matchId = r.id.toLowerCase().includes(q)
          if (!matchTitle && !matchDesc && !matchId) return false
        }
        if (reqCategory && r.category !== reqCategory) return false
        if (reqPriority && r.priority !== reqPriority) return false
        if (reqStatus === 'completed' && !r.completed) return false
        if (reqStatus === 'pending' && r.completed) return false
        if (reqStatus === 'selected' && !r.selected) return false
        if (reqStatus === 'unresolved' && !r.unresolved) return false
        return true
      })
  }, [draft, reqSearch, reqCategory, reqPriority, reqStatus])

  async function persist(extra: Record<string, unknown> = {}) {
    if (!p) return
    try {
      await save.mutateAsync({
        requirements: draft,
        specifications: specDraft,
        ...extra,
      })
      setDirty(false)
      toast('Workspace changes saved successfully')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save changes', 'danger')
    }
  }

  function updateRequirement(index: number, patch: Partial<Requirement>) {
    setDraft((old) => old.map((r, i) => (i === index ? { ...r, ...patch } : r)))
    setDirty(true)
  }

  function addRequirement() {
    setDraft((old) => [...old, newRequirement(old.length)])
    setDirty(true)
  }

  function removeRequirement(index: number) {
    setDraft((old) =>
      old
        .filter((_, i) => i !== index)
        .map((r, i) => ({
          ...r,
          id: `REQ-${String(i + 1).padStart(3, '0')}`,
        })),
    )
    setDirty(true)
    setDeletingReqIndex(null)
  }

  function applyPreset(presetName: string) {
    const preset = REUSABLE_REQUIREMENT_PRESETS.find((pr) => pr.name === presetName)
    if (!preset) return
    setDraft((old) => {
      const startIdx = old.length
      const newItems: Requirement[] = preset.requirements.map((item, i) => ({
        ...item,
        id: `REQ-${String(startIdx + i + 1).padStart(3, '0')}`,
      }))
      return [...old, ...newItems]
    })
    setDirty(true)
    setPresetsOpen(false)
    toast(`Added "${preset.name}" requirements`)
  }

  function updateSpec(key: keyof ProjectSpecifications, value: string | boolean) {
    setSpecDraft((s) => ({ ...s, [key]: value }))
    setDirty(true)
  }

  async function handleExportZip() {
    if (!p) return
    setExportBusy(true)
    try {
      const result = await downloadProjectExport(p.id, exportMode)
      await Promise.all([historyQuery.refetch(), projectQuery.refetch()])
      const val = JSON.parse(result.validation) as { warnings?: string[]; passed?: string[]; unavailable?: string[] }
      setExportSummary({
        warnings: val.warnings ?? [],
        passed: val.passed ?? [],
        unavailable: val.unavailable ?? [],
      })
      toast('Project specification package downloaded (.zip)')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed', 'danger')
    } finally {
      setExportBusy(false)
    }
  }

  if (projectQuery.isLoading) {
    return (
      <div className="grid h-96 place-items-center">
        <Spinner />
      </div>
    )
  }

  if (projectQuery.error || !p) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <EmptyState
          icon={<CircleAlert className="size-8" />}
          title="Project Workspace Unavailable"
          description={projectQuery.error?.message ?? 'This project may have been deleted, or server-side authorization refused access.'}
          action={
            <Button onClick={() => navigate('/projects')}>
              <ArrowLeft className="size-4" />
              Return to Projects Dashboard
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1360px] p-4 sm:p-7">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs text-muted">
        <Link className="transition hover:text-fg" to="/projects">
          Projects
        </Link>
        <ChevronRight className="size-3.5 text-faint" />
        <span className="max-w-[200px] truncate font-mono font-medium text-fg">{p.projectCode || `PV-${p.id.slice(0, 8)}`}</span>
        <ChevronRight className="size-3.5 text-faint" />
        <span className="truncate font-semibold text-fg">{currentSection}</span>
      </nav>

      {/* Workspace Header */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
        <div className="min-w-0">
          <button onClick={() => navigate('/projects')} className="mb-1.5 inline-flex items-center gap-1 text-xs text-muted transition hover:text-fg">
            <ArrowLeft className="size-3.5" />
            All Projects
          </button>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-2xl font-bold tracking-tight text-fg">{p.title}</h1>
            <Badge tone={p.status === 'ready_for_export' ? 'success' : p.status === 'exported' ? 'accent' : 'neutral'} dot>
              {p.status.replaceAll('_', ' ')}
            </Badge>
            {p.pinned && <Badge tone="neutral">Pinned</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted">
            <span className="font-mono text-fg">{p.id}</span> · {p.category} · Specification v{p.specificationVersion} · Last modified {new Date(p.updatedAt).toLocaleString()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => persist()} disabled={!dirty || save.isPending} loading={save.isPending} variant={dirty ? 'primary' : 'secondary'}>
            <Check className="size-4" />
            {dirty ? 'Save Changes *' : 'Changes Saved'}
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/projects/${p.id}/exports`)}>
            <Download className="size-4" />
            Export Center
          </Button>
        </div>
      </header>

      {dirty && (
        <div className="mt-3 flex items-center justify-between rounded-control border border-warning/40 bg-warning-soft px-3.5 py-2 text-xs text-warning">
          <span className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            You have unsaved changes in this workspace. Click "Save Changes" before exporting or running prompts.
          </span>
          <Button size="sm" onClick={() => persist()} loading={save.isPending}>
            Save Now
          </Button>
        </div>
      )}

      {/* Main Layout: 19-Section Sidebar + Content View */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        {/* Navigation Sidebar */}
        <aside className="scrollbar-thin max-h-[75vh] overflow-y-auto rounded-card border border-line bg-surface/50 p-2">
          <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">Project Sections</p>
          <nav className="space-y-0.5">
            {sections.map(([key, label], idx) => {
              const active = section === key
              return (
                <Link
                  key={key}
                  to={`/projects/${p.id}/${key}`}
                  className={`flex items-center justify-between rounded-control px-2.5 py-2 text-xs font-medium transition ${
                    active ? 'bg-surface text-fg shadow-card' : 'text-muted hover:bg-surface-2 hover:text-fg'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="w-4 text-[11px] font-mono text-faint">{idx + 1}</span>
                    <span className="truncate">{label}</span>
                  </span>
                  {key === 'requirements' && (
                    <span className="ml-1 rounded-full bg-raised px-1.5 py-0.2 text-[10px] font-mono text-faint">{draft.length}</span>
                  )}
                  {key === 'exports' && (
                    <span className="ml-1 rounded-full bg-raised px-1.5 py-0.2 text-[10px] font-mono text-faint">{p.exportCount}</span>
                  )}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Section View */}
        <main className="min-w-0 space-y-4">
          {/* SECTION 1: OVERVIEW */}
          {section === 'overview' && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard label="Requirements Progress" value={`${pct}%`} note={`${doneCount} complete of ${totalCount} items`} />
                <MetricCard
                  label="Specification Version"
                  value={`v${p.specificationVersion}`}
                  note={p.lastExportOutdated ? 'Outdated since export' : 'Current with export'}
                  highlight={p.lastExportOutdated}
                />
                <MetricCard
                  label="Export Packages"
                  value={String(p.exportCount)}
                  note={p.lastExportAt ? `Last: ${new Date(p.lastExportAt).toLocaleDateString()}` : 'Never exported'}
                />
              </div>

              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-fg">Project Identity & Parameters</h2>
                    <p className="mt-0.5 text-xs text-muted">Core identification attributes isolated to this project only.</p>
                  </div>
                  <Badge tone={p.status === 'ready_for_export' ? 'success' : 'neutral'}>{p.status.replaceAll('_', ' ')}</Badge>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Project Name">
                    <Input value={p.title} onChange={(e) => void save.mutate({ title: e.target.value })} />
                  </Field>
                  <Field label="Project Code / ID">
                    <Input defaultValue={p.projectCode} onBlur={(e) => e.target.value !== p.projectCode && void save.mutate({ projectCode: e.target.value })} />
                  </Field>
                  <Field label="Short Purpose / Summary">
                    <Textarea defaultValue={p.description} onBlur={(e) => e.target.value !== p.description && void save.mutate({ description: e.target.value })} />
                  </Field>
                  <Field label="Detailed Purpose">
                    <Textarea value={specDraft.purpose} onChange={(e) => updateSpec('purpose', e.target.value)} placeholder="User problem and desired outcome" />
                  </Field>
                  <Field label="Technology Stack Choice">
                    <Input
                      value={specDraft.stack}
                      onChange={(e) => updateSpec('stack', e.target.value)}
                      placeholder="e.g. React 19, TypeScript, Hono, Cloudflare D1 / PostgreSQL"
                    />
                  </Field>
                  <div className="flex items-center gap-3 pt-6">
                    <label className="flex items-center gap-2 text-xs font-medium text-fg">
                      <Checkbox checked={specDraft.stackUndecided} onChange={(e) => updateSpec('stackUndecided', e.target.checked)} />
                      Stack is explicitly undecided (instructs Antigravity to evaluate options)
                    </label>
                  </div>
                </div>
              </Card>

              {/* Readiness Scorecard */}
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-fg">Project Export Readiness</h2>
                    <p className="mt-0.5 text-xs text-muted">Checks required before packaging for Antigravity implementation.</p>
                  </div>
                  <Badge tone={readiness.data?.ready ? 'success' : 'warning'}>{readiness.data?.ready ? 'Ready for Export' : 'Review Needed'}</Badge>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {checks.map((chk) => (
                    <div key={chk.key} className="flex items-start gap-2 rounded-tile border border-line bg-surface-2/40 p-2 text-xs">
                      <span className={chk.complete ? 'text-success font-bold' : chk.critical ? 'text-danger font-bold' : 'text-warning'}>
                        {chk.complete ? '✓' : chk.critical ? '!' : '○'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-fg">{chk.label}</span>
                        {chk.critical && <span className="ml-1.5 text-[10px] font-bold text-danger">CRITICAL</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {unresolvedCount > 0 && (
                  <p className="mt-4 rounded-control bg-warning-soft p-3 text-xs text-warning">
                    ⚠️ {unresolvedCount} selected requirement(s) are marked as needing clarification. Review them in the Requirements Checklist.
                  </p>
                )}
              </Card>
            </div>
          )}

          {/* SECTION 2: REQUIREMENTS CHECKLIST */}
          {section === 'requirements' && (
            <div className="space-y-4">
              <Card className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-fg">Persistent Requirements Checklist</h2>
                    <p className="mt-0.5 text-xs text-muted">
                      Every selected requirement directly influences the generated project specification and Antigravity prompt.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setPresetsOpen(true)}>
                      <Sparkles className="size-4 text-accent" />
                      Insert Preset Checklist
                    </Button>
                    <Button variant="primary" onClick={addRequirement}>
                      <Plus className="size-4" />
                      Add Requirement
                    </Button>
                  </div>
                </div>

                {/* Filters */}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
                    <Input
                      type="search"
                      value={reqSearch}
                      onChange={(e) => setReqSearch(e.target.value)}
                      placeholder="Filter by title, description, or ID..."
                      className="pl-8 text-xs"
                    />
                  </div>

                  <Select className="w-[170px] text-xs" value={reqCategory} onChange={(e) => setReqCategory(e.target.value)}>
                    <option value="">All Categories</option>
                    {[
                      'Product and business logic',
                      'UI/UX and accessibility',
                      'Frontend',
                      'Backend',
                      'Database',
                      'Authentication',
                      'Security and privacy',
                      'Performance',
                      'Testing',
                      'Deployment',
                      'Integrations',
                      'Data export and recovery',
                      'Project-specific requirements',
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>

                  <Select className="w-[125px] text-xs" value={reqPriority} onChange={(e) => setReqPriority(e.target.value)}>
                    <option value="">All Priorities</option>
                    {['critical', 'high', 'medium', 'low'].map((p) => (
                      <option key={p} value={p}>
                        {p[0].toUpperCase() + p.slice(1)}
                      </option>
                    ))}
                  </Select>

                  <Select className="w-[140px] text-xs" value={reqStatus} onChange={(e) => setReqStatus(e.target.value)}>
                    <option value="">All Statuses</option>
                    <option value="selected">Selected for Prompt</option>
                    <option value="completed">Completed Only</option>
                    <option value="pending">Pending Only</option>
                    <option value="unresolved">Needs Clarification</option>
                  </Select>
                </div>
              </Card>

              {draft.length === 0 ? (
                <Card className="p-8 text-center">
                  <EmptyState
                    icon={<ListChecks className="size-8" />}
                    title="No Requirements in Project"
                    description="Build a persistent requirements checklist or import a standard preset."
                    action={
                      <div className="flex gap-2">
                        <Button variant="primary" onClick={addRequirement}>
                          <Plus className="size-4" />
                          Add First Requirement
                        </Button>
                        <Button onClick={() => setPresetsOpen(true)}>Insert Standard Presets</Button>
                      </div>
                    }
                  />
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredRequirements.map(({ r, originalIndex }) => (
                    <RequirementCard
                      key={`${r.id}-${originalIndex}`}
                      requirement={r}
                      allRequirements={draft}
                      onUpdate={(patch) => updateRequirement(originalIndex, patch)}
                      onDelete={() => setDeletingReqIndex(originalIndex)}
                    />
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="primary" onClick={() => persist()} loading={save.isPending}>
                  <Check className="size-4" />
                  Save Checklist
                </Button>
              </div>

              {/* Confirm Requirement Deletion */}
              <ConfirmDialog
                open={deletingReqIndex !== null}
                onClose={() => setDeletingReqIndex(null)}
                onConfirm={() => deletingReqIndex !== null && removeRequirement(deletingReqIndex)}
                title="Remove Requirement?"
                description="This requirement will be removed from this project's specification. Other projects are completely unaffected."
              />

              {/* Insert Presets Dialog */}
              <Dialog
                open={presetsOpen}
                onClose={() => setPresetsOpen(false)}
                title="Insert Requirement Preset"
                description="Append standard production-ready requirements to your checklist."
                footer={<Button onClick={() => setPresetsOpen(false)}>Close</Button>}
              >
                <div className="space-y-3">
                  {REUSABLE_REQUIREMENT_PRESETS.map((pr) => (
                    <div key={pr.name} className="flex items-start justify-between gap-3 rounded-tile border border-line p-3">
                      <div>
                        <p className="text-sm font-semibold text-fg">{pr.name}</p>
                        <p className="mt-0.5 text-xs text-muted">{pr.description}</p>
                        <p className="mt-1 text-[11px] text-faint">{pr.requirements.length} requirements</p>
                      </div>
                      <Button size="sm" onClick={() => applyPreset(pr.name)}>
                        Insert
                      </Button>
                    </div>
                  ))}
                </div>
              </Dialog>
            </div>
          )}

          {/* SECTIONS 3 - 16: SPECIFICATION SECTIONS */}
          {section === 'product' && (
            <SpecEditor
              title="Product Specification"
              subtitle="Define product objectives, feature requirements, user roles, and explicit exclusions."
              onSave={() => persist()}
              isSaving={save.isPending}
            >
              <Field label="Project Purpose">
                <Textarea value={specDraft.purpose} onChange={(e) => updateSpec('purpose', e.target.value)} placeholder="User problem and primary value proposition" />
              </Field>
              <Field label="High-Level Objectives & Goals">
                <Textarea value={specDraft.objectives} onChange={(e) => updateSpec('objectives', e.target.value)} placeholder="Measurable milestones and success targets" />
              </Field>
              <Field label="Core Features List">
                <Textarea
                  value={specDraft.features}
                  onChange={(e) => updateSpec('features', e.target.value)}
                  placeholder="Essential user capabilities and functionality"
                  rows={4}
                />
              </Field>
              <Field label="Explicit Exclusions">
                <Textarea
                  value={specDraft.exclusions}
                  onChange={(e) => updateSpec('exclusions', e.target.value)}
                  placeholder="Features or integrations that are explicitly NOT in scope"
                />
              </Field>
            </SpecEditor>
          )}

          {section === 'uiux' && (
            <SpecEditor
              title="UI/UX Requirements & Accessibility"
              subtitle="Specify visual direction, responsive breakpoints, accessibility (WCAG AA), and UI states."
              onSave={() => persist()}
              isSaving={save.isPending}
            >
              <Field label="Visual Direction & Aesthetics">
                <Textarea
                  value={specDraft.uiux}
                  onChange={(e) => updateSpec('uiux', e.target.value)}
                  placeholder="Design system, color palette, typography, micro-interactions, dark/light mode"
                  rows={4}
                />
              </Field>
            </SpecEditor>
          )}

          {section === 'frontend' && (
            <SpecEditor
              title="Frontend Specification"
              subtitle="Framework choices, component architecture, state management, and validation."
              onSave={() => persist()}
              isSaving={save.isPending}
            >
              <Field label="Frontend Architecture">
                <Textarea
                  value={specDraft.frontend}
                  onChange={(e) => updateSpec('frontend', e.target.value)}
                  placeholder="React/Next.js/Vite, router, state stores, form validation libraries, and UI component conventions"
                  rows={6}
                />
              </Field>
            </SpecEditor>
          )}

          {section === 'backend' && (
            <SpecEditor
              title="Backend Specification"
              subtitle="API endpoints, routing, authorization, request/response models, and error envelopes."
              onSave={() => persist()}
              isSaving={save.isPending}
            >
              <Field label="Backend Architecture & API Endpoints">
                <Textarea
                  value={specDraft.backend}
                  onChange={(e) => updateSpec('backend', e.target.value)}
                  placeholder="Hono/Node/Workers framework, REST/GraphQL endpoints, parameter validation, and status code conventions"
                  rows={6}
                />
              </Field>
              <Field label="User Roles & Permissions Matrix">
                <Textarea
                  value={specDraft.roles}
                  onChange={(e) => updateSpec('roles', e.target.value)}
                  placeholder="User roles (e.g. Admin, Member, Auditor) and granted capabilities"
                />
              </Field>
            </SpecEditor>
          )}

          {section === 'database' && (
            <SpecEditor
              title="Database Design & Schema"
              subtitle="Database engine, schema entities, foreign key relationships, indexes, and migrations."
              onSave={() => persist()}
              isSaving={save.isPending}
            >
              <Field label="Database Technology & Schema Design">
                <Textarea
                  value={specDraft.database}
                  onChange={(e) => updateSpec('database', e.target.value)}
                  placeholder="PostgreSQL / D1 / SQLite, tables, columns, foreign keys, unique constraints, and indexes"
                  rows={6}
                />
              </Field>
            </SpecEditor>
          )}

          {section === 'auth' && (
            <SpecEditor
              title="Authentication & Authorization"
              subtitle="Session management, OIDC/OAuth, role-based access control, and project scoping."
              onSave={() => persist()}
              isSaving={save.isPending}
            >
              <Field label="Authentication & Access Control Rules">
                <Textarea
                  value={specDraft.auth}
                  onChange={(e) => updateSpec('auth', e.target.value)}
                  placeholder="Session cookies/JWT, OAuth providers, same-origin guards, and multi-tenant isolation"
                  rows={5}
                />
              </Field>
            </SpecEditor>
          )}

          {section === 'security' && (
            <SpecEditor
              title="Security & Privacy Requirements"
              subtitle="Threat boundaries, secret handling, input sanitization, CSRF/CORS, and audit logging."
              onSave={() => persist()}
              isSaving={save.isPending}
            >
              <Field label="Security Controls & Secret Management">
                <Textarea
                  value={specDraft.security}
                  onChange={(e) => updateSpec('security', e.target.value)}
                  placeholder="No hardcoded secrets, environment variables only, HMAC verification, rate limits, CSP headers"
                  rows={6}
                />
              </Field>
            </SpecEditor>
          )}

          {section === 'integrations' && (
            <SpecEditor
              title="Integrations & Third-Party APIs"
              subtitle="External service contracts, webhook ingestion, and variable documentation."
              onSave={() => persist()}
              isSaving={save.isPending}
            >
              <Field label="Third-Party Integrations">
                <Textarea
                  value={specDraft.integrations}
                  onChange={(e) => updateSpec('integrations', e.target.value)}
                  placeholder="Stripe, SendGrid, Amazon SES, Twilio, GitHub API contracts and webhooks"
                  rows={6}
                />
              </Field>
            </SpecEditor>
          )}

          {section === 'workflows' && (
            <SpecEditor
              title="Business Logic & User Workflows"
              subtitle="Step-by-step user journeys, business rules, and atomic execution steps."
              onSave={() => persist()}
              isSaving={save.isPending}
            >
              <Field label="User Workflows">
                <Textarea
                  value={specDraft.workflows}
                  onChange={(e) => updateSpec('workflows', e.target.value)}
                  placeholder="Step-by-step user journey from entry to outcome"
                  rows={4}
                />
              </Field>
              <Field label="Business Rules & Invariants">
                <Textarea
                  value={specDraft.businessLogic}
                  onChange={(e) => updateSpec('businessLogic', e.target.value)}
                  placeholder="Hard constraints (e.g. 12-seat capacity limits, refund windows, rate limits)"
                  rows={4}
                />
              </Field>
            </SpecEditor>
          )}

          {section === 'architecture' && (
            <SpecEditor
              title="Architecture & File Structure"
              subtitle="Layer boundaries, directory layout, and repository conventions."
              onSave={() => persist()}
              isSaving={save.isPending}
            >
              <Field label="Repository & Directory Blueprint">
                <Textarea
                  value={specDraft.architecture}
                  onChange={(e) => updateSpec('architecture', e.target.value)}
                  placeholder="src/app, src/worker, src/shared, components, routes, database migrations"
                  rows={6}
                />
              </Field>
            </SpecEditor>
          )}

          {section === 'testing' && (
            <SpecEditor
              title="Testing & Acceptance Criteria"
              subtitle="Test levels (Unit, Integration, E2E), fixtures, and verification standards."
              onSave={() => persist()}
              isSaving={save.isPending}
            >
              <Field label="Testing Strategy & Acceptance Matrix">
                <Textarea
                  value={specDraft.testing}
                  onChange={(e) => updateSpec('testing', e.target.value)}
                  placeholder="Node test runner / Vitest suites, API contract testing, concurrency tests, and build checks"
                  rows={6}
                />
              </Field>
            </SpecEditor>
          )}

          {section === 'deployment' && (
            <SpecEditor
              title="Deployment & Environment Variables"
              subtitle="Target platform, build commands, migrations, and safe environment documentation."
              onSave={() => persist()}
              isSaving={save.isPending}
            >
              <Field label="Deployment Blueprint">
                <Textarea
                  value={specDraft.deployment}
                  onChange={(e) => updateSpec('deployment', e.target.value)}
                  placeholder="Target (Cloudflare Workers / Docker / Vercel), build scripts, safe .env variable examples (no secrets!)"
                  rows={6}
                />
              </Field>
            </SpecEditor>
          )}

          {section === 'decisions' && (
            <SpecEditor
              title="Development Notes & Key Decisions"
              subtitle="Ordered implementation phasing sequence and architectural trade-offs."
              onSave={() => persist()}
              isSaving={save.isPending}
            >
              <Field label="Ordered Implementation Sequence">
                <Textarea
                  value={specDraft.implementationOrder}
                  onChange={(e) => updateSpec('implementationOrder', e.target.value)}
                  placeholder="Phase 1: DB Schema, Phase 2: Core API, Phase 3: UI, Phase 4: Verification"
                  rows={4}
                />
              </Field>
              <Field label="Recorded Decisions & Rationale">
                <Textarea
                  value={specDraft.decisions}
                  onChange={(e) => updateSpec('decisions', e.target.value)}
                  placeholder="Why specific libraries or design decisions were made"
                  rows={4}
                />
              </Field>
            </SpecEditor>
          )}

          {section === 'bugs' && (
            <SpecEditor
              title="Bugs, Limitations & Open Decisions"
              subtitle="Known technical debt, unresolved questions, and complexity estimate."
              onSave={() => persist()}
              isSaving={save.isPending}
            >
              <Field label="Unresolved Questions & Assumptions">
                <Textarea
                  value={specDraft.unresolved}
                  onChange={(e) => updateSpec('unresolved', e.target.value)}
                  placeholder="Questions requiring user or client clarification before implementation"
                  rows={3}
                />
              </Field>
              <Field label="Known Limitations">
                <Textarea
                  value={specDraft.bugs}
                  onChange={(e) => updateSpec('bugs', e.target.value)}
                  placeholder="Known constraints, external dependencies, or provider sandbox limits"
                  rows={3}
                />
              </Field>
              <Field label="Estimated Implementation Complexity">
                <Input value={specDraft.complexity} onChange={(e) => updateSpec('complexity', e.target.value)} placeholder="e.g. Medium (approx. 3-4 weeks)" />
              </Field>
            </SpecEditor>
          )}

          {/* SECTION 17: ANTIGRAVITY PROMPT BUILDER */}
          {section === 'prompt' && (
            <div className="space-y-4">
              <Card className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-fg">Antigravity Implementation Prompts</h2>
                    <p className="mt-0.5 text-xs text-muted">
                      Derived directly from saved project specifications, requirements checklist, and acceptance criteria.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        const textToCopy = promptQuery.data?.prompt ?? ''
                        void navigator.clipboard
                          .writeText(textToCopy)
                          .then(() => toast('Prompt copied to clipboard'))
                          .catch(() => toast('Clipboard unavailable', 'danger'))
                      }}
                    >
                      <Clipboard className="size-4" />
                      Copy Master Prompt
                    </Button>
                    <Button
                      onClick={() => {
                        const textToDownload = promptQuery.data?.prompt ?? ''
                        const blob = new Blob([textToDownload], { type: 'text/markdown;charset=utf-8' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `ANTIGRAVITY_MASTER_PROMPT_${p.projectCode || p.id.slice(0, 8)}.md`
                        document.body.appendChild(a)
                        a.click()
                        a.remove()
                        URL.revokeObjectURL(url)
                        toast('Downloaded prompt markdown')
                      }}
                    >
                      <Download className="size-4" />
                      Download .md
                    </Button>
                    <Button onClick={() => promptQuery.refetch()}>
                      <RefreshCw className="size-4" />
                      Regenerate
                    </Button>
                  </div>
                </div>

                {/* Phase Selection Tabs */}
                <div className="mt-4 flex flex-wrap gap-1 border-b border-line pb-3 text-xs">
                  {[
                    ['master', 'Master Prompt'],
                    ['phase1', '01. Planning'],
                    ['phase2', '02. Foundation'],
                    ['phase3', '03. Core Implementation'],
                    ['phase4', '04. Integrations & Security'],
                    ['phase5', '05. Testing & Refinement'],
                    ['phase6', '06. Verification'],
                  ].map(([tabKey, tabLabel]) => (
                    <button
                      key={tabKey}
                      onClick={() => setPromptTab(tabKey as typeof promptTab)}
                      className={`rounded-control px-2.5 py-1 font-medium transition ${
                        promptTab === tabKey ? 'bg-fg text-bg' : 'text-muted hover:bg-surface-2 hover:text-fg'
                      }`}
                    >
                      {tabLabel}
                    </button>
                  ))}
                </div>

                {dirty && (
                  <p className="mt-3 text-xs text-warning">
                    ⚠️ Workspace has unsaved changes. Save changes to update the generated Antigravity prompt with your latest requirements.
                  </p>
                )}

                <div className="mt-3">
                  <Textarea
                    className="min-h-[60vh] font-mono text-xs leading-5"
                    value={
                      promptTab === 'master'
                        ? promptQuery.data?.prompt ?? 'Loading prompt…'
                        : `# Phase Prompt — ${promptTab.toUpperCase()}\n\nSupply with ANTIGRAVITY_MASTER_PROMPT.md.\n\nProject: ${p.title} (${p.projectCode})\nSelected Requirements: ${p.requirements.filter((r) => r.selected).length}\n\nProtocol:\n1. Inspect all supplied specifications.\n2. Implement without placeholder code.\n3. Execute automated test checks.\n4. Disclose any unverified features honestly.`
                    }
                    readOnly
                  />
                </div>
              </Card>
            </div>
          )}

          {/* SECTION 18: EXPORT CENTER */}
          {section === 'exports' && (
            <div className="space-y-4">
              <Card className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-fg">Download Project Specification Package</h2>
                    <p className="mt-0.5 text-xs text-muted">
                      Generates a real, validated ZIP archive containing all project specifications, checklist JSON/MD, and Antigravity prompts.
                    </p>
                  </div>

                  <Button variant="primary" onClick={handleExportZip} loading={exportBusy}>
                    <Download className="size-4" />
                    Download Project Package (.zip)
                  </Button>
                </div>

                {/* Mode A / Mode B Selection */}
                <div className="mt-5 grid gap-3 rounded-card border border-line bg-surface-2/40 p-4 sm:grid-cols-2">
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-control border p-3 transition ${
                      exportMode === 'specification' ? 'border-accent bg-surface shadow-card' : 'border-line hover:bg-surface'
                    }`}
                  >
                    <input
                      type="radio"
                      name="export-mode"
                      className="mt-0.5"
                      checked={exportMode === 'specification'}
                      onChange={() => setExportMode('specification')}
                    />
                    <div>
                      <p className="text-xs font-semibold text-fg">Mode A: Implementation Specification Package (Default)</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted">
                        Full requirements checklist, technical specifications, traceability matrices, and phased prompts for use with Google Antigravity.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-control border p-3 transition ${
                      exportMode === 'source' ? 'border-accent bg-surface shadow-card' : 'border-line hover:bg-surface'
                    }`}
                  >
                    <input type="radio" name="export-mode" className="mt-0.5" checked={exportMode === 'source'} onChange={() => setExportMode('source')} />
                    <div>
                      <p className="text-xs font-semibold text-fg">Mode B: Existing Project Source Package</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted">
                        Includes specification files and connected source code. (If no source files are uploaded, manifest clearly notes specification package base).
                      </p>
                    </div>
                  </label>
                </div>

                {dirty && (
                  <p className="mt-3 rounded-control bg-warning-soft p-3 text-xs text-warning">
                    ⚠️ You have unsaved workspace changes. Save your changes before exporting to ensure the ZIP archive contains your latest data.
                  </p>
                )}

                {p.lastExportOutdated && (
                  <p className="mt-3 rounded-control bg-warning-soft p-3 text-xs text-warning">
                    ⚠️ The most recent exported package (v{p.exportCount}) is outdated because project requirements or specifications changed. Download a fresh
                    export to incorporate updates.
                  </p>
                )}

                {/* Validation summary banner */}
                {exportSummary && (
                  <div className="mt-4 rounded-control border border-line bg-surface p-4 text-xs">
                    <p className="font-semibold text-fg">Pre-Export Validation Report</p>
                    <div className="mt-2 space-y-1">
                      <p className="text-success">
                        <span className="font-bold">Passed ({exportSummary.passed.length}):</span> {exportSummary.passed.join(' · ') || 'None'}
                      </p>
                      {exportSummary.warnings.length > 0 && (
                        <p className="text-warning">
                          <span className="font-bold">Warnings ({exportSummary.warnings.length}):</span> {exportSummary.warnings.join(' · ')}
                        </p>
                      )}
                      <p className="text-muted">
                        <span className="font-bold">Could not verify:</span> {exportSummary.unavailable.join(' · ')}
                      </p>
                    </div>
                  </div>
                )}
              </Card>

              {/* Package Contents Blueprint */}
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-fg">Package Directory Blueprint</h3>
                <p className="mt-0.5 text-xs text-muted">Files guaranteed in every generated ZIP archive:</p>

                <div className="mt-3 grid gap-2 font-mono text-xs text-muted sm:grid-cols-2">
                  <div className="rounded-tile border border-line p-2.5">
                    <p className="font-bold text-fg">Project Manifest & Checklists</p>
                    <p className="mt-1 text-faint">├── README.md</p>
                    <p className="text-faint">├── PROJECT_MANIFEST.json</p>
                    <p className="text-faint">├── PROJECT_SPECIFICATION.md</p>
                    <p className="text-faint">├── REQUIREMENTS_CHECKLIST.json</p>
                    <p className="text-faint">└── REQUIREMENTS_CHECKLIST.md</p>
                  </div>

                  <div className="rounded-tile border border-line p-2.5">
                    <p className="font-bold text-fg">Architecture & Workflows</p>
                    <p className="mt-1 text-faint">├── USER_WORKFLOWS.md</p>
                    <p className="text-faint">├── UI_UX_SPECIFICATION.md</p>
                    <p className="text-faint">├── TECHNICAL_ARCHITECTURE.md</p>
                    <p className="text-faint">├── DATABASE_SPECIFICATION.md</p>
                    <p className="text-faint">└── API_SPECIFICATION.md</p>
                  </div>

                  <div className="rounded-tile border border-line p-2.5">
                    <p className="font-bold text-fg">Security & Traceability</p>
                    <p className="mt-1 text-faint">├── SECURITY_REQUIREMENTS.md</p>
                    <p className="text-faint">├── TESTING_AND_ACCEPTANCE.md</p>
                    <p className="text-faint">├── DEPLOYMENT_GUIDE.md</p>
                    <p className="text-faint">├── TRACEABILITY/REQUIREMENT_TO_FEATURE_MATRIX.csv</p>
                    <p className="text-faint">└── TRACEABILITY/REQUIREMENT_TO_TEST_MATRIX.csv</p>
                  </div>

                  <div className="rounded-tile border border-line p-2.5">
                    <p className="font-bold text-fg">Antigravity Execution Prompts</p>
                    <p className="mt-1 text-faint">├── ANTIGRAVITY_MASTER_PROMPT.md</p>
                    <p className="text-faint">├── ANTIGRAVITY_PHASE_PROMPTS/01_to_06.md</p>
                    <p className="text-faint">├── EXPORT_VALIDATION_REPORT.md</p>
                    <p className="text-faint">└── EXPORT_METADATA.json</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* SECTION 19: VERSION HISTORY */}
          {section === 'history' && (
            <div className="space-y-4">
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-fg">Export Version History</h2>
                    <p className="mt-0.5 text-xs text-muted">Immutable log of successfully generated packages. Compare current project data against past exports.</p>
                  </div>
                  <Badge tone={historyQuery.data?.exports.length ? 'accent' : 'neutral'}>{historyQuery.data?.exports.length ?? 0} packages recorded</Badge>
                </div>

                {historyQuery.isLoading ? (
                  <div className="py-12 text-center text-xs text-muted">Loading export history…</div>
                ) : !historyQuery.data?.exports.length ? (
                  <div className="mt-4">
                    <EmptyState
                      icon={<Layers3 className="size-8" />}
                      title="No Export History Yet"
                      description="Create a specification package from the Export Center to record your first export version."
                      action={
                        <Button variant="primary" onClick={() => navigate(`/projects/${p.id}/exports`)}>
                          Go to Export Center
                        </Button>
                      }
                    />
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {historyQuery.data.exports.map((x) => (
                      <div key={x.id} className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line bg-surface p-3.5 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-fg">Export v{x.exportVersion}</span>
                            <span className="text-faint">· spec v{x.specificationVersion}</span>
                            <Badge tone={x.validation.failed.length ? 'warning' : 'success'}>
                              {x.validation.failed.length ? 'Validation Warning' : 'Validated ZIP'}
                            </Badge>
                          </div>
                          <p className="mt-1 text-muted">
                            Generated {new Date(x.createdAt).toLocaleString()} · {x.requirementCount} requirements ({x.completedCount} completed)
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => setComparingExportId(x.id)}>
                            <Clock3 className="size-3.5" />
                            Compare with Current
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Compare Dialog */}
              {comparingExportId && <CompareDialog projectId={p.id} exportId={comparingExportId} onClose={() => setComparingExportId(null)} />}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function MetricCard({ label, value, note, highlight }: { label: string; value: string; note: string; highlight?: boolean }) {
  return (
    <Card className={`p-4 ${highlight ? 'border-warning/60 bg-warning-soft/30' : ''}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-fg">{value}</p>
      <p className={`mt-1 text-xs ${highlight ? 'font-medium text-warning' : 'text-faint'}`}>{note}</p>
    </Card>
  )
}

function SpecEditor({
  title,
  subtitle,
  children,
  onSave,
  isSaving,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  onSave: () => void
  isSaving: boolean
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div>
          <h2 className="text-base font-semibold text-fg">{title}</h2>
          <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
        </div>
        <Button variant="primary" size="sm" onClick={onSave} loading={isSaving}>
          <Check className="size-4" />
          Save Section
        </Button>
      </div>
      <div className="mt-4 grid gap-4">{children}</div>
      <div className="mt-5 flex justify-end">
        <Button variant="primary" onClick={onSave} loading={isSaving}>
          <Check className="size-4" />
          Save Section
        </Button>
      </div>
    </Card>
  )
}

function RequirementCard({
  requirement: r,
  allRequirements,
  onUpdate,
  onDelete,
}: {
  requirement: Requirement
  allRequirements: Requirement[]
  onUpdate: (patch: Partial<Requirement>) => void
  onDelete: () => void
}) {
  const [newCriterion, setNewCriterion] = useState('')
  const otherReqs = allRequirements.filter((other) => other.id !== r.id)

  function addCriterion() {
    if (!newCriterion.trim()) return
    onUpdate({
      acceptanceCriteria: [...r.acceptanceCriteria, newCriterion.trim()],
    })
    setNewCriterion('')
  }

  function removeCriterion(idx: number) {
    onUpdate({
      acceptanceCriteria: r.acceptanceCriteria.filter((_, i) => i !== idx),
    })
  }

  function addDependency(depId: string) {
    if (!depId || r.dependencies.includes(depId)) return
    onUpdate({
      dependencies: [...r.dependencies, depId],
    })
  }

  function removeDependency(depId: string) {
    onUpdate({
      dependencies: r.dependencies.filter((d) => d !== depId),
    })
  }

  return (
    <Card className={`p-4 transition-all ${r.selected ? 'border-line' : 'opacity-60 bg-surface/40'}`}>
      <div className="flex items-start gap-3">
        <Checkbox
          aria-label={`Select ${r.title || r.id} for prompt`}
          checked={r.selected}
          onChange={(e) => onUpdate({ selected: e.target.checked })}
          className="mt-1"
        />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={r.priority === 'critical' ? 'warning' : 'accent'} className="font-mono">
              {r.id}
            </Badge>

            <Input
              value={r.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="Requirement summary / headline"
              className="min-w-[220px] flex-1 font-semibold text-fg"
            />

            <Button variant="ghost" size="icon-sm" aria-label="Delete requirement" onClick={onDelete}>
              <Trash2 className="size-4 text-faint hover:text-danger" />
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Description">
              <Textarea
                rows={2}
                value={r.description}
                onChange={(e) => onUpdate({ description: e.target.value })}
                placeholder="What behavior is required?"
              />
            </Field>

            <Field label="Implementation Instructions">
              <Textarea
                rows={2}
                value={r.implementation}
                onChange={(e) => onUpdate({ implementation: e.target.value })}
                placeholder="Technical steps, function or query details"
              />
            </Field>

            <Field label="Category">
              <Select value={r.category} onChange={(e) => onUpdate({ category: e.target.value })}>
                {[
                  'Product and business logic',
                  'UI/UX and accessibility',
                  'Frontend',
                  'Backend',
                  'Database',
                  'Authentication',
                  'Security and privacy',
                  'Performance',
                  'Testing',
                  'Deployment',
                  'Integrations',
                  'Data export and recovery',
                  'Project-specific requirements',
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>

            <Field label="Priority">
              <Select value={r.priority} onChange={(e) => onUpdate({ priority: e.target.value as Requirement['priority'] })}>
                {['critical', 'high', 'medium', 'low'].map((p) => (
                  <option key={p} value={p}>
                    {p[0].toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Dependencies Picker */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">Dependencies</label>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {r.dependencies.map((dep) => (
                <span key={dep} className="inline-flex items-center gap-1 rounded-control bg-raised px-2 py-0.5 font-mono text-xs text-fg">
                  {dep}
                  <button type="button" onClick={() => removeDependency(dep)} className="text-faint hover:text-danger">
                    ×
                  </button>
                </span>
              ))}
              {otherReqs.length > 0 && (
                <select
                  aria-label="Add dependency"
                  className="h-6 rounded-control border border-line bg-surface px-2 text-[11px] text-muted"
                  value=""
                  onChange={(e) => addDependency(e.target.value)}
                >
                  <option value="">+ Add Dependency</option>
                  {otherReqs
                    .filter((o) => !r.dependencies.includes(o.id))
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id}: {o.title || 'Untitled'}
                      </option>
                    ))}
                </select>
              )}
            </div>
          </div>

          {/* Acceptance Criteria List */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">Acceptance Criteria</label>
            <ul className="mt-1 space-y-1 text-xs">
              {r.acceptanceCriteria.map((crit, idx) => (
                <li key={idx} className="flex items-center justify-between gap-2 rounded-control bg-surface-2 px-2.5 py-1">
                  <span className="flex-1 text-fg">✓ {crit}</span>
                  <button type="button" onClick={() => removeCriterion(idx)} className="text-faint hover:text-danger">
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-1.5 flex gap-2">
              <Input
                value={newCriterion}
                onChange={(e) => setNewCriterion(e.target.value)}
                placeholder="Add verifiable pass condition (e.g. returns 200 with JSON payload)"
                className="h-7 text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCriterion()
                  }
                }}
              />
              <Button size="sm" onClick={addCriterion}>
                Add
              </Button>
            </div>
          </div>

          {/* Notes & Clarification */}
          {r.unresolved && (
            <Field label="Clarification Note / Unresolved Question">
              <Textarea
                rows={2}
                value={r.notes}
                onChange={(e) => onUpdate({ notes: e.target.value })}
                placeholder="What details are missing or need user approval?"
                className="border-warning/40 bg-warning-soft/20 text-xs text-warning"
              />
            </Field>
          )}

          {/* Checkboxes row */}
          <div className="flex flex-wrap items-center gap-4 border-t border-line pt-2 text-xs">
            <label className="flex items-center gap-1.5 font-medium text-fg">
              <Checkbox checked={r.mandatory} onChange={(e) => onUpdate({ mandatory: e.target.checked })} />
              Mandatory
            </label>

            <label className="flex items-center gap-1.5 font-medium text-fg">
              <Checkbox checked={r.completed} onChange={(e) => onUpdate({ completed: e.target.checked })} />
              Completed
            </label>

            <label className="flex items-center gap-1.5 font-medium text-fg">
              <Checkbox checked={r.reviewed} onChange={(e) => onUpdate({ reviewed: e.target.checked })} />
              Reviewed
            </label>

            <label className="flex items-center gap-1.5 font-medium text-warning">
              <Checkbox checked={r.unresolved} onChange={(e) => onUpdate({ unresolved: e.target.checked })} />
              Needs Clarification
            </label>
          </div>
        </div>
      </div>
    </Card>
  )
}

function CompareDialog({ projectId, exportId, onClose }: { projectId: string; exportId: string; onClose: () => void }) {
  const compareQuery = useProjectCompare(projectId, exportId)
  const data = compareQuery.data

  return (
    <Dialog
      open={true}
      onClose={onClose}
      title="Specification Changes Since Export"
      description={`Comparing current project requirements against Export package #${exportId.slice(0, 8)}.`}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {compareQuery.isLoading ? (
        <div className="py-8 text-center text-xs text-muted">Calculating diff…</div>
      ) : !data ? (
        <p className="text-xs text-muted">No comparison data available.</p>
      ) : (
        <div className="space-y-4 text-xs">
          {data.outdated && (
            <div className="rounded-control bg-warning-soft p-3 font-medium text-warning">
              ⚠️ This export is outdated compared to your currently saved requirements.
            </div>
          )}

          <div>
            <p className="font-bold text-success">+ Added Requirements ({data.added.length})</p>
            {data.added.length === 0 ? (
              <p className="mt-1 text-faint">None added</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {data.added.map((r) => (
                  <li key={r.id} className="rounded-control bg-success-soft px-2 py-1 text-success">
                    <span className="font-mono font-bold">{r.id}</span>: {r.title || 'Untitled'}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="font-bold text-danger">- Removed Requirements ({data.removed.length})</p>
            {data.removed.length === 0 ? (
              <p className="mt-1 text-faint">None removed</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {data.removed.map((r) => (
                  <li key={r.id} className="rounded-control bg-danger-soft px-2 py-1 text-danger">
                    <span className="font-mono font-bold">{r.id}</span>: {r.title || 'Untitled'}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="font-bold text-warning">~ Modified Requirements ({data.modified.length})</p>
            {data.modified.length === 0 ? (
              <p className="mt-1 text-faint">None modified</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {data.modified.map((r) => (
                  <li key={r.id} className="rounded-control bg-warning-soft px-2 py-1 text-warning">
                    <span className="font-mono font-bold">{r.id}</span>: {r.title || 'Untitled'} (updated)
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Dialog>
  )
}
