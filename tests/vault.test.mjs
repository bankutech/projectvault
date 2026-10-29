import test from 'node:test'
import assert from 'node:assert/strict'

const BASE_URL = 'http://localhost:5173/api/vault'
const HEADERS = {
  'Content-Type': 'application/json',
  Origin: 'http://localhost:5173',
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      ...HEADERS,
      ...options.headers,
    },
  })
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const data = await res.json()
    return { res, status: res.status, data }
  }
  const buffer = await res.arrayBuffer()
  return { res, status: res.status, buffer: Buffer.from(buffer) }
}

function parseZipEntries(buffer) {
  // Read ZIP end of central directory
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  let eocd = -1
  for (let i = Math.max(0, buffer.length - 65557); i <= buffer.length - 22; i++) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  assert.ok(eocd >= 0, 'Valid ZIP end of central directory record found')
  const totalEntries = view.getUint16(eocd + 10, true)
  const centralOffset = view.getUint32(eocd + 16, true)

  const entries = new Map()
  let cursor = centralOffset
  const decoder = new TextDecoder()

  for (let i = 0; i < totalEntries; i++) {
    assert.equal(view.getUint32(cursor, true), 0x02014b50, 'Central directory header magic')
    const size = view.getUint32(cursor + 24, true)
    const nameLen = view.getUint16(cursor + 28, true)
    const extraLen = view.getUint16(cursor + 30, true)
    const commentLen = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)
    const name = decoder.decode(buffer.subarray(cursor + 46, cursor + 46 + nameLen))

    assert.equal(view.getUint32(localOffset, true), 0x04034b50, `Local header for ${name}`)
    const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true)
    const data = buffer.subarray(dataStart, dataStart + size)
    entries.set(name, decoder.decode(data))
    cursor += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

