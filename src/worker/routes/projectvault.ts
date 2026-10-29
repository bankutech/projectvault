import { Hono } from 'hono'
import type { Context } from 'hono'

import { privateJson } from '../auth'
import { id, now } from '../db'
import type { AppContext } from '../env'
import type { ExportRecord, ProjectRecord, ProjectSpecifications, Requirement } from '../../shared/projectvault'
import { STARTER_TEMPLATES } from '../../shared/templates'
import {
  blankSpec,
  text,
  safeSlug,
  validPriorities,
  validStatuses,
  normalizeRequirement,
  normalizeSpec,
  hash,
  snapshot,
  readiness,
  promptFor,
  phasePromptsFor,
  makeFiles,
  validate,
  zipStore,
  verifyZip,
} from '../../shared/engine'

export const projectvault = new Hono<AppContext>()

function mapProject(row: Record<string, unknown>, exports: ExportRecord[] = []): ProjectRecord {
  let requirements: Requirement[] = []
  try {
    requirements = JSON.parse(String(row.requirements_json ?? '[]')).map(normalizeRequirement)
  } catch {
    requirements = []
  }
  let specifications: ProjectSpecifications = blankSpec
  try {
    specifications = normalizeSpec(JSON.parse(String(row.specifications_json ?? '{}')))
  } catch {
    specifications = blankSpec
  }
  const p = {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description ?? ''),
    projectCode: String(row.project_code ?? ''),
    category: String(row.category ?? 'General'),
    priority: row.priority as ProjectRecord['priority'],
    status: row.status as ProjectRecord['status'],
    pinned: Number(row.pinned) === 1,
    archived: Number(row.archived) === 1,
    requirements,
    specifications,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    lastOpenedAt: row.last_opened_at == null ? null : Number(row.last_opened_at),
    specificationVersion: Number(row.specification_version),
    exportCount: exports.length,
    lastExportAt: exports[0]?.createdAt ?? null,
    lastExportOutdated: false,
  } satisfies ProjectRecord
  return { ...p, lastExportOutdated: exports[0] ? hash(snapshot(p)) !== exports[0].snapshotHash : false }
}
async function ownProject(c: Context<AppContext>, projectId: string) {
  return c.get('db').prepare('SELECT * FROM vault_projects WHERE owner_sub = ? AND id = ?').bind(c.get('user').sub, projectId).first<Record<string, unknown>>()
}
async function getExports(c: Context<AppContext>, projectId: string): Promise<ExportRecord[]> {
  const { results } = await c.get('db').prepare('SELECT * FROM vault_exports WHERE owner_sub = ? AND project_id = ? ORDER BY created_at DESC, export_version DESC').bind(c.get('user').sub, projectId).all<Record<string, unknown>>()
  return results.map((r) => ({ id: String(r.id), projectId: String(r.project_id), exportVersion: Number(r.export_version), specificationVersion: Number(r.specification_version), requirementCount: Number(r.requirement_count), completedCount: Number(r.completed_count), validation: JSON.parse(String(r.validation_json)), snapshotHash: String(r.snapshot_hash), createdAt: Number(r.created_at) }))
}
async function loadProject(c: Context<AppContext>, row: Record<string, unknown>) { return mapProject(row, await getExports(c, String(row.id))) }

