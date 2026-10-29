import type { ExportRecord, ProjectRecord, Requirement } from '../../shared/projectvault'
import { STARTER_TEMPLATES } from '../../shared/templates'
import {
  blankSpec,
  hash,
  makeFiles,
  normalizeRequirement,
  normalizeSpec,
  phasePromptsFor,
  promptFor,
  readiness,
  safeSlug,
  snapshot,
  validPriorities,
  validStatuses,
  validate,
  verifyZip,
  zipStore,
} from '../../shared/engine'

const STORAGE_KEY_PROJECTS = 'projectvault_local_projects_v1'
const STORAGE_KEY_EXPORTS = 'projectvault_local_exports_v1'

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'pv-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36)
}

function loadProjectsFromStorage(): ProjectRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECTS)
    if (raw) {
      const parsed = JSON.parse(raw) as ProjectRecord[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    /* fallback to initial */
  }

  // Populate from starter templates on first run
  const now = Date.now()
  const initial: ProjectRecord[] = STARTER_TEMPLATES.map((tpl, i) => ({
    id: `proj-starter-${i + 1}`,
    title: tpl.title,
    description: tpl.description,
    projectCode: tpl.projectCode,
    category: tpl.category,
    priority: tpl.priority,
    status: 'ready_for_export',
    pinned: i === 0,
    archived: false,
    requirements: tpl.requirements.map(normalizeRequirement),
    specifications: normalizeSpec(tpl.specifications),
    createdAt: now - (3 - i) * 86_400_000,
    updatedAt: now - (3 - i) * 3_600_000,
    lastOpenedAt: i === 0 ? now : null,
    specificationVersion: 1,
    exportCount: 0,
    lastExportAt: null,
    lastExportOutdated: false,
  }))

  saveProjectsToStorage(initial)
  return initial
}

function saveProjectsToStorage(projects: ProjectRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects))
  } catch (e) {
    console.warn('LocalStorage save failed:', e)
  }
}

function loadExportsFromStorage(): ExportRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EXPORTS)
    if (raw) {
      const parsed = JSON.parse(raw) as ExportRecord[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    /* fallback */
  }
  return []
}

function saveExportsToStorage(exports: ExportRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_EXPORTS, JSON.stringify(exports))
  } catch (e) {
    console.warn('LocalStorage exports save failed:', e)
  }
}

export function getLocalMe() {
  return {
    user: {
      sub: 'local-owner',
      name: 'Sagnik Mitra',
      email: 'sagnikmitra1302@gmail.com',
      picture: null,
    },
    workspace: {
      name: "Sagnik's workspace",
      seededAt: Date.now(),
    },
    capabilities: {
      database: true,
      files: false,
      auth: 'local',
    },
  }
}

export function getLocalProjects(query = '', archived = false): { projects: ProjectRecord[] } {
  const all = loadProjectsFromStorage()
  const allExports = loadExportsFromStorage()
  const q = query.trim().toLowerCase()

  const enriched = all.map((p) => {
    const pExports = allExports.filter((e) => e.projectId === p.id).sort((a, b) => b.createdAt - a.createdAt)
    const latestExport = pExports[0]
    const isOutdated = latestExport ? hash(snapshot(p)) !== latestExport.snapshotHash : false
    return {
      ...p,
      exportCount: pExports.length,
      lastExportAt: latestExport ? latestExport.createdAt : null,
      lastExportOutdated: isOutdated,
    }
  })

  const filtered = enriched.filter((p) => {
    if (p.archived !== archived) return false
    if (!q) return true
    return (
      p.title.toLowerCase().includes(q) ||
      p.projectCode.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    )
  })

  // Sort pinned first, then by updatedAt
  filtered.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.updatedAt - a.updatedAt
  })

  return { projects: filtered }
}

export function getLocalProject(id: string): { project: ProjectRecord } {
  const all = loadProjectsFromStorage()
  const found = all.find((p) => p.id === id)
  if (!found) throw new Error('Project not found.')

  const allExports = loadExportsFromStorage().filter((e) => e.projectId === id).sort((a, b) => b.createdAt - a.createdAt)
  const latestExport = allExports[0]

  const p: ProjectRecord = {
    ...found,
    lastOpenedAt: Date.now(),
    exportCount: allExports.length,
    lastExportAt: latestExport ? latestExport.createdAt : null,
    lastExportOutdated: latestExport ? hash(snapshot(found)) !== latestExport.snapshotHash : false,
  }

  saveProjectsToStorage(all.map((item) => (item.id === id ? p : item)))
  return { project: p }
}

export function createLocalProject(input: Record<string, unknown>): { project: ProjectRecord } {
  const title = String(input.title ?? '').trim().slice(0, 160)
  if (!title) throw new Error('Project name is required.')

  const now = Date.now()
  const newId = generateId()
  const priority = validPriorities.includes(input.priority as never) ? (input.priority as ProjectRecord['priority']) : 'medium'
  const requirements = Array.isArray(input.requirements) ? input.requirements.map(normalizeRequirement) : []
  const specifications = input.specifications ? normalizeSpec(input.specifications) : blankSpec

  const project: ProjectRecord = {
    id: newId,
    title,
    description: String(input.description ?? '').slice(0, 2000),
    projectCode: String(input.projectCode ?? '').slice(0, 64),
    category: String(input.category ?? 'General').slice(0, 100),
    priority,
    status: 'draft',
    pinned: false,
    archived: false,
    requirements,
    specifications,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    specificationVersion: 1,
    exportCount: 0,
    lastExportAt: null,
    lastExportOutdated: false,
  }

  const all = loadProjectsFromStorage()
  all.unshift(project)
  saveProjectsToStorage(all)
  return { project }
}

export function patchLocalProject(id: string, patch: Record<string, unknown>): { project: ProjectRecord; dependencyWarnings: string[] } {
  const all = loadProjectsFromStorage()
  const existing = all.find((p) => p.id === id)
  if (!existing) throw new Error('Project not found.')

  const title = patch.title === undefined ? existing.title : String(patch.title).trim().slice(0, 160)
  if (!title) throw new Error('Project name is required.')

  const description = patch.description === undefined ? existing.description : String(patch.description).slice(0, 2000)
  const projectCode = patch.projectCode === undefined ? existing.projectCode : String(patch.projectCode).slice(0, 64)
  const category = patch.category === undefined ? existing.category : String(patch.category).slice(0, 100) || 'General'
  const priority = patch.priority === undefined ? existing.priority : validPriorities.includes(patch.priority as never) ? (patch.priority as ProjectRecord['priority']) : existing.priority
  const status = patch.status === undefined ? existing.status : validStatuses.includes(patch.status as never) ? (patch.status as ProjectRecord['status']) : existing.status

  const requirements = patch.requirements === undefined ? existing.requirements : Array.isArray(patch.requirements) ? patch.requirements.map(normalizeRequirement) : existing.requirements
  const specifications = patch.specifications === undefined ? existing.specifications : normalizeSpec(patch.specifications)

  const ids = requirements.map((r) => r.id)
  if (new Set(ids).size !== ids.length) throw new Error('Requirement IDs must be unique within this project.')

  const dependencyWarnings = requirements.flatMap((r) =>
    r.dependencies.filter((d) => !ids.includes(d)).map((d) => `${r.id} depends on missing ${d}`),
  )

  const next: ProjectRecord = {
    ...existing,
    title,
    description,
    projectCode,
    category,
    priority,
    status,
    pinned: patch.pinned !== undefined ? Boolean(patch.pinned) : existing.pinned,
    archived: patch.archived !== undefined ? Boolean(patch.archived) : existing.archived,
    requirements,
    specifications,
    specificationVersion: snapshot(existing) !== snapshot({ ...existing, title, description, projectCode, category, priority, requirements, specifications }) ? existing.specificationVersion + 1 : existing.specificationVersion,
    updatedAt: Date.now(),
  }

  saveProjectsToStorage(all.map((p) => (p.id === id ? next : p)))
  return { project: next, dependencyWarnings }
}

export function deleteLocalProject(id: string): { ok: boolean } {
  const all = loadProjectsFromStorage().filter((p) => p.id !== id)
  saveProjectsToStorage(all)
  const allExports = loadExportsFromStorage().filter((e) => e.projectId !== id)
  saveExportsToStorage(allExports)
  return { ok: true }
}

export function duplicateLocalProject(id: string): { project: ProjectRecord } {
  const all = loadProjectsFromStorage()
  const source = all.find((p) => p.id === id)
  if (!source) throw new Error('Project not found.')

  const now = Date.now()
  const copyId = generateId()
  const requirements = source.requirements.map((r, index) => ({
    ...r,
    id: `REQ-${String(index + 1).padStart(3, '0')}`,
  }))

  const copy: ProjectRecord = {
    ...source,
    id: copyId,
    title: `${source.title} copy`,
    projectCode: '',
    status: 'draft',
    pinned: false,
    archived: false,
    requirements,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    specificationVersion: 1,
    exportCount: 0,
    lastExportAt: null,
    lastExportOutdated: false,
  }

  all.unshift(copy)
  saveProjectsToStorage(all)
  return { project: copy }
}

