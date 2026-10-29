import { REQUIREMENT_CATEGORIES, type ProjectRecord, type ProjectSpecifications, type ReadinessCheck, type Requirement } from './projectvault'

export const blankSpec: ProjectSpecifications = {
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

export const text = (value: unknown, max = 30000) => (typeof value === 'string' ? value.slice(0, max) : '')
export const safeSlug = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'project'

export const validPriorities = ['critical', 'high', 'medium', 'low'] as const
export const validStatuses = ['draft', 'planning', 'ready_for_export', 'exported', 'in_development', 'testing', 'completed', 'archived'] as const

export function normalizeRequirement(value: unknown, index = 0): Requirement {
  const r = (value && typeof value === 'object' ? value : {}) as Partial<Requirement>
  return {
    id: text(r.id, 100) || `REQ-${String(index + 1).padStart(3, '0')}`,
    title: text(r.title, 300),
    description: text(r.description),
    category: text(r.category, 120) || 'Project-specific requirements',
    priority: validPriorities.includes(r.priority as never) ? r.priority! : 'medium',
    mandatory: r.mandatory !== false,
    selected: r.selected !== false,
    completed: r.completed === true,
    reviewed: r.reviewed === true,
    notes: text(r.notes),
    implementation: text(r.implementation),
    dependencies: Array.isArray(r.dependencies) ? r.dependencies.map((x) => text(x, 100)).filter(Boolean) : [],
    acceptanceCriteria: Array.isArray(r.acceptanceCriteria) ? r.acceptanceCriteria.map((x) => text(x, 1000)).filter(Boolean) : [],
    unresolved: r.unresolved === true,
  }
}

export function normalizeSpec(value: unknown): ProjectSpecifications {
  const raw = value && typeof value === 'object' ? (value as Partial<ProjectSpecifications>) : {}
  return Object.fromEntries(
    Object.keys(blankSpec).map((key) => [key, key === 'stackUndecided' ? raw.stackUndecided === true : text(raw[key as keyof ProjectSpecifications])]),
  ) as unknown as ProjectSpecifications
}

export function hash(value: string) {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function snapshot(p: Pick<ProjectRecord, 'title' | 'description' | 'projectCode' | 'category' | 'priority' | 'requirements' | 'specifications'>) {
  return JSON.stringify([p.title, p.description, p.projectCode, p.category, p.priority, p.requirements, p.specifications])
}

export function readiness(p: ProjectRecord): ReadinessCheck[] {
  const selected = p.requirements.filter((r) => r.selected)
  return [
    { key: 'identity', label: 'Project name and purpose', complete: Boolean(p.title.trim() && p.description.trim() && p.specifications.purpose.trim()), critical: true },
    { key: 'features', label: 'Feature list defined', complete: Boolean(p.specifications.features.trim() || selected.length), critical: true },
    { key: 'checklist', label: 'Selected requirements reviewed', complete: selected.length > 0 && selected.every((r) => r.reviewed), critical: true },
    { key: 'uiux', label: 'UI/UX decisions', complete: Boolean(p.specifications.uiux.trim()), critical: false },
    { key: 'stack', label: 'Technology stack selected or explicitly undecided', complete: Boolean(p.specifications.stack.trim() || p.specifications.stackUndecided), critical: true },
    { key: 'database', label: 'Database requirements', complete: Boolean(p.specifications.database.trim() || !selected.some((r) => r.category === 'Database')), critical: false },
    { key: 'auth', label: 'Authentication requirements', complete: Boolean(p.specifications.auth.trim() || !selected.some((r) => r.category === 'Authentication')), critical: true },
    { key: 'security', label: 'Security requirements', complete: Boolean(p.specifications.security.trim()), critical: true },
    { key: 'integrations', label: 'Integration details', complete: Boolean(p.specifications.integrations.trim() || !selected.some((r) => r.category === 'Integrations')), critical: false },
    { key: 'acceptance', label: 'Acceptance criteria for selected requirements', complete: selected.length > 0 && selected.every((r) => r.acceptanceCriteria.length > 0), critical: true },
    { key: 'testing', label: 'Testing requirements', complete: Boolean(p.specifications.testing.trim()), critical: true },
    { key: 'deployment', label: 'Deployment expectations', complete: Boolean(p.specifications.deployment.trim()), critical: false },
    { key: 'sequence', label: 'Implementation sequence', complete: Boolean(p.specifications.implementationOrder.trim()), critical: false },
    { key: 'unresolved', label: 'Unresolved questions recorded or none remain', complete: Boolean(p.specifications.unresolved.trim()) || !selected.some((r) => r.unresolved), critical: true },
    { key: 'prompt', label: 'Project-specific Antigravity prompt available', complete: true, critical: true },
  ]
}

export function promptFor(p: ProjectRecord): string {
  const s = p.specifications,
    selected = p.requirements.filter((r) => r.selected)
  const section = (title: string, body: string) => `## ${title}\n${body.trim() || 'Not specified. Identify the gap and request clarification; do not invent a business decision.'}`
  return `# Antigravity Master Implementation Prompt — ${p.title}\n\nProject ID: ${p.id}\nProject code: ${p.projectCode || 'Unassigned'}\n\n## Objective\n${s.purpose || p.description || 'Not supplied. Ask for clarification.'}\n\n${section('Objectives and product requirements', s.objectives || s.features)}\n${section('User roles and permissions', s.roles)}\n## Selected requirements\n${selected.length ? selected.map((r) => `### ${r.id}: ${r.title} (${r.priority}; ${r.mandatory ? 'mandatory' : 'optional'})\n${r.description || 'Description missing; clarify.'}\nImplementation: ${r.implementation || 'Derive a traceable implementation instruction without adding scope.'}\nAcceptance criteria:\n${r.acceptanceCriteria.length ? r.acceptanceCriteria.map((x) => `- ${x}`).join('\n') : '- MISSING: define before verification.'}\nDependencies: ${r.dependencies.join(', ') || 'None'}\n${r.unresolved ? `UNRESOLVED: ${r.notes || 'Clarify before implementation or document an assumption for approval.'}` : ''}`).join('\n\n') : 'No selected requirements. Request scope before implementation.'}\n\n${section('Explicit exclusions', s.exclusions)}\n${section('User workflows and business logic', `${s.workflows}\n${s.businessLogic}`)}\n${section('UI/UX, responsive design, accessibility and states', s.uiux)}\n${section('Frontend specification', s.frontend)}\n${section('Backend and API specification', s.backend)}\n${section('Database schema and selected database technology', s.database)}\n${section('Authentication and authorization', s.auth)}\n${section('Security, privacy, validation and error handling', s.security)}\n${section('Integrations and APIs', s.integrations)}\n${section('Architecture and file structure', s.architecture)}\n${section('Technology stack', s.stack || (s.stackUndecided ? 'Explicitly undecided. Compare options and obtain approval before selection.' : 'Not supplied. Do not silently substitute a database, framework or service.'))}\n${section('Performance expectations', s.decisions)}\n${section('Testing and acceptance', s.testing)}\n${section('Deployment and environment variables', s.deployment)}\n${section('Known limitations', s.bugs)}\n${section('Unresolved decisions', s.unresolved)}\n\n## Implementation order\n${s.implementationOrder || '1. Inspect supplied specifications and repository. 2. Identify contradictions, missing information, risks. 3. Present a traceable plan. 4. Implement foundation, core requirements, integrations/security, tests and refinement. 5. Verify and report honestly.'}\n\n## Required execution protocol\n1. Inspect every supplied specification, file, and existing repository before editing. Preserve working functionality and established design decisions unless a change is explicitly required. For a new repository, present an implementation plan before creating the application.\n2. Identify requirement conflicts, missing details, and architecture/security risks. Clarify important business rules rather than inventing them; list approved assumptions explicitly. Do not silently replace selected technology (including database).\n3. Implement in manageable phases. Build real working features, connecting frontend/backend/database/integrations as specified. Implement server-side authorization, validation, useful errors, empty/loading/success/failure states, responsiveness and accessibility.\n4. Run available automated tests, linting, type checks, and production builds. Fix discovered errors, then rerun affected checks. Document checks blocked by missing credentials/services/environment.\n5. Map every requirement to implementation and executed test evidence. Report completed, incomplete, and blocked requirements and known limitations. Never claim an unexecuted test passed. Document environment variable names and safe setup, not secret values.\n\nThis is an implementation-specification package, not a source-code export.`
}

export function phasePromptsFor(p: ProjectRecord): Record<string, string> {
  const s = p.specifications
  const selected = p.requirements.filter((r) => r.selected)
  const code = p.projectCode || `PV-${p.id.slice(0, 8)}`

  const phase1 = `# Antigravity Phase 01 Prompt — Analysis and Planning

Project: ${p.title} (${code})
Project ID: ${p.id}
Priority: ${p.priority} | Status: ${p.status} | Category: ${p.category}

## 1. Objective & Scope
You are tasked with conducting the comprehensive technical analysis and architectural planning phase for **${p.title}**.
- Primary Purpose: ${s.purpose || p.description || 'Not specified; verify core requirements first.'}
- Key Objectives: ${s.objectives || 'Refer to selected requirements checklist.'}
- Scope: ${selected.length} selected requirements (${selected.filter((r) => r.mandatory).length} mandatory, ${selected.filter((r) => r.priority === 'critical').length} critical).
- Explicit Exclusions: ${s.exclusions || 'None recorded; clarify out-of-scope features before starting.'}

## 2. Technology Evaluation
- Proposed Stack: ${s.stack || (s.stackUndecided ? 'Explicitly undecided — evaluate optimal framework/database options and seek approval before writing foundation code.' : 'Standard verified stack.')}
- Architecture Approach: ${s.architecture || 'Clean modular layered architecture with strict separation of concerns.'}

## 3. Unresolved Decisions & Risk Analysis
- Known Gaps: ${s.unresolved || 'None recorded.'}
- Open Bug/Limitation Reports: ${s.bugs || 'None.'}
- Complexity Assessment: ${s.complexity}

## 4. Execution Directives for Antigravity
1. Read \`PROJECT_MANIFEST.json\`, \`PROJECT_SPECIFICATION.md\`, and \`REQUIREMENTS_CHECKLIST.md\`.
2. Inspect the local workspace. Do not replace working code or destroy existing migrations.
3. If stack decisions are undecided, present a concrete recommendation matrix.
4. Output a verified Implementation Roadmap detailing component hierarchy, database schema, and API contracts before writing business logic.
`

  const phase2 = `# Antigravity Phase 02 Prompt — Foundation and Architecture

Project: ${p.title} (${code})
Project ID: ${p.id}

## 1. Objective
Establish the foundational infrastructure, database models, environment configurations, and routing topology for **${p.title}**.

## 2. Database & Data Model Specifications
- Storage Engine / Tech: ${s.database || 'Relational schema with foreign keys, constraints, and migrations.'}
- Data Integrity Rules: Every project entity must maintain strict ownership isolation and audit timestamps (created_at, updated_at).
- Relationships & Constraints: Implement foreign key cascades safely, avoiding orphan records.

## 3. Frontend & Routing Foundation
- Frontend Architecture: ${s.frontend || 'Component-driven layout with error boundaries, loading states, and responsive styling.'}
- Navigation Structure: Desktop sidebar, mobile navigation, semantic headings, and keyboard focus outlines.

## 4. Backend & API Scaffolding
- Protocol & Endpoints: ${s.backend || 'RESTful API with typed request/response schemas and centralized error handling.'}
- Authentication & Sessions: ${s.auth || 'Enforce server-side authorization middleware on all private routes.'}

## 5. Execution Directives for Antigravity
1. Initialize clean, buildable project scaffolding with zero type errors.
2. Run database migrations and verify local seed capabilities.
3. Validate that development server starts reliably on Windows (Node/Vite/Hono/Wrangler).
4. Verify that routing renders a working layout with error boundary and responsive navigation.
`

  const phase3 = `# Antigravity Phase 03 Prompt — Core Implementation

Project: ${p.title} (${code})
Project ID: ${p.id}

## 1. Objective
Implement all ${selected.length} selected functional requirements with complete business logic, interactive UI components, and verified acceptance criteria.

## 2. Selected Requirements to Implement
${
  selected.length
    ? selected
        .map(
          (r) =>
            `### [${r.id}] ${r.title} (${r.priority.toUpperCase()}${r.mandatory ? ' | MANDATORY' : ''})\n- Category: ${r.category}\n- Description: ${r.description || 'See requirement details'}\n- Implementation Details: ${r.implementation || 'Implement end-to-end functionality'}\n- Acceptance Criteria:\n${r.acceptanceCriteria.map((c) => `  * ${c}`).join('\n') || '  * Implement real functionality'}\n- Dependencies: ${r.dependencies.join(', ') || 'None'}\n${r.unresolved ? `- UNRESOLVED FLAG: ${r.notes || 'Confirm behavior before finalizing'}\n` : ''}`,
        )
        .join('\n')
    : 'No requirements currently selected. Refer to REQUIREMENTS_CHECKLIST.md.'
}

## 3. User Workflows & Business Logic
- Primary Flows: ${s.workflows || 'Follow standard user journeys.'}
- Business Rules: ${s.businessLogic || 'Enforce validation, state transitions, and idempotency.'}
- UI/UX & Responsive States: ${s.uiux || 'Ensure mobile (375px), tablet (768px), and desktop (1280px) responsiveness.'}

## 4. Execution Directives for Antigravity
1. Implement real functionality — no mock placeholders or simulated delays in production paths.
2. Wire each UI control to its corresponding API route and database mutation.
3. Provide visual loading indicators, optimistic updates where safe, and clear user error feedback.
4. Verify all acceptance criteria explicitly for every requirement listed above.
`

  const phase4 = `# Antigravity Phase 04 Prompt — Integration and Security

Project: ${p.title} (${code})
Project ID: ${p.id}

## 1. Objective
Harden application security, enforce server-side data isolation, implement validation schemas, and integrate specified external services.

## 2. Security & Authorization Enforcement
- Security Policies: ${s.security || 'Server-side authorization, strict input sanitization, OWASP Top 10 mitigation.'}
- Auth Boundaries: ${s.auth || 'Verify session/token validity on every request; block horizontal privilege escalation.'}
- Credential Protection: Never commit or log API keys, private keys, or passwords. Document environment variable requirements in .env.example only.

## 3. External Integrations
- Third-Party Services: ${s.integrations || 'No external integrations specified.'}
- Failure Handling: Implement timeouts, retries with backoff, and graceful fallback UI when integrations are offline.

## 4. Execution Directives for Antigravity
1. Conduct an audit for SQL injection, XSS, and insecure direct object references (IDOR).
2. Ensure all file operations sanitize paths and prevent directory traversal attacks.
3. Enforce rate limiting and request payload size limits where appropriate.
4. Confirm that users cannot view or mutate other users' private data.
`

  const phase5 = `# Antigravity Phase 05 Prompt — Testing and Refinement

Project: ${p.title} (${code})
Project ID: ${p.id}

## 1. Objective
Establish an automated verification suite covering unit logic, API contracts, responsive rendering, and edge cases for **${p.title}**.

## 2. Testing Directives & Requirements
- Strategy: ${s.testing || 'Automated unit tests, integration tests for API routes, and end-to-end user flow verification.'}
- Performance Benchmarks: ${s.decisions || 'Fast interactive response times, minimal bundle overhead.'}

## 3. Acceptance Criteria Traceability
- Cross-reference each test against \`TRACEABILITY/REQUIREMENT_TO_TEST_MATRIX.csv\`.
- Every critical requirement (${selected.filter((r) => r.priority === 'critical').map((r) => r.id).join(', ') || 'None'}) must have automated regression tests.

## 4. Execution Directives for Antigravity
1. Execute \`npm test\` (or project test runner) and verify all tests pass.
2. Run \`npm run typecheck\` and \`npm run lint\` — resolve all errors and warnings at root cause.
3. Inspect viewport behavior at 375px (mobile), 768px (tablet), and 1280px (desktop). Fix any overflow or clipped controls.
4. Fix all discovered defects at the source, then rerun the test suite to ensure zero regressions.
`

  const phase6 = `# Antigravity Phase 06 Prompt — Final Verification & Delivery

Project: ${p.title} (${code})
Project ID: ${p.id}

## 1. Objective
Execute final production build verification, validate deployment documentation, and prepare delivery artifacts for **${p.title}**.

## 2. Deployment & Environment Verification
- Deployment Target: ${s.deployment || 'Production build bundle with zero runtime development dependencies.'}
- Environment Setup: Verify all required configuration keys are documented with safe placeholders.

## 3. Known Limitations & Disclosure
- Residual Technical Debt: ${s.bugs || 'None.'}
- Unresolved Items: ${s.unresolved || 'None.'}

## 4. Execution Directives for Antigravity
1. Run full production build (\`npm run build\`). Verify output assets generate cleanly.
2. Verify that no mock data or debug endpoints remain active in production configuration.
3. Perform final verification of the README instructions on Windows local environment.
4. Provide an honest, evidence-based completion report distinguishing verified functionality from environment-blocked items.
`

  return {
    phase1,
    phase2,
    phase3,
    phase4,
    phase5,
    phase6,
    '01_ANALYSIS_AND_PLANNING': phase1,
    '02_FOUNDATION_AND_ARCHITECTURE': phase2,
    '03_CORE_IMPLEMENTATION': phase3,
    '04_INTEGRATION_AND_SECURITY': phase4,
    '05_TESTING_AND_REFINEMENT': phase5,
    '06_FINAL_VERIFICATION': phase6,
  }
}