projectvault.get('/projects',async(c)=>{
  const q=(c.req.query('q')??'').trim().slice(0,150),archived=c.req.query('archived')==='true'
  const {results}=await c.get('db').prepare("SELECT * FROM vault_projects WHERE owner_sub=? AND archived=? AND (?='' OR title LIKE ? OR project_code LIKE ? OR category LIKE ?) ORDER BY pinned DESC,updated_at DESC").bind(c.get('user').sub,archived?1:0,q,`%${q}%`,`%${q}%`,`%${q}%`).all<Record<string,unknown>>()
  return privateJson(c, { projects: await Promise.all(results.map((row) => loadProject(c, row))) })
})
projectvault.post('/projects',async(c)=>{
  const input=await c.req.json<Record<string,unknown>>(),title=text(input.title,160).trim();if(!title)return privateJson(c,{error:'Project name is required.'},400)
  const timestamp=now(),projectId=id(),priority=validPriorities.includes(text(input.priority) as never)?text(input.priority):'medium'
  const requirements=Array.isArray(input.requirements)?input.requirements.map(normalizeRequirement):[]
  const specifications=input.specifications?normalizeSpec(input.specifications):blankSpec
  await c.get('db').prepare('INSERT INTO vault_projects (id,owner_sub,title,description,project_code,category,priority,status,pinned,archived,requirements_json,specifications_json,specification_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(projectId,c.get('user').sub,title,text(input.description,2000),text(input.projectCode,64),text(input.category,100)||'General',priority,'draft',0,0,JSON.stringify(requirements),JSON.stringify(specifications),1,timestamp,timestamp).run()
  return privateJson(c,{project:await loadProject(c,(await ownProject(c,projectId))!)},201)
})
projectvault.post('/seed-starter-projects',async(c)=>{
  const owner=c.get('user').sub,db=c.get('db'),seeded:string[]=[]
  for(const tpl of STARTER_TEMPLATES){
    const existing=await db.prepare('SELECT id FROM vault_projects WHERE owner_sub=? AND (project_code=? OR title=?)').bind(owner,tpl.projectCode,tpl.title).first()
    if(!existing){
      const pid=id(),timestamp=now()
      await db.prepare('INSERT INTO vault_projects (id,owner_sub,title,description,project_code,category,priority,status,pinned,archived,requirements_json,specifications_json,specification_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(pid,owner,tpl.title,tpl.description,tpl.projectCode,tpl.category,tpl.priority,'draft',0,0,JSON.stringify(tpl.requirements),JSON.stringify(tpl.specifications),1,timestamp,timestamp).run()
      seeded.push(tpl.title)
    }
  }
  return privateJson(c,{seeded,count:seeded.length})
})
projectvault.get('/projects/:id',async(c)=>{
  const projectId=c.req.param('id'),row=await ownProject(c,projectId);if(!row)return privateJson(c,{error:'Project not found.'},404)
  const opened=now();await c.get('db').prepare('UPDATE vault_projects SET last_opened_at=? WHERE owner_sub=? AND id=?').bind(opened,c.get('user').sub,projectId).run()
  return privateJson(c,{project:await loadProject(c,{...row,last_opened_at:opened})})
})
projectvault.patch('/projects/:id',async(c)=>{
  const owner=c.get('user').sub,projectId=c.req.param('id'),row=await ownProject(c,projectId);if(!row)return privateJson(c,{error:'Project not found.'},404)
  const input=await c.req.json<Record<string,unknown>>(),current=await loadProject(c,row),title=input.title===undefined?current.title:text(input.title,160).trim();if(!title)return privateJson(c,{error:'Project name is required.'},400)
  const description=input.description===undefined?current.description:text(input.description,2000),code=input.projectCode===undefined?current.projectCode:text(input.projectCode,64),category=input.category===undefined?current.category:(text(input.category,100)||'General')
  const priority=input.priority===undefined?current.priority:(validPriorities.includes(text(input.priority) as never)?text(input.priority) as ProjectRecord['priority']:current.priority)
  const status=input.status===undefined?current.status:(validStatuses.includes(text(input.status) as never)?text(input.status) as ProjectRecord['status']:current.status)
  const requirements=input.requirements===undefined?current.requirements:(Array.isArray(input.requirements)?input.requirements.map(normalizeRequirement):current.requirements),specifications=input.specifications===undefined?current.specifications:normalizeSpec(input.specifications)
  const ids=requirements.map((r)=>r.id);if(new Set(ids).size!==ids.length)return privateJson(c,{error:'Requirement IDs must be unique within this project.'},400)
  const invalidDependency=requirements.flatMap((r)=>r.dependencies.filter((dependency)=>!ids.includes(dependency)).map((dependency)=>`${r.id} depends on missing ${dependency}`))
  const next={...current,title,description,projectCode:code,category,priority,status,requirements,specifications},changed=snapshot(current)!==snapshot(next),timestamp=now()
  await c.get('db').prepare('UPDATE vault_projects SET title=?,description=?,project_code=?,category=?,priority=?,status=?,pinned=?,archived=?,requirements_json=?,specifications_json=?,specification_version=specification_version+?,updated_at=? WHERE owner_sub=? AND id=?').bind(title,description,code,category,priority,status,input.pinned===undefined?Number(row.pinned):input.pinned?1:0,input.archived===undefined?Number(row.archived):input.archived?1:0,JSON.stringify(requirements),JSON.stringify(specifications),changed?1:0,timestamp,owner,projectId).run()
  const updated=await loadProject(c,(await ownProject(c,projectId))!)
  return privateJson(c,{project:updated,dependencyWarnings:invalidDependency})
})
projectvault.delete('/projects/:id',async(c)=>{
  const owner=c.get('user').sub,projectId=c.req.param('id');await c.get('db').batch([c.get('db').prepare('DELETE FROM vault_exports WHERE owner_sub=? AND project_id=?').bind(owner,projectId),c.get('db').prepare('DELETE FROM vault_projects WHERE owner_sub=? AND id=?').bind(owner,projectId)]);return privateJson(c,{ok:true})
})
projectvault.post('/projects/:id/duplicate',async(c)=>{
  const row=await ownProject(c,c.req.param('id'));if(!row)return privateJson(c,{error:'Project not found.'},404)
  const source=await loadProject(c,row),timestamp=now(),copyId=id(),requirements=source.requirements.map((r,index)=>({...r,id:`REQ-${String(index+1).padStart(3,'0')}`}))
  await c.get('db').prepare('INSERT INTO vault_projects (id,owner_sub,title,description,project_code,category,priority,status,pinned,archived,requirements_json,specifications_json,specification_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(copyId,c.get('user').sub,`${source.title} copy`,source.description,'',source.category,source.priority,'draft',0,0,JSON.stringify(requirements),JSON.stringify(source.specifications),1,timestamp,timestamp).run()
  return privateJson(c,{project:await loadProject(c,(await ownProject(c,copyId))!)},201)
})
projectvault.get('/projects/:id/readiness',async(c)=>{
  const row=await ownProject(c,c.req.param('id'));if(!row)return privateJson(c,{error:'Project not found.'},404)
  const p=await loadProject(c,row),checks=readiness(p),ids=new Set(p.requirements.map((r)=>r.id)),conflicts=p.requirements.flatMap((r)=>r.dependencies.filter((d)=>!ids.has(d)).map((d)=>`${r.id} depends on missing ${d}`))
  return privateJson(c,{checks,ready:checks.filter((x)=>x.critical).every((x)=>x.complete)&&conflicts.length===0,selectedRequirementCount:p.requirements.filter((r)=>r.selected).length,unresolvedCount:p.requirements.filter((r)=>r.selected&&r.unresolved).length,warnings:checks.filter((x)=>!x.complete),conflicts})
})
projectvault.get('/projects/:id/prompt',async(c)=>{
  const row=await ownProject(c,c.req.param('id'));if(!row)return privateJson(c,{error:'Project not found.'},404);const p=await loadProject(c,row);return privateJson(c,{prompt:promptFor(p),phases:phasePromptsFor(p),projectId:p.id,selectedRequirements:p.requirements.filter((r)=>r.selected).map((r)=>r.id)})
})
projectvault.get('/projects/:id/exports',async(c)=>{
  if(!await ownProject(c,c.req.param('id')))return privateJson(c,{error:'Project not found.'},404);return privateJson(c,{exports:await getExports(c,c.req.param('id'))})
})
projectvault.get('/projects/:id/exports/:exportId/compare',async(c)=>{
  const row=await ownProject(c,c.req.param('id'));if(!row)return privateJson(c,{error:'Project not found.'},404)
  const exportId=c.req.param('exportId'),prior=await c.get('db').prepare('SELECT requirements_json FROM vault_exports WHERE owner_sub=? AND project_id=? AND id=?').bind(c.get('user').sub,c.req.param('id'),exportId).first<{requirements_json:string}>();if(!prior)return privateJson(c,{error:'Export not found.'},404)
  const p=await loadProject(c,row),current=new Map(p.requirements.map((r)=>[r.id,r])),before=JSON.parse(prior.requirements_json) as Requirement[],old=new Map(before.map((r)=>[r.id,r]))
  return privateJson(c,{outdated:p.lastExportOutdated,added:[...current.values()].filter((r)=>!old.has(r.id)),removed:before.filter((r)=>!current.has(r.id)),modified:[...current.values()].filter((r)=>old.has(r.id)&&JSON.stringify(r)!==JSON.stringify(old.get(r.id)))})
})
projectvault.post('/projects/:id/export',async(c)=>{
  const db=c.get('db'),owner=c.get('user').sub,projectId=c.req.param('id'),row=await ownProject(c,projectId);if(!row)return privateJson(c,{error:'Project not found.'},404)
  const mode=(c.req.query('mode')??'specification')==='source'?'source':'specification'
  const p=await loadProject(c,row),exports=await getExports(c,projectId),version=(exports[0]?.exportVersion??0)+1,timestamp=now(),files=makeFiles(p,version,timestamp,mode),validation=validate(files,p)
  if(mode==='source'){validation.warnings.push('Mode B: Existing Project Source Package was requested, but no repository source files are connected. Delivering verified specification package as base.')}
  if(validation.failed.length)return privateJson(c,{error:'Export validation failed.',validation},422)
  const exportFolder=`ProjectVault_Export_${safeSlug(p.projectCode||p.title)}_v${version}`
  files.set('EXPORT_VALIDATION_REPORT.md',`# Export validation report\n\nProject: ${p.title} (${p.id})\nExport version: ${version}\nExport mode: ${mode==='source'?'Mode B (Existing Project Source Package)':'Mode A (Implementation Specification Package)'}\nGenerated: ${new Date(timestamp).toISOString()}\n\n## Passed\n${validation.passed.map((x)=>`- ${x}`).join('\n')||'- None'}\n\n## Warnings\n${validation.warnings.map((x)=>`- ${x}`).join('\n')||'- None'}\n\n## Failed\n${validation.failed.map((x)=>`- ${x}`).join('\n')||'- None'}\n\n## Could not verify\n${validation.unavailable.map((x)=>`- ${x}`).join('\n')||'- None'}\n\nPackage validation does not prove the eventual implementation works.\n`)
  const manifest=JSON.parse(files.get('PROJECT_MANIFEST.json')!);manifest.validation=validation;files.set('PROJECT_MANIFEST.json',JSON.stringify(manifest,null,2))
  const metadata=JSON.parse(files.get('EXPORT_METADATA.json')!);metadata.validation=validation;files.set('EXPORT_METADATA.json',JSON.stringify(metadata,null,2))
  const packaged=new Map([...files].map(([path,body])=>[`${exportFolder}/${path}`,body]))
  let bytes:Uint8Array
  try { bytes=zipStore(packaged);verifyZip(bytes,packaged.size) } catch(error) { return privateJson(c,{error:'ZIP generation or integrity validation failed.',detail:error instanceof Error?error.message:'Unknown ZIP error',validation},500) }
  validation.passed.push('ZIP central directory and entry CRCs verified')
  const exportId=id(),snapshotHash=hash(snapshot(p))
  try {
    await db.prepare('INSERT INTO vault_exports (id,owner_sub,project_id,export_version,specification_version,requirement_count,completed_count,validation_json,snapshot_hash,created_at,requirements_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(exportId,owner,projectId,version,p.specificationVersion,p.requirements.length,p.requirements.filter((r)=>r.selected&&r.completed).length,JSON.stringify(validation),snapshotHash,timestamp,JSON.stringify(p.requirements)).run()
  } catch(error) { return privateJson(c,{error:'Export validation succeeded, but export history could not be saved; no download was returned.',detail:error instanceof Error?error.message:'Unknown storage error',validation},500) }
  await db.prepare('UPDATE vault_projects SET status=CASE WHEN status IN (?,?) THEN ? ELSE status END, updated_at=? WHERE owner_sub=? AND id=?').bind('draft','planning','exported',timestamp,owner,projectId).run()
  c.header('Content-Type','application/zip');c.header('Content-Disposition',`attachment; filename="${exportFolder}.zip"`);c.header('Cache-Control','private, no-store');c.header('X-ProjectVault-Export-Id',exportId);c.header('X-ProjectVault-Validation',encodeURIComponent(JSON.stringify(validation)))
  return new Response(bytes as unknown as BodyInit,{headers:c.res.headers})
})

