import { Router } from 'express';
import { aliasesRouter } from './aliases';

export const router = Router();
router.use('/aliases', aliasesRouter);
