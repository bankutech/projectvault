# ProjectVault

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Hono](https://img.shields.io/badge/Hono-4.13-E36002.svg?logo=hono&logoColor=white)](https://hono.dev/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers_%26_D1-F38020.svg?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live_Demo-000000.svg?logo=vercel&logoColor=white)](https://projectvault-pi.vercel.app)
[![Tests](https://img.shields.io/badge/E2E_Tests-12%2F12_Passed-success.svg)](#7-automated-test-suite)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**ProjectVault** is a multi-project engineering workspace designed to define, manage, audit, and export build-ready implementation packages for **Google Antigravity**. It maintains strict project isolation, interactive persistent requirements checklists, and generates validated implementation specification ZIP archives with pure-JavaScript in-memory archive packaging and CRC32 verification.

---

## Author & Maintainer

- **Lead Engineer**: Sagnik Mitra
- **Email**: [sagnikmitra1302@gmail.com](mailto:sagnikmitra1302@gmail.com)
- **GitHub**: [@bankutech](https://github.com/bankutech)

---

## Table of Contents

- [Key Capabilities](#key-capabilities)
- [1. Quick Start Guide (Windows / Linux / macOS)](#1-quick-start-guide)
- [2. Local vs. Cloud Dependencies](#2-local-vs-cloud-dependencies)
- [3. Environment Variables Reference](#3-environment-variables-reference)
- [4. Multi-Project Architecture & Data Isolation](#4-multi-project-architecture--data-isolation)
- [5. The 19 Workspace Specification Modules](#5-the-19-workspace-specification-modules)
- [6. Generated Specification ZIP Structure](#6-generated-specification-zip-structure)
- [7. Automated Test Suite (12 Scenarios)](#7-automated-test-suite)
- [8. Deployment Guide](#8-deployment-guide)
  - [Deploy to Vercel](#deploy-to-vercel)
  - [Deploy to Cloudflare Workers / Pages](#deploy-to-cloudflare-workers--pages)
- [9. Troubleshooting & FAQ](#9-troubleshooting--faq)
- [10. License](#10-license)

---

## Key Capabilities

- **Strict Multi-Project Isolation**: Create unlimited independent projects (e.g. *Project 01 — Email Automation*, *Project 02 — School ERP*, *Project 03 — AI Portfolio*, *Project 04 — Student Management System*). Data, requirements, prompts, and exports never leak between projects.
- **Interactive Requirements Checklist**: Track priorities, mandatory tags, dependencies, and explicit acceptance criteria. Flag unresolved questions before committing to build.
- **Pure-JavaScript ZIP Engine**: Implements RFC 1951 / ZIP32 archive generation in memory with CRC32 integrity verification, running completely client- and worker-compatible without external command-line utilities.
- **Antigravity Prompt Engine**: Automatically synthesizes saved technical decisions into a cohesive **Master Implementation Prompt** alongside 6 phased execution prompts (`01_ANALYSIS_AND_PLANNING` through `06_FINAL_VERIFICATION`).
- **Outdated Export Detection**: Detects requirement modifications made after an export and visually alerts engineers that previously downloaded ZIP packages are potentially outdated.
- **Heuristic Secret Leakage Scanner**: Scans all exported files for private keys, tokens, and secret patterns, failing exports before sensitive credentials can be packaged.
- **Preloaded Starter Templates**: Preload comprehensive reference projects with a single click.

---

## 1. Quick Start Guide

### Prerequisites

| Requirement | Supported Version | Notes |
| :--- | :--- | :--- |
| **Operating System** | Windows 10/11, macOS, Linux | Tested on Windows with PowerShell |
| **Node.js** | v20.19+ or v22.12+ (LTS) | `node -v` |
| **Package Manager** | npm (bundled with Node.js) or Bun | `npm -v` |

### Installation & Startup Commands

Open your terminal or PowerShell in the project directory:

```bash
# 1. Install dependencies
npm install

# 2. Setup local environment variables (safe template without real credentials)
cp .dev.vars.example .dev.vars    # On Linux/macOS
# OR on Windows PowerShell:
Copy-Item .dev.vars.example .dev.vars

# 3. Start local development server
npm run dev
```

The application will start on **`http://localhost:5173`**.

### Available Commands

```bash
npm run dev        # Starts Vite dev server with Cloudflare Workers runtime and local D1 SQLite
npm test           # Executes automated end-to-end test suite (12 verification scenarios)
npm run typecheck  # Validates TypeScript types (tsc --noEmit)
npm run build      # Produces optimized production client bundle and Worker dist
npm run preview    # Previews production build locally
```

---

## 2. Local vs. Cloud Dependencies

### What Works 100% Offline (No Cloud Credentials Needed)
- Creating, editing, duplicating, and deleting unlimited independent projects.
- Interactive requirements checklist with criteria and dependencies.
- All 19 workspace specification modules.
- Pre-seeding standard reference projects (`01` through `04`).
- Real-time export readiness scorecard and validation checks.
- Dynamic Antigravity master prompt and 6-phase execution prompt generation.
- Pure-JavaScript ZIP package generation, CRC32 verification, and downloading.
- Export version history and diff comparison modal.
- Local SQLite database persistence (stored under `.wrangler/state/v3/d1/`).

### What Requires External Cloud Services
- **Hosted Cloudflare D1 Deployment**: Requires a Cloudflare account with a D1 database provisioned via Wrangler CLI (`wrangler d1 create`).
- **Production Authentication**: For local development, ProjectVault automatically operates in self-contained developer identity mode (`sub: dev-user`), requiring zero external OAuth setup.

---

## 3. Environment Variables Reference

A safe template is provided in `.dev.vars.example`:

```ini
# Copy to .dev.vars for local development
APP_ORIGIN=http://localhost:5173
AUTH_SECRET=
```

> **Security Note**: Never store real production API keys, tokens, or database passwords in `.dev.vars` or project requirements.

---

## 4. Multi-Project Architecture & Data Isolation

```
┌───────────────────────────────────────────────────────────────┐
│                      ProjectVault Core                        │
├───────────────────────────────┬───────────────────────────────┤
│  Project 01 — Email Pipeline  │  Project 02 — School ERP      │
│  - Requirements Checklist     │  - Requirements Checklist     │
│  - Specs & Technical Decisions│  - Specs & Technical Decisions│
│  - Antigravity Prompts        │  - Antigravity Prompts        │
│  - ZIP Specification Archives │  - ZIP Specification Archives │
├───────────────────────────────┼───────────────────────────────┤
│  Project 03 — 3D Portfolio    │  Project 04 — Student Portal  │
└───────────────────────────────┴───────────────────────────────┘
```

Every project has its own isolated:
1. Internal unique ID (`id`, UUID) and user-assignable Project Code (`projectCode`).
2. Requirements checklist (stored in `requirements_json`).
3. Technical specifications (stored in `specifications_json`).
4. Specification version (`specificationVersion`).
5. Export history (`vault_exports` table with SHA-256 snapshot hashes).
6. Export readiness state.

### Server-Side Authorization Enforcement
- Authorization is strictly enforced in the backend worker ([`src/worker/routes/projectvault.ts`](src/worker/routes/projectvault.ts)).
- All database queries scope to `WHERE owner_sub = ? AND id = ?`.
- Modifying a URL parameter or ID to request another user's project returns `404 Not Found` or `403 Forbidden`.

---

## 5. The 19 Workspace Specification Modules

1. **Overview**: Project identity, category, status, tech stack, and readiness scorecard.
2. **Requirements Checklist**: Interactive checklist with priorities, dependencies, acceptance criteria, presets, and clarification flags.
3. **Product Specification**: Purpose, objectives, feature list, and explicit exclusions.
4. **UI/UX Requirements**: Design language, responsive breakpoints (375px / 768px / 1280px), accessibility (WCAG AA), and states.
5. **Frontend Specification**: Framework architecture, state management, form validation, and component standards.
6. **Backend Specification**: Route contracts, HTTP methods, authorization headers, and error envelopes.
7. **Database Design**: Technology choice, schema entities, foreign key constraints, indexes, and migrations.
8. **Authentication & Authorization**: Session tokens, OIDC/OAuth, role-based access control, and project scoping.
9. **Security Requirements**: Secret leakage prevention, input sanitization, CSRF/CORS, rate limiting, and audit trails.
10. **Integrations & APIs**: External API contracts, webhook handlers, and variable name documentation.
11. **Business Logic & Workflows**: Step-by-step user workflows and business invariants.
12. **Architecture & File Structure**: Directory blueprint and module boundaries.
13. **Testing & Acceptance Criteria**: Unit, integration, E2E testing levels and acceptance criteria matrices.
14. **Deployment Instructions**: Target platforms (Workers, Docker, Vercel), build scripts, and safe environment documentation.
15. **Development Notes & Decisions**: Architectural rationale, trade-offs, and phased execution sequence.
16. **Bugs & Known Limitations**: Technical constraints, provider limits, and unresolved assumptions.
17. **Antigravity Prompt Builder**: Complete master prompt and phase prompts (01 to 06) derived from saved project data.
18. **Export Center**: Export mode selection, pre-export validation report, and ZIP package downloader.
19. **Version History**: Immutable history of generated packages with an interactive diff comparison modal.

---

## 6. Generated Specification ZIP Structure

Each exported `.zip` contains a complete implementation specification bundle:

```text
ProjectVault_Export_[Project-Code]_v[Version]/
├── README.md
├── PROJECT_MANIFEST.json
├── PROJECT_SPECIFICATION.md
├── REQUIREMENTS_CHECKLIST.json
├── REQUIREMENTS_CHECKLIST.md
├── USER_WORKFLOWS.md
├── UI_UX_SPECIFICATION.md
├── TECHNICAL_ARCHITECTURE.md
├── DATABASE_SPECIFICATION.md
├── API_SPECIFICATION.md
├── SECURITY_REQUIREMENTS.md
├── TESTING_AND_ACCEPTANCE.md
├── DEPLOYMENT_GUIDE.md
├── IMPLEMENTATION_PLAN.md
├── KNOWN_LIMITATIONS.md
├── ANTIGRAVITY_MASTER_PROMPT.md
├── ANTIGRAVITY_PHASE_PROMPTS/
│   ├── 01_ANALYSIS_AND_PLANNING.md
│   ├── 02_FOUNDATION_AND_ARCHITECTURE.md
│   ├── 03_CORE_IMPLEMENTATION.md
│   ├── 04_INTEGRATION_AND_SECURITY.md
│   ├── 05_TESTING_AND_REFINEMENT.md
│   └── 06_FINAL_VERIFICATION.md
├── TRACEABILITY/
│   ├── REQUIREMENT_TO_FEATURE_MATRIX.csv
│   └── REQUIREMENT_TO_TEST_MATRIX.csv
├── EXPORT_METADATA.json
└── EXPORT_VALIDATION_REPORT.md
```

### Export Modes:
- **Mode A (Default)**: Implementation Specification Package. Contains all specifications, checklist, prompts, and traceability matrices.
- **Mode B**: Existing Project Source Package. Intended for projects with connected source repositories; if no repository is connected, manifest and validation report clearly state that the package contains verified specifications only.

---

## 7. Automated Test Suite

Run `npm test` in your terminal to execute the end-to-end verification suite:

```bash
npm test
```

### Verification Scenarios (12/12 Passing)
1. **Multi-Project Creation**: Creates independent projects with distinct requirements.
2. **Project Isolation**: Edits Project Alpha and verifies Project Beta remains completely unchanged.
3. **Prompt Isolation**: Generates separate Antigravity prompts and confirms zero data cross-contamination.
4. **ZIP Archive Isolation**: Exports ZIP archives for both projects and verifies strict separation of archive contents.
5. **JSON Schema Integrity**: Validates JSON syntax across manifests, checklists, and metadata inside the ZIP.
6. **Archive Header Verification**: Verifies ZIP end of central directory records, headers, and CRC32 checksums.
7. **Readiness Scorecard Validation**: Confirms that missing critical requirements produce clear readiness warnings.
8. **Outdated Export Detection**: Flags previously generated exports as outdated when requirements change.
9. **Version Diffing**: Verifies accuracy of added, removed, and modified requirements in export comparisons.
10. **Zero Secret Leakage**: Confirms heuristic scanner rejects API keys, SSH private keys, and secret strings.
11. **Edge Cases**: Validates empty projects, duplicate names, long Unicode descriptions, and invalid inputs.
12. **Authorization Boundaries**: Verifies cross-account access denial and project isolation.

---

## 8. Deployment Guide

### Deploy to Vercel

- **Live Production URL**: [https://projectvault-pi.vercel.app](https://projectvault-pi.vercel.app)

ProjectVault includes a pre-configured [`vercel.json`](vercel.json) for instantaneous deployment:

```bash
# 1. Install or run Vercel CLI
npx vercel

# 2. Deploy to Production
npx vercel --prod
```

### Deploy to Cloudflare Workers / Pages

```bash
# 1. Provision a Cloudflare D1 database
npx wrangler d1 create projectvault-db

# 2. Update wrangler.jsonc with your D1 database ID

# 3. Deploy
npx wrangler deploy
```

---

## 9. Troubleshooting & FAQ

- **Port 5173 is already in use**:
  - Windows PowerShell: `Stop-Process -Name node -Force`
  - Linux / macOS: `killall node` or `lsof -ti:5173 | xargs kill -9`
- **TypeScript Typecheck**:
  - Run `npm run typecheck`. Ensure you are using Node.js v20.19+ or v22.12+.
- **Database Initialization**:
  - D1 SQLite tables are initialized automatically on the first request to the Worker isolate. No manual SQL migrations are required.

---

## 10. License

This project is licensed under the [MIT License](LICENSE).

Copyright (c) 2026 Sagnik Mitra. All rights reserved.
