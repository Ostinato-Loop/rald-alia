// services/developer-service/src/routes/projects.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DeveloperEngine } from '../services/developerEngine';

export const projectsRouter = Router({ mergeParams: true });
const engine = new DeveloperEngine();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

const CreateProjectSchema = z.object({
  name:                    z.string().min(1).max(200),
  description:             z.string().optional(),
  environment:             z.enum(['sandbox', 'production']),
  country_permissions:     z.array(z.string().length(2)).default([]),
  institution_permissions: z.array(z.string()).default([]),
  webhook_url:             z.string().url().optional(),
});

// ── POST /v1/developers/:developerId/projects ─────────────────────────────────

projectsRouter.post('/', asyncHandler(async (req, res) => {
  const parsed = CreateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
  }
  const project = await engine.createProject({ developer_id: req.params.developerId!, ...parsed.data });
  res.status(201).json({ success: true, data: project });
}));

// ── GET /v1/developers/:developerId/projects ──────────────────────────────────

projectsRouter.get('/', asyncHandler(async (req, res) => {
  const projects = await engine.listProjects(req.params.developerId!);
  res.json({ success: true, data: projects, meta: { total: projects.length } });
}));

// ── GET /v1/developers/:developerId/projects/:projectId ───────────────────────

projectsRouter.get('/:projectId', asyncHandler(async (req, res) => {
  const project = await engine.getProject(req.params.projectId!);
  if (!project) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
  }
  res.json({ success: true, data: project });
}));

// ── PATCH /v1/developers/:developerId/projects/:projectId ────────────────────

projectsRouter.patch('/:projectId', asyncHandler(async (req, res) => {
  const UpdateSchema = z.object({
    name:                    z.string().min(1).max(200).optional(),
    description:             z.string().optional(),
    country_permissions:     z.array(z.string().length(2)).optional(),
    institution_permissions: z.array(z.string()).optional(),
    webhook_url:             z.string().url().optional(),
  });
  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
  }
  const updated = await engine.updateProject(req.params.projectId!, parsed.data);
  res.json({ success: true, data: updated });
}));

// ── DELETE /v1/developers/:developerId/projects/:projectId ───────────────────

projectsRouter.delete('/:projectId', asyncHandler(async (req, res) => {
  const { actor_id } = req.body;
  await engine.archiveProject(req.params.projectId!, actor_id ?? 'unknown');
  res.json({ success: true, data: { message: 'Project archived' } });
}));
