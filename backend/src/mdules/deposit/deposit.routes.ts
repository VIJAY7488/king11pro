import { Router } from 'express';
import authenticate from '../../middlewares/authenticate.middleware';
import { createDepositSchema, reviewDepositSchema } from './deposit.validators';
import depositController from './deposit.controller';
import validate from '../../middlewares/validate.middleware';
import requireAdmin from '../../middlewares/requireAdmin.middleware';



const router = Router();

// All deposit routes require authentication
router.use(authenticate);

// ── User Routes ───────────────────────────────────────────────────────────────
router.post(
  '/deposit',
  validate(createDepositSchema),
  depositController.createDeposit
);



/**
 * PATCH /api/v1/deposits/admin/:id/review
 *
 * Body:
 *   { "status": "APPROVED" }                        → credits wallet
 *   { "status": "REJECTED", "adminNote": "reason" } → no wallet change
 *
 * This is the single endpoint that changes a deposit from PENDING → APPROVED/REJECTED.
 */
router.patch('/admin/:id/review', validate(reviewDepositSchema), requireAdmin, depositController.reviewDeposit);


export default router;