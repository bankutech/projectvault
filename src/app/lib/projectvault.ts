import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ExportRecord, ProjectRecord, ProjectSpecifications, ReadinessCheck, Requirement } from '../../shared/projectvault'
import { api } from './api'

export const vaultKeys = {
  projects: ['vault', 'projects'] as const,
  project: (id: string) => ['vault', 'project', id] as const,
  readiness: (id: string) => ['vault', 'readiness', id] as const,
  prompt: (id: string) => ['vault', 'prompt', id] as const,
  exports: (id: string) => ['vault', 'exports', id] as const,
  compare: (id: string, exportId: string) => ['vault', 'compare', id, exportId] as const,
}

export const useProjects = (query = '', archived = false) =>
  useQuery({
    queryKey: [...vaultKeys.projects, query, archived],
    queryFn: () => api<{ projects: ProjectRecord[] }>(`/vault/projects?q=${encodeURIComponent(query)}&archived=${archived}`),
  })

export const useProject = (id: string | undefined) =>
  useQuery({
    queryKey: id ? vaultKeys.project(id) : ['vault', 'project', 'none'],
    queryFn: () => api<{ project: ProjectRecord }>(`/vault/projects/${id}`),
    enabled: Boolean(id),
  })

export const useReadiness = (id: string | undefined) =>
  useQuery({
    queryKey: id ? vaultKeys.readiness(id) : ['vault', 'readiness', 'none'],
    queryFn: () => api<{ checks: ReadinessCheck[]; ready: boolean; selectedRequirementCount: number; unresolvedCount: number }>(`/vault/projects/${id}/readiness`),
    enabled: Boolean(id),
  })

export const useProjectPrompt = (id: string | undefined) =>
  useQuery({
    queryKey: id ? vaultKeys.prompt(id) : ['vault', 'prompt', 'none'],
    queryFn: () => api<{ prompt: string; projectId: string; selectedRequirements: string[] }>(`/vault/projects/${id}/prompt`),
    enabled: Boolean(id),
  })

export const useProjectExports = (id: string | undefined) =>
  useQuery({
    queryKey: id ? vaultKeys.exports(id) : ['vault', 'exports', 'none'],
    queryFn: () => api<{ exports: ExportRecord[] }>(`/vault/projects/${id}/exports`),
    enabled: Boolean(id),
  })

export const useProjectCompare = (id: string | undefined, exportId: string | undefined) =>
  useQuery({
    queryKey: id && exportId ? vaultKeys.compare(id, exportId) : ['vault', 'compare', 'none'],
    queryFn: () => api<{ outdated: boolean; added: Requirement[]; removed: Requirement[]; modified: Requirement[] }>(`/vault/projects/${id}/exports/${exportId}/compare`),
    enabled: Boolean(id && exportId),
  })

export function useProjectSave(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<Pick<ProjectRecord, 'title' | 'description' | 'projectCode' | 'category' | 'priority' | 'status' | 'pinned' | 'archived' | 'requirements' | 'specifications'>>) =>
      api<{ project: ProjectRecord }>(`/vault/projects/${id}`, { method: 'PATCH', json: patch }),
    onSuccess: ({ project }) => {
      client.setQueryData(vaultKeys.project(id), { project })
      void client.invalidateQueries({ queryKey: vaultKeys.projects })
      void client.invalidateQueries({ queryKey: vaultKeys.readiness(id) })
      void client.invalidateQueries({ queryKey: vaultKeys.prompt(id) })
      void client.invalidateQueries({ queryKey: vaultKeys.exports(id) })
    },
  })
}

export async function createProject(input: {
  title: string
  description: string
  projectCode: string
  category: string
  priority: string
  requirements?: Requirement[]
  specifications?: ProjectSpecifications
}) {
  return api<{ project: ProjectRecord }>('/vault/projects', { method: 'POST', json: input })
}

export async function seedStarterProjects() {
  return api<{ seeded: string[]; count: number }>('/vault/seed-starter-projects', { method: 'POST', json: {} })
}

export async function duplicateProject(id: string) {
  return api<{ project: ProjectRecord }>(`/vault/projects/${id}/duplicate`, { method: 'POST', json: {} })
}

export async function deleteProject(id: string) {
  return api(`/vault/projects/${id}`, { method: 'DELETE' })
}

export async function downloadProjectExport(id: string, mode: 'specification' | 'source' = 'specification') {
  const response = await fetch(`/api/vault/projects/${id}/export?mode=${mode}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { accept: 'application/zip' },
  })
  if (!response.ok) {
    let message = `Export failed (${response.status})`
    try {
      const body = (await response.json()) as { error?: string; detail?: string; validation?: { warnings?: string[]; failed?: string[] } }
      message = body.error ?? message
      if (body.detail) message += `: ${body.detail}`
      const details = [...(body.validation?.failed ?? []), ...(body.validation?.warnings ?? [])]
      if (details.length) message += ` — ${details.join('; ')}`
    } catch {}
    throw new Error(message)
  }
  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') ?? ''
  const name = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'ProjectVault-export.zip'
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return {
    exportId: response.headers.get('x-projectvault-export-id'),
    validation: decodeURIComponent(response.headers.get('x-projectvault-validation') ?? '{}'),
  }
}

export function newRequirement(index: number): Requirement {
  return {
    id: `REQ-${String(index + 1).padStart(3, '0')}`,
    title: '',
    description: '',
    category: 'Project-specific requirements',
    priority: 'medium',
    mandatory: true,
    selected: true,
    completed: false,
    reviewed: false,
    notes: '',
    implementation: '',
    dependencies: [],
    acceptanceCriteria: [],
    unresolved: false,
  }
}

export function blankSpecifications(): ProjectSpecifications {
  return {
    purpose: '',
    objectives: '',
    roles: '',
    features: '',
    exclusions: '',
    workflows: '',
    uiux: '',
    frontend: '',
    backend: '',
    database: '',
    auth: '',
    security: '',
    integrations: '',
    businessLogic: '',
    architecture: '',
    testing: '',
    deployment: '',
    decisions: '',
    bugs: '',
    stack: '',
    stackUndecided: false,
    implementationOrder: '',
    unresolved: '',
    complexity: 'Not estimated',
  }
}