export function markdownRequirements(requirements: Requirement[]) {
  return requirements
    .map(
      (r) =>
        `## ${r.id} — ${r.title}\n\n- Category: ${r.category}\n- Priority: ${r.priority}; ${r.mandatory ? 'mandatory' : 'optional'}\n- Selected: ${r.selected ? 'Yes' : 'No'}; completed: ${r.completed ? 'Yes' : 'No'}; reviewed: ${r.reviewed ? 'Yes' : 'No'}\n- Dependencies: ${r.dependencies.join(', ') || 'None'}\n- Unresolved: ${r.unresolved ? 'Yes' : 'No'}\n\n${r.description || 'No description supplied.'}\n\nImplementation: ${r.implementation || 'Not specified.'}\n\nNotes: ${r.notes || 'None'}\n\nAcceptance criteria:\n${r.acceptanceCriteria.length ? r.acceptanceCriteria.map((x) => `- ${x}`).join('\n') : '- MISSING — define before implementation verification.'}`,
    )
    .join('\n\n')
}

export function csvField(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export function zipStore(entries: Map<string, string>): Uint8Array {
  const encoder = new TextEncoder(),
    local: Uint8Array[] = [],
    central: Uint8Array[] = []
  let offset = 0
  for (const [name, content] of entries) {
    const path = encoder.encode(name),
      data = encoder.encode(content),
      crc = crc32(data)
    if (path.length > 65535 || data.length > 0xffffffff || offset > 0xffffffff) throw new Error('ZIP32 export size limit exceeded')
    const header = new Uint8Array(30 + path.length),
      v = new DataView(header.buffer)
    v.setUint32(0, 0x04034b50, true)
    v.setUint16(4, 20, true)
    v.setUint16(6, 0x0800, true)
    v.setUint32(14, crc, true)
    v.setUint32(18, data.length, true)
    v.setUint32(22, data.length, true)
    v.setUint16(26, path.length, true)
    header.set(path, 30)
    local.push(header, data)
    const directory = new Uint8Array(46 + path.length),
      d = new DataView(directory.buffer)
    d.setUint32(0, 0x02014b50, true)
    d.setUint16(4, 20, true)
    d.setUint16(6, 20, true)
    d.setUint16(8, 0x0800, true)
    d.setUint32(16, crc, true)
    d.setUint32(20, data.length, true)
    d.setUint32(24, data.length, true)
    d.setUint16(28, path.length, true)
    d.setUint32(42, offset, true)
    directory.set(path, 46)
    central.push(directory)
    offset += header.length + data.length
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0)
  if (entries.size > 65535 || offset + centralSize > 0xffffffff) throw new Error('ZIP32 export size limit exceeded')
  const end = new Uint8Array(22),
    e = new DataView(end.buffer)
  e.setUint32(0, 0x06054b50, true)
  e.setUint16(8, entries.size, true)
  e.setUint16(10, entries.size, true)
  e.setUint32(12, centralSize, true)
  e.setUint32(16, offset, true)
  const output = new Uint8Array(offset + centralSize + end.length)
  let cursor = 0
  for (const block of [...local, ...central, end]) {
    output.set(block, cursor)
    cursor += block.length
  }
  return output
}

export function verifyZip(bytes: Uint8Array, expected: number) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    decoder = new TextDecoder()
  let eocd = -1
  for (let i = Math.max(0, bytes.length - 65557); i <= bytes.length - 22; i++) if (view.getUint32(i, true) === 0x06054b50) eocd = i
  if (eocd < 0 || view.getUint16(eocd + 10, true) !== expected) throw new Error('ZIP end record or entry count is invalid')
  const centralOffset = view.getUint32(eocd + 16, true)
  let cursor = centralOffset
  for (let i = 0; i < expected; i++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('ZIP central directory entry is corrupt')
    const crc = view.getUint32(cursor + 16, true),
      size = view.getUint32(cursor + 24, true),
      nameLength = view.getUint16(cursor + 28, true),
      extra = view.getUint16(cursor + 30, true),
      comment = view.getUint16(cursor + 32, true),
      localOffset = view.getUint32(cursor + 42, true),
      name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength))
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error(`ZIP local header missing for ${name}`)
    const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true),
      data = bytes.subarray(dataStart, dataStart + size)
    if (data.length !== size || crc32(data) !== crc) throw new Error(`ZIP CRC check failed for ${name}`)
    cursor += 46 + nameLength + extra + comment
  }
  if (cursor !== eocd) throw new Error('ZIP central directory size mismatch')
}

