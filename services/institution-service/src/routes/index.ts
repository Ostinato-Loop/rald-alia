import { Router } from 'express';
import { institutionsRouter } from './institutions.routes';

export const router = Router();

router.use('/institutions', institutionsRouter);
