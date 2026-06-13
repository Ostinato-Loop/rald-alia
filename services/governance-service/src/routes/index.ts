// services/governance-service/src/routes/index.ts
import { Router } from 'express';
import { countryRouter }    from './country.routes';
import { policyRouter }     from './policy.routes';
import { complianceRouter } from './compliance.routes';
import { retentionRouter }  from './retention.routes';

export const router = Router();

router.use('/governance/countries',   countryRouter);
router.use('/governance/policies',    policyRouter);
router.use('/governance/validate',    policyRouter);
router.use('/governance/compliance',  complianceRouter);
router.use('/governance/retention',   retentionRouter);