export function getLocalReadiness(id: string) {
  const { project: p } = getLocalProject(id)
  const checks = readiness(p)
  const ids = new Set(p.requirements.map((r) => r.id))
  const conflicts = p.requirements.flatMap((r) => r.dependencies.filter((d) => !ids.has(d)).map((d) => `${r.id} depends on missing ${d}`))

  return {
    checks,
    ready: checks.filter((x) => x.critical).every((x) => x.complete) && conflicts.length === 0,
    selectedRequirementCount: p.requirements.filter((r) => r.selected).length,
    unresolvedCount: p.requirements.filter((r) => r.selected && r.unresolved).length,
    warnings: checks.filter((x) => !x.complete),
    conflicts,
  }
}

export function getLocalPrompt(id: string) {
  const { project: p } = getLocalProject(id)
  return {
    prompt: promptFor(p),
    phases: phasePromptsFor(p),
    projectId: p.id,
    selectedRequirements: p.requirements.filter((r) => r.selected).map((r) => r.id),
  }
}

export function getLocalExports(id: string) {
  const all = loadExportsFromStorage().filter((e) => e.projectId === id)
  all.sort((a, b) => b.createdAt - a.createdAt)
  return { exports: all }
}

export function getLocalCompare(id: string, exportId: string) {
  const { project: p } = getLocalProject(id)
  const allExports = loadExportsFromStorage()
  const prior = allExports.find((e) => e.projectId === id && e.id === exportId)
  if (!prior) throw new Error('Export not found.')

  const current = new Map(p.requirements.map((r) => [r.id, r]))
  // In localStorage export record, we store requirements snapshot
  const before: Requirement[] = (prior as unknown as { requirementsSnapshot?: Requirement[] }).requirementsSnapshot ?? []
  const old = new Map(before.map((r) => [r.id, r]))

  return {
    outdated: p.lastExportOutdated,
    added: [...current.values()].filter((r) => !old.has(r.id)),
    removed: before.filter((r) => !current.has(r.id)),
    modified: [...current.values()].filter((r) => old.has(r.id) && JSON.stringify(r) !== JSON.stringify(old.get(r.id))),
  }
}

export function seedLocalStarterProjects() {
  const now = Date.now()
  const all = loadProjectsFromStorage()
  const existingCodes = new Set(all.map((p) => p.projectCode))
  const seeded: string[] = []

  for (const tpl of STARTER_TEMPLATES) {
    if (!existingCodes.has(tpl.projectCode)) {
      const pid = generateId()
      all.push({
        id: pid,
        title: tpl.title,
        description: tpl.description,
        projectCode: tpl.projectCode,
        category: tpl.category,
        priority: tpl.priority,
        status: 'draft',
        pinned: false,
        archived: false,
        requirements: tpl.requirements.map(normalizeRequirement),
        specifications: normalizeSpec(tpl.specifications),
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: null,
        specificationVersion: 1,
        exportCount: 0,
        lastExportAt: null,
        lastExportOutdated: false,
      })
      seeded.push(tpl.title)
    }
  }

  saveProjectsToStorage(all)
  return { seeded, count: seeded.length }
}