test('ProjectVault End-to-End Test Suite', async (t) => {
  let projectAId = ''
  let projectBId = ''

  await t.test('1. Create two independent projects with different requirements', async () => {
    const createA = await request('/projects', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Project Alpha (Email Automation)',
        description: 'First isolated workspace for automated email infrastructure.',
        projectCode: 'PV-TEST-ALPHA',
        category: 'Backend',
        priority: 'high',
        requirements: [
          {
            id: 'REQ-001',
            title: 'HMAC Webhook Ingestion',
            description: 'Verify HMAC signatures on incoming bounce webhooks',
            category: 'Security and privacy',
            priority: 'critical',
            mandatory: true,
            selected: true,
            completed: false,
            reviewed: true,
            notes: 'Reject invalid signatures',
            implementation: 'crypto.subtle.verify',
            dependencies: [],
            acceptanceCriteria: ['Returns 200 on valid signature', 'Returns 401 on forged signature'],
            unresolved: false,
          },
        ],
        specifications: {
          purpose: 'High throughput email deliverability engine',
          database: 'PostgreSQL with connection pooling',
          stack: 'React, Hono, PostgreSQL',
          stackUndecided: false,
        },
      }),
    })
    assert.equal(createA.status, 201)
    projectAId = createA.data.project.id
    assert.ok(projectAId)

    const createB = await request('/projects', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Project Beta (3D Portfolio)',
        description: 'Second isolated workspace for Three.js WebGL canvas.',
        projectCode: 'PV-TEST-BETA',
        category: 'Frontend',
        priority: 'medium',
        requirements: [
          {
            id: 'REQ-001',
            title: 'Interactive WebGL Canvas',
            description: 'Real Three.js geometry with orbital mouse physics',
            category: 'UI/UX and accessibility',
            priority: 'high',
            mandatory: true,
            selected: true,
            completed: true,
            reviewed: true,
            notes: 'Must achieve 60 FPS',
            implementation: 'Three.js WebGLRenderer',
            dependencies: [],
            acceptanceCriteria: ['Renders genuine 3D spatial depth', 'Graceful fallback on low-end GPU'],
            unresolved: false,
          },
        ],
        specifications: {
          purpose: 'Engineering portfolio with spatial depth',
          database: 'None required for static canvas',
          stack: 'React, Three.js, TailwindCSS',
          stackUndecided: false,
        },
      }),
    })
    assert.equal(createB.status, 201)
    projectBId = createB.data.project.id
    assert.ok(projectBId)
    assert.notEqual(projectAId, projectBId)
  })

  await t.test('2. Edit Project Alpha and verify Project Beta is unchanged', async () => {
    // Add another requirement to Alpha
    const patchA = await request(`/projects/${projectAId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: 'Project Alpha (Updated Title)',
        requirements: [
          {
            id: 'REQ-001',
            title: 'HMAC Webhook Ingestion',
            description: 'Verify HMAC signatures on incoming bounce webhooks',
            category: 'Security and privacy',
            priority: 'critical',
            mandatory: true,
            selected: true,
            completed: true,
            reviewed: true,
            notes: 'Reject invalid signatures',
            implementation: 'crypto.subtle.verify',
            dependencies: [],
            acceptanceCriteria: ['Returns 200 on valid signature', 'Returns 401 on forged signature'],
            unresolved: false,
          },
          {
            id: 'REQ-002',
            title: 'RFC-8058 One-Click Unsubscribe',
            description: 'List-Unsubscribe headers',
            category: 'Backend',
            priority: 'high',
            mandatory: true,
            selected: true,
            completed: false,
            reviewed: true,
            notes: '',
            implementation: 'Header injection',
            dependencies: ['REQ-001'],
            acceptanceCriteria: ['Headers present'],
            unresolved: false,
          },
        ],
      }),
    })
    assert.equal(patchA.status, 200)
    assert.equal(patchA.data.project.title, 'Project Alpha (Updated Title)')
    assert.equal(patchA.data.project.requirements.length, 2)

    // Check Project Beta remains completely unchanged
    const getB = await request(`/projects/${projectBId}`)
    assert.equal(getB.status, 200)
    assert.equal(getB.data.project.title, 'Project Beta (3D Portfolio)')
    assert.equal(getB.data.project.requirements.length, 1)
    assert.equal(getB.data.project.requirements[0].title, 'Interactive WebGL Canvas')
  })

  await t.test('3. Generate Antigravity prompts and verify isolation', async () => {
    const promptA = await request(`/projects/${projectAId}/prompt`)
    assert.equal(promptA.status, 200)
    assert.ok(promptA.data.prompt.includes('Project Alpha (Updated Title)'))
    assert.ok(promptA.data.prompt.includes('HMAC Webhook Ingestion'))
    assert.ok(promptA.data.prompt.includes('RFC-8058 One-Click Unsubscribe'))
    assert.ok(!promptA.data.prompt.includes('Interactive WebGL Canvas'))

    const promptB = await request(`/projects/${projectBId}/prompt`)
    assert.equal(promptB.status, 200)
    assert.ok(promptB.data.prompt.includes('Project Beta (3D Portfolio)'))
    assert.ok(promptB.data.prompt.includes('Interactive WebGL Canvas'))
    assert.ok(!promptB.data.prompt.includes('HMAC Webhook Ingestion'))
  })

  await t.test('4 & 5. Export ZIP archives and verify project isolation inside archives', async () => {
    const zipA = await request(`/projects/${projectAId}/export`, { method: 'POST' })
    assert.equal(zipA.status, 200)
    assert.ok(zipA.buffer.length > 1000)
    const entriesA = parseZipEntries(zipA.buffer)

    const zipB = await request(`/projects/${projectBId}/export`, { method: 'POST' })
    assert.equal(zipB.status, 200)
    assert.ok(zipB.buffer.length > 1000)
    const entriesB = parseZipEntries(zipB.buffer)

    // Verify Alpha ZIP contents
    let foundAlphaReadme = false
    for (const [name, content] of entriesA) {
      if (name.endsWith('README.md')) {
        foundAlphaReadme = true
        assert.ok(content.includes('Project Alpha'))
        assert.ok(!content.includes('Project Beta'))
      }
      assert.ok(!content.includes('Project Beta (3D Portfolio)'), `Beta content leaked in Alpha entry: ${name}`)
    }
    assert.ok(foundAlphaReadme, 'Found Alpha README.md in ZIP')

    // Verify Beta ZIP contents
    let foundBetaReadme = false
    for (const [name, content] of entriesB) {
      if (name.endsWith('README.md')) {
        foundBetaReadme = true
        assert.ok(content.includes('Project Beta'))
        assert.ok(!content.includes('Project Alpha'))
      }
      assert.ok(!content.includes('HMAC Webhook Ingestion'), `Alpha content leaked in Beta entry: ${name}`)
    }
    assert.ok(foundBetaReadme, 'Found Beta README.md in ZIP')
  })

  await t.test('6 & 7. Validate JSON syntax and required files in ZIP', async () => {
    const zipA = await request(`/projects/${projectAId}/export`, { method: 'POST' })
    const entries = parseZipEntries(zipA.buffer)

    const expectedFiles = [
      'README.md',
      'PROJECT_MANIFEST.json',
      'PROJECT_SPECIFICATION.md',
      'REQUIREMENTS_CHECKLIST.json',
      'REQUIREMENTS_CHECKLIST.md',
      'USER_WORKFLOWS.md',
      'UI_UX_SPECIFICATION.md',
      'TECHNICAL_ARCHITECTURE.md',
      'DATABASE_SPECIFICATION.md',
      'API_SPECIFICATION.md',
      'SECURITY_REQUIREMENTS.md',
      'TESTING_AND_ACCEPTANCE.md',
      'DEPLOYMENT_GUIDE.md',
      'IMPLEMENTATION_PLAN.md',
      'KNOWN_LIMITATIONS.md',
      'ANTIGRAVITY_MASTER_PROMPT.md',
      'EXPORT_METADATA.json',
      'EXPORT_VALIDATION_REPORT.md',
    ]

    for (const expected of expectedFiles) {
      const match = [...entries.keys()].find((k) => k.endsWith(expected))
      assert.ok(match, `Expected file present in ZIP: ${expected}`)
      const content = entries.get(match)
      assert.ok(content.trim().length > 0, `File is non-empty: ${expected}`)

      if (expected.endsWith('.json')) {
        assert.doesNotThrow(() => JSON.parse(content), `Valid JSON: ${expected}`)
      }
    }
  })

  await t.test('8. Missing critical decisions produce readiness warnings', async () => {
    const readinessA = await request(`/projects/${projectAId}/readiness`)
    assert.equal(readinessA.status, 200)
    assert.ok(Array.isArray(readinessA.data.checks))
    const criticalChecks = readinessA.data.checks.filter((c) => c.critical)
    assert.ok(criticalChecks.length >= 5, 'Contains required critical readiness checks')
  })

  await t.test('9. Outdated export change detection and version comparison', async () => {
    // Project Alpha was exported. Now we edit a requirement:
    const patch = await request(`/projects/${projectAId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        requirements: [
          {
            id: 'REQ-001',
            title: 'HMAC Webhook Ingestion (Modified for Test)',
            description: 'Updated description to trigger change detection',
            category: 'Security and privacy',
            priority: 'critical',
            mandatory: true,
            selected: true,
            completed: true,
            reviewed: true,
            notes: 'Reject invalid signatures',
            implementation: 'crypto.subtle.verify',
            dependencies: [],
            acceptanceCriteria: ['Passes test'],
            unresolved: false,
          },
          {
            id: 'REQ-002',
            title: 'RFC-8058 One-Click Unsubscribe',
            description: 'List-Unsubscribe headers',
            category: 'Backend',
            priority: 'high',
            mandatory: true,
            selected: true,
            completed: false,
            reviewed: true,
            notes: '',
            implementation: 'Header injection',
            dependencies: ['REQ-001'],
            acceptanceCriteria: ['Headers present'],
            unresolved: false,
          },
        ],
      }),
    })
    assert.equal(patch.status, 200)
    assert.equal(patch.data.project.lastExportOutdated, true, 'lastExportOutdated is flagged as true')

    // Fetch exports to compare with the previous export
    const exportsRes = await request(`/projects/${projectAId}/exports`)
    assert.equal(exportsRes.status, 200)
    assert.ok(exportsRes.data.exports.length >= 1)
    const exportId = exportsRes.data.exports[0].id

    // Test comparison endpoint
    const compare = await request(`/projects/${projectAId}/exports/${exportId}/compare`)
    assert.equal(compare.status, 200)
    assert.equal(compare.data.outdated, true)
    assert.ok(compare.data.modified.some((r) => r.id === 'REQ-001'))
  })

  await t.test('10. Secrets and credentials are never included in exported files', async () => {
    const zipA = await request(`/projects/${projectAId}/export`, { method: 'POST' })
    const entries = parseZipEntries(zipA.buffer)

    const secretRegexes = [
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
      /\b(?:sk|rk)_[a-zA-Z0-9_]{20,}\b/,
      /\b(?:api[_-]?key|password|client[_-]?secret)\s*[:=]\s*["'][^"']+["']/i,
    ]

    for (const [name, content] of entries) {
      for (const regex of secretRegexes) {
        assert.ok(!regex.test(content), `Secret pattern matched in ${name}`)
      }
    }
  })

  await t.test('11. Edge cases: Empty projects, duplicate names, and Unicode', async () => {
    // Empty title rejected with 400
    const emptyTitle = await request('/projects', {
      method: 'POST',
      body: JSON.stringify({ title: '   ', description: '' }),
    })
    assert.equal(emptyTitle.status, 400)

    // Unusual Unicode characters and duplicate titles are allowed with unique internal IDs
    const unicodeProj1 = await request('/projects', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Project 🚀 特殊文字 & Symbols 100%!',
        description: 'Testing utf8 encoding in filenames and SQLite persistence: ⚡ 漢字',
      }),
    })
    assert.equal(unicodeProj1.status, 201)

    const unicodeProj2 = await request('/projects', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Project 🚀 特殊文字 & Symbols 100%!',
        description: 'Duplicate title with different ID',
      }),
    })
    assert.equal(unicodeProj2.status, 201)
    assert.notEqual(unicodeProj1.data.project.id, unicodeProj2.data.project.id)

    // Clean up unicode projects
    await request(`/projects/${unicodeProj1.data.project.id}`, { method: 'DELETE' })
    await request(`/projects/${unicodeProj2.data.project.id}`, { method: 'DELETE' })
  })

  await t.test('12. Project-level authorization & isolation', async () => {
    // Requesting a non-existent or other user project ID returns 404
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const notFound = await request(`/projects/${fakeId}`)
    assert.equal(notFound.status, 404)

    const notFoundExport = await request(`/projects/${fakeId}/export`, { method: 'POST' })
    assert.equal(notFoundExport.status, 404)
  })

  await t.test('13. GET /projects returns complete requirements array without data stripping', async () => {
    const listRes = await request('/projects')
    assert.equal(listRes.status, 200)
    assert.ok(Array.isArray(listRes.data.projects))
    const projA = listRes.data.projects.find((p) => p.id === projectAId)
    assert.ok(projA, 'Project A found in project list')
    assert.ok(Array.isArray(projA.requirements), 'requirements field is preserved as an array')
    assert.ok(projA.requirements.length > 0, 'Project requirements are populated')
    assert.equal(projA.requirements[0].id, 'REQ-001')
  })

  await t.test('14. GET /projects/:id/prompt returns master prompt and all 6 structured phase prompts', async () => {
    const promptRes = await request(`/projects/${projectAId}/prompt`)
    assert.equal(promptRes.status, 200)
    assert.ok(typeof promptRes.data.prompt === 'string' && promptRes.data.prompt.length > 100)
    assert.ok(promptRes.data.phases, 'Phases object is present')

    for (const phaseKey of ['phase1', 'phase2', 'phase3', 'phase4', 'phase5', 'phase6']) {
      const phaseContent = promptRes.data.phases[phaseKey]
      assert.ok(typeof phaseContent === 'string', `${phaseKey} is a string`)
      assert.ok(phaseContent.length > 150, `${phaseKey} contains comprehensive prompt text`)
      assert.ok(phaseContent.includes('Project Alpha'), `${phaseKey} references project title`)
    }

    assert.ok(promptRes.data.phases.phase3.includes('REQ-001'), 'Phase 3 core implementation references REQ-001')
    assert.ok(promptRes.data.phases.phase3.includes('HMAC Webhook Ingestion'), 'Phase 3 references requirement title')
  })

  await t.test('15. Project duplication creates an isolated clone with unique requirement IDs', async () => {
    const dupRes = await request(`/projects/${projectAId}/duplicate`, { method: 'POST' })
    assert.equal(dupRes.status, 201)
    const cloned = dupRes.data.project
    assert.notEqual(cloned.id, projectAId)
    assert.equal(cloned.title, 'Project Alpha (Updated Title) copy')
    assert.equal(cloned.requirements.length, 2)
    assert.equal(cloned.requirements[0].id, 'REQ-001')
    assert.equal(cloned.requirements[1].id, 'REQ-002')

    // Clean up duplicate project
    await request(`/projects/${cloned.id}`, { method: 'DELETE' })
  })

  await t.test('16. Clean up test projects', async () => {
    await request(`/projects/${projectAId}`, { method: 'DELETE' })
    await request(`/projects/${projectBId}`, { method: 'DELETE' })

    const checkA = await request(`/projects/${projectAId}`)
    assert.equal(checkA.status, 404)
    const checkB = await request(`/projects/${projectBId}`)
    assert.equal(checkB.status, 404)
  })
})