export function makeFiles(p: ProjectRecord, version: number, timestamp: number, mode: 'specification' | 'source' = 'specification'): Map<string, string> {
  const selected = p.requirements.filter((r) => r.selected),
    checks = readiness(p),
    prompt = promptFor(p)
  const phasePrompts = phasePromptsFor(p)
  const isSourceMode = mode === 'source'
  const manifest: Record<string, unknown> = {
    format: 'ProjectVault Specification Package',
    formatVersion: 1,
    packageMode: isSourceMode ? 'existing-project-source' : 'implementation-specification',
    sourceCodeIncluded: false,
    sourceCodeNote: isSourceMode
      ? 'Mode B requested: No application source code has been uploaded or attached in this environment. Delivering verified implementation specification package as base.'
      : 'Mode A: Implementation specification package.',
    project: { id: p.id, code: p.projectCode, name: p.title, description: p.description, category: p.category, status: p.status, priority: p.priority },
    exportVersion: version,
    specificationVersion: p.specificationVersion,
    generatedAt: new Date(timestamp).toISOString(),
    requirementCount: p.requirements.length,
    selectedRequirementCount: selected.length,
    completedRequirementCount: selected.filter((r) => r.completed).length,
    unresolvedRequirementCount: selected.filter((r) => r.unresolved).length,
    sections: {
      uiUx: Boolean(p.specifications.uiux),
      database: Boolean(p.specifications.database),
      api: Boolean(p.specifications.backend),
      integrations: Boolean(p.specifications.integrations),
    },
    notApplicable: [
      'Source code (not uploaded or connected)',
      ...(!p.specifications.database ? ['Database-specific schema'] : []),
      ...(!p.specifications.integrations ? ['External integration contracts'] : []),
    ],
    readiness: checks,
  }
  const acceptance = selected.flatMap((r) => r.acceptanceCriteria.map((criterion, i) => ({ id: r.id, criterion, test: `Verify ${r.id} acceptance criterion ${i + 1}: ${criterion}` })))
  const featureCsv = [
    'Requirement ID,Description,Priority,Implementation phase,Specification section,Acceptance criteria,Corresponding test,Verification status',
    ...selected.map((r) =>
      [
        r.id,
        r.title,
        r.priority,
        'Core implementation',
        r.category,
        r.acceptanceCriteria.join(' | '),
        acceptance
          .filter((x) => x.id === r.id)
          .map((x) => x.test)
          .join(' | '),
        r.completed ? 'Marked complete (not independently verified)' : 'Not verified',
      ]
        .map(csvField)
        .join(','),
    ),
  ].join('\n')
  const testCsv = [
    'Requirement ID,Acceptance criterion,Test case,Verification status',
    ...acceptance.map((x) => [x.id, x.criterion, x.test, 'Not executed; verify in implementation repository'].map(csvField).join(',')),
  ].join('\n')
  const files = new Map<string, string>([
    [
      'README.md',
      `# ${p.title} — ProjectVault Specification Package\n\nThis is an ${isSourceMode ? 'existing-project specification package' : 'implementation-specification package'}, not a full application source archive. Supply this ZIP and any existing source repository to Google Antigravity.\n\n- Project ID: \`${p.id}\`\n- Project code: ${p.projectCode || 'Unassigned'}\n- Export version: ${version}\n- Export mode: ${isSourceMode ? 'Mode B (Existing Project Source Package)' : 'Mode A (Implementation Specification Package)'}\n- Generated: ${new Date(timestamp).toISOString()}\n- Selected requirements: ${selected.length}\n\nStart with \`ANTIGRAVITY_MASTER_PROMPT.md\`. Read \`PROJECT_MANIFEST.json\`, checklist, implementation plan and traceability before editing. Secret values and unrelated projects are excluded.\n`,
    ],
    ['PROJECT_MANIFEST.json', ''],
    [
      'PROJECT_SPECIFICATION.md',
      `# ${p.title}\n\n## Purpose\n${p.specifications.purpose || p.description || 'Not specified; clarification required.'}\n\n## Objectives\n${p.specifications.objectives || 'Not specified.'}\n\n## Features\n${p.specifications.features || 'See selected requirements checklist.'}\n\n## Exclusions\n${p.specifications.exclusions || 'Not specified.'}\n\n## Status\n${p.status}; ${p.priority} priority; ${p.category}.\n\n## Readiness review\n${checks.map((x) => `- [${x.complete ? 'x' : ' '}] ${x.label}${x.critical ? ' (critical)' : ''}`).join('\n')}\n`,
    ],
    [
      'REQUIREMENTS_CHECKLIST.json',
      JSON.stringify({ projectId: p.id, specificationVersion: p.specificationVersion, categories: REQUIREMENT_CATEGORIES, requirements: p.requirements }, null, 2),
    ],
    ['REQUIREMENTS_CHECKLIST.md', `# Requirements Checklist\n\n${markdownRequirements(p.requirements) || 'No requirements recorded.'}\n`],
    [
      'USER_WORKFLOWS.md',
      `# User Workflows\n\n${p.specifications.workflows || 'Not specified; clarify before implementation.'}\n\n## Roles\n${p.specifications.roles || 'Not specified.'}\n\n## Business logic\n${p.specifications.businessLogic || 'Not specified.'}\n`,
    ],
    [
      'UI_UX_SPECIFICATION.md',
      `# UI/UX Requirements\n\n${p.specifications.uiux || 'Not specified; record proposed assumptions for approval.'}\n\nImplement responsive desktop/tablet/mobile layouts, keyboard access, semantic controls and empty/loading/success/failure states.\n`,
    ],
    [
      'TECHNICAL_ARCHITECTURE.md',
      `# Technical Architecture\n\n## Stack\n${p.specifications.stack || (p.specifications.stackUndecided ? 'Explicitly undecided; seek approval before selection.' : 'Not specified; do not substitute silently.')}\n\n## Frontend\n${p.specifications.frontend || 'Not specified.'}\n\n## Backend/API\n${p.specifications.backend || 'Not specified.'}\n\n## Architecture/file structure\n${p.specifications.architecture || 'Not specified; plan before implementation.'}\n`,
    ],
    [
      'DATABASE_SPECIFICATION.md',
      `# Database Specification\n\n## Database Technology\n${p.specifications.database || (p.specifications.stackUndecided ? 'Explicitly undecided; clarify before selection.' : 'Not specified; do not substitute silently.')}\n\n## Relational Schema & Entities\n${p.specifications.database || 'Define relational entities, foreign key constraints, indexes, and migrations.'}\n`,
    ],
    [
      'API_SPECIFICATION.md',
      `# API Specification\n\n## Backend Architecture & Protocol\n${p.specifications.backend || 'Not specified; clarify before implementation.'}\n\n## Endpoints & Contracts\n${p.specifications.backend || 'Define endpoint paths, methods, request bodies, error formats, and authorization headers.'}\n\n## External Integrations\n${p.specifications.integrations || 'None recorded.'}\n`,
    ],
    [
      'SECURITY_REQUIREMENTS.md',
      `# Security and Privacy\n\n${p.specifications.security || 'NOT RESOLVED — security architecture requires review.'}\n\nAuthentication and authorization: ${p.specifications.auth || 'Not specified; clarify whether required.'}\n\nNever commit or export credentials, API keys, tokens, private keys, passwords, session secrets, or production data. Validate and authorize every sensitive operation server-side.\n`,
    ],
    [
      'TESTING_AND_ACCEPTANCE.md',
      `# Testing and Acceptance Criteria\n\n${p.specifications.testing || 'Testing approach not specified; define before claiming implementation verified.'}\n\n${markdownRequirements(selected)}\n`,
    ],
    [
      'DEPLOYMENT_GUIDE.md',
      `# Deployment\n\n${p.specifications.deployment || 'Not specified; document target, build, environment variables, migrations, rollback and smoke tests.'}\n\nDocument variable names/setup only. No secret values are included.\n`,
    ],
    [
      'IMPLEMENTATION_PLAN.md',
      `# Implementation Plan\n\n${p.specifications.implementationOrder || '1. Inspect repository and all specifications. 2. Identify conflicts, risks and gaps. 3. Present traceable plan. 4. Implement foundation. 5. Implement selected requirements. 6. Integrate and secure. 7. Test, refine and report.'}\n\n${selected.map((r) => `- ${r.id} (${r.priority}): ${r.title}${r.implementation ? ` — ${r.implementation}` : ''}`).join('\n') || 'No selected requirements.'}\n`,
    ],
    [
      'KNOWN_LIMITATIONS.md',
      `# Known Limitations and Open Decisions\n\n${p.specifications.bugs || 'No implementation bugs have been reported.'}\n\n## Project questions\n${p.specifications.unresolved || 'None recorded.'}\n\n## Unresolved selected requirements\n${selected.filter((r) => r.unresolved).map((r) => `- ${r.id}: ${r.title} — ${r.notes || 'Clarification required.'}`).join('\n') || 'None flagged.'}\n\n## Complexity estimate\n${p.specifications.complexity}\n`,
    ],
    ['ANTIGRAVITY_MASTER_PROMPT.md', prompt],
    ['ANTIGRAVITY_PHASE_PROMPTS/01_ANALYSIS_AND_PLANNING.md', phasePrompts['01_ANALYSIS_AND_PLANNING']],
    ['ANTIGRAVITY_PHASE_PROMPTS/02_FOUNDATION_AND_ARCHITECTURE.md', phasePrompts['02_FOUNDATION_AND_ARCHITECTURE']],
    ['ANTIGRAVITY_PHASE_PROMPTS/03_CORE_IMPLEMENTATION.md', phasePrompts['03_CORE_IMPLEMENTATION']],
    ['ANTIGRAVITY_PHASE_PROMPTS/04_INTEGRATION_AND_SECURITY.md', phasePrompts['04_INTEGRATION_AND_SECURITY']],
    ['ANTIGRAVITY_PHASE_PROMPTS/05_TESTING_AND_REFINEMENT.md', phasePrompts['05_TESTING_AND_REFINEMENT']],
    ['ANTIGRAVITY_PHASE_PROMPTS/06_FINAL_VERIFICATION.md', phasePrompts['06_FINAL_VERIFICATION']],
    ['TRACEABILITY/REQUIREMENT_TO_FEATURE_MATRIX.csv', featureCsv],
    ['TRACEABILITY/REQUIREMENT_TO_TEST_MATRIX.csv', testCsv],
    [
      'EXPORT_METADATA.json',
      JSON.stringify(
        {
          projectId: p.id,
          exportVersion: version,
          specificationVersion: p.specificationVersion,
          generatedAt: new Date(timestamp).toISOString(),
          requirementCount: p.requirements.length,
          selectedRequirementCount: selected.length,
          completedRequirementCount: selected.filter((r) => r.selected && r.completed).length,
        },
        null,
        2,
      ),
    ],
  ])
  manifest.files = [...files.keys()]
  files.set('PROJECT_MANIFEST.json', JSON.stringify(manifest, null, 2))
  return files
}