export async function downloadLocalProjectExport(id: string, mode: 'specification' | 'source' = 'specification') {
  const { project: p } = getLocalProject(id)
  const allExports = loadExportsFromStorage().filter((e) => e.projectId === id)
  const version = (allExports[0]?.exportVersion ?? 0) + 1
  const timestamp = Date.now()
  const files = makeFiles(p, version, timestamp, mode)
  const validation = validate(files, p)

  if (mode === 'source') {
    validation.warnings.push('Mode B: Existing Project Source Package was requested, but no repository source files are connected. Delivering verified specification package as base.')
  }

  if (validation.failed.length > 0) {
    throw new Error(`Export validation failed: ${validation.failed.join('; ')}`)
  }

  const exportFolder = `ProjectVault_Export_${safeSlug(p.projectCode || p.title)}_v${version}`
  files.set(
    'EXPORT_VALIDATION_REPORT.md',
    `# Export validation report\n\nProject: ${p.title} (${p.id})\nExport version: ${version}\nExport mode: ${mode === 'source' ? 'Mode B (Existing Project Source Package)' : 'Mode A (Implementation Specification Package)'}\nGenerated: ${new Date(timestamp).toISOString()}\n\n## Passed\n${validation.passed.map((x) => `- ${x}`).join('\n') || '- None'}\n\n## Warnings\n${validation.warnings.map((x) => `- ${x}`).join('\n') || '- None'}\n\n## Failed\n${validation.failed.map((x) => `- ${x}`).join('\n') || '- None'}\n\n## Could not verify\n${validation.unavailable.map((x) => `- ${x}`).join('\n') || '- None'}\n\nPackage validation does not prove the eventual implementation works.\n`,
  )

  const manifest = JSON.parse(files.get('PROJECT_MANIFEST.json')!)
  manifest.validation = validation
  files.set('PROJECT_MANIFEST.json', JSON.stringify(manifest, null, 2))

  const metadata = JSON.parse(files.get('EXPORT_METADATA.json')!)
  metadata.validation = validation
  files.set('EXPORT_METADATA.json', JSON.stringify(metadata, null, 2))

  const packaged = new Map([...files].map(([path, body]) => [`${exportFolder}/${path}`, body]))
  const bytes = zipStore(packaged)
  verifyZip(bytes, packaged.size)
  validation.passed.push('ZIP central directory and entry CRCs verified')

  const exportId = generateId()
  const snapshotHash = hash(snapshot(p))

  const record: ExportRecord & { requirementsSnapshot: Requirement[] } = {
    id: exportId,
    projectId: p.id,
    exportVersion: version,
    specificationVersion: p.specificationVersion,
    requirementCount: p.requirements.length,
    completedCount: p.requirements.filter((r) => r.selected && r.completed).length,
    validation,
    snapshotHash,
    createdAt: timestamp,
    requirementsSnapshot: p.requirements,
  }

  const exportsList = loadExportsFromStorage()
  exportsList.unshift(record as unknown as ExportRecord)
  saveExportsToStorage(exportsList)

  // Update project status to exported
  patchLocalProject(p.id, { status: 'exported' })

  // Trigger browser download directly
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${exportFolder}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  return {
    exportId,
    validation: JSON.stringify(validation),
  }
}

export function handleLocalRequest<T>(path: string, init?: RequestInit & { json?: unknown }): T {
  const method = (init?.method ?? 'GET').toUpperCase()
  const body = init?.json as Record<string, unknown> | undefined

  if (path === '/me') {
    return getLocalMe() as unknown as T
  }

  if (path.startsWith('/vault/projects')) {
    const subpath = path.slice('/vault/projects'.length)

    // GET /vault/projects or GET /vault/projects?q=...
    if (!subpath || subpath.startsWith('?')) {
      if (method === 'GET') {
        const url = new URL(`http://localhost${path}`)
        const q = url.searchParams.get('q') ?? ''
        const archived = url.searchParams.get('archived') === 'true'
        return getLocalProjects(q, archived) as unknown as T
      }
      if (method === 'POST') {
        return createLocalProject(body ?? {}) as unknown as T
      }
    }

    // /vault/projects/:id...
    const match = subpath.match(/^\/([^/?]+)(.*)$/)
    if (match) {
      const id = match[1]
      const rest = match[2]

      if (!rest && method === 'GET') return getLocalProject(id) as unknown as T
      if (!rest && method === 'PATCH') return patchLocalProject(id, body ?? {}) as unknown as T
      if (!rest && method === 'DELETE') return deleteLocalProject(id) as unknown as T

      if (rest === '/duplicate' && method === 'POST') return duplicateLocalProject(id) as unknown as T
      if (rest === '/readiness' && method === 'GET') return getLocalReadiness(id) as unknown as T
      if (rest === '/prompt' && method === 'GET') return getLocalPrompt(id) as unknown as T
      if (rest === '/exports' && method === 'GET') return getLocalExports(id) as unknown as T
      if (rest.startsWith('/exports/') && rest.endsWith('/compare') && method === 'GET') {
        const exportId = rest.slice('/exports/'.length, -'/compare'.length)
        return getLocalCompare(id, exportId) as unknown as T
      }
    }
  }

  if (path === '/vault/seed-starter-projects' && method === 'POST') {
    return seedLocalStarterProjects() as unknown as T
  }

  throw new Error(`Not handled locally: ${method} ${path}`)
}
