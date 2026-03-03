import { Request, Response } from "express";
import mongoose from "mongoose";
import AppError from "../../utils/AppError";
import { PLATFORM_FEE_PERCENT } from "./contest.types";
import asyncHandler from "../../utils/asyncHandler";
import contestService from "./contest.service";


// ── Helpers ───────────────────────────────────────────────────────────────────

/** Validates that a route :id param is a valid MongoDB ObjectId */
const validateObjectId = (id: string, label = 'ID'): void => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${label}: "${id}".`, 400);
  }
};


// ═════════════════════════════════════════════════════════════════════════════
// CONTEST CONTROLLER
// ═════════════════════════════════════════════════════════════════════════════
// Thin HTTP layer — no business logic lives here.
// All decisions are delegated to contestService.
// Each handler: validates input → calls service → shapes HTTP response.
// ═════════════════════════════════════════════════════════════════════════════

export class ContestController {

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN — Contest Management
  // All routes below require authenticate + requireAdmin middleware.
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/v1/contests/admin
   * ─────────────────────────────
   * Create a new contest. Admin provides entryFee and prizePool;
   * the server auto-calculates:
   *
   *   platformFee     = prizePool × 20%         (e.g. 30,000 × 0.20 = 6,000)
   *   totalCollection = prizePool + platformFee  (e.g. 30,000 + 6,000 = 36,000)
   *   totalSpots      = floor(totalCollection / entryFee)  (e.g. 36,000 / 50 = 720)
   *
   * Default status is DRAFT — contest is invisible to users until admin
   * explicitly sets status to OPEN (either here or via PATCH).
   *
   * Body: { matchId, name, contestType, entryFee, prizePool,
   *         maxEntriesPerUser?, isGuaranteed?, description?,
   *         status?: "DRAFT"|"OPEN", closedAt?, completedAt? }
   *
   * Returns 201 with the created contest including all computed fields.
   */
    adminCreateContest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const contest = await contestService.createContest(req.body);
    
        res.status(201).json({
          status:  'success',
          message: `Contest "${contest.name}" created successfully. ` +
                   `totalSpots auto-calculated: ${contest.totalSpots} ` +
                   `(₹${contest.prizePool} pool + ${PLATFORM_FEE_PERCENT}% fee ₹${contest.platformFee} ` +
                   `= ₹${contest.totalCollection} ÷ ₹${contest.entryFee}/entry).`,
          data: { contest },
        });
    });
}

export default new ContestController();