// services/developer-service/src/routes/index.ts
import { Router } from 'express';
import { developersRouter } from './developers.routes';
import { projectsRouter }   from './projects.routes';
import { apiKeysRouter }    from './apiKeys.routes';
import { authRouter }       from './auth.routes';

export const router = Router();

router.use('/developers',                         developersRouter);
router.use('/developers/:developerId/projects',   projectsRouter);
router.use('/projects/:projectId/api-keys',       apiKeysRouter);
router.use('/auth',                               authRouter);
