// services/control-plane/src/routes/index.ts
import { Router } from 'express';
import { healthRouter }       from './health.routes';
import { countriesRouter }    from './countries.routes';
import { developersRouter }   from './developers.routes';
import { institutionsRouter } from './institutions.routes';
import { networkRouter }      from './network.routes';

export const router = Router();

router.use('/health',       healthRouter);
router.use('/countries',    countriesRouter);
router.use('/developers',   developersRouter);
router.use('/institutions', institutionsRouter);
router.use('/network',      networkRouter);