export function validate(files: Map<string, string>, p: ProjectRecord) {
  const passed: string[] = [],
    warnings: string[] = [],
    failed: string[] = [],
    unavailable = ['Eventual Google Antigravity implementation and application tests are outside this specification export.']
  const required = [
    'README.md',
    'PROJECT_MANIFEST.json',
    'PROJECT_SPECIFICATION.md',
    'REQUIREMENTS_CHECKLIST.json',
    'REQUIREMENTS_CHECKLIST.md',
    'DATABASE_SPECIFICATION.md',
    'API_SPECIFICATION.md',
    'ANTIGRAVITY_MASTER_PROMPT.md',
    'EXPORT_METADATA.json',
    'TRACEABILITY/REQUIREMENT_TO_FEATURE_MATRIX.csv',
    'TRACEABILITY/REQUIREMENT_TO_TEST_MATRIX.csv',
  ]
  const missing = required.filter((name) => !files.get(name)?.trim())
  if (missing.length) failed.push(`Missing/empty required files: ${missing.join(', ')}`)
  else passed.push('Required specification files are present and non-empty')
  try {
    for (const name of ['PROJECT_MANIFEST.json', 'REQUIREMENTS_CHECKLIST.json', 'EXPORT_METADATA.json']) JSON.parse(files.get(name)!)
    passed.push('All generated JSON files parse successfully')
  } catch {
    failed.push('A generated JSON file is invalid')
  }
  const ids = p.requirements.map((r) => r.id)
  if (new Set(ids).size !== ids.length) failed.push('Requirement identifiers are duplicated')
  else passed.push('Requirement identifiers are unique')
  const idSet = new Set(ids),
    dangling = p.requirements.flatMap((r) => r.dependencies.filter((x) => !idSet.has(x)).map((x) => `${r.id} depends on missing ${x}`))
  if (dangling.length) warnings.push(...dangling)
  else passed.push('Requirement dependencies resolve')
  const selected = p.requirements.filter((r) => r.selected),
    withoutCriteria = selected.filter((r) => !r.acceptanceCriteria.length)
  if (withoutCriteria.length) warnings.push(`Selected requirements missing acceptance criteria: ${withoutCriteria.map((r) => r.id).join(', ')}`)
  else passed.push('Every selected requirement has acceptance criteria')
  const critical = selected.filter((r) => r.unresolved && r.mandatory && (r.priority === 'critical' || r.category === 'Security and privacy' || r.category === 'Database'))
  if (critical.length) warnings.push(`Critical unresolved decisions: ${critical.map((r) => r.id).join(', ')}`)
  if (!p.specifications.security.trim()) warnings.push('Security architecture is unresolved.')
  const secretPatterns = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\b(?:sk|rk)-[A-Za-z0-9_-]{20,}\b/, /\b(?:password|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*[^\s<>{}]{8,}/i]
  const leaked = [...files].filter(([, body]) => secretPatterns.some((pattern) => pattern.test(body))).map(([name]) => name)
  if (leaked.length) failed.push(`Possible secret-like text detected in ${leaked.join(', ')}`)
  else passed.push('Heuristic scan found no common secret patterns')
  if (!warnings.length) passed.push('No readiness warnings detected')
  return { passed, warnings, failed, unavailable }
}
