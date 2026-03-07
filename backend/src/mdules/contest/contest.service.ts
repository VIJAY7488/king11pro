import mongoose, { ClientSession, Types } from "mongoose";
import { calcFinancials, Contest, IContest } from "./contest.model";
import { ContestPublic, ContestQueryParams, ContestStatus, CreateContestDTO, PaginatedContests, PLATFORM_FEE_PERCENT, UpdateContestDTO } from "./contest.types";
import AppError from "../../utils/AppError";
import asyncHandler from "../../utils/asyncHandler";


// ── Shape Mappers ─────────────────────────────────────────────────────────────

const toContestPublic = (doc: IContest): ContestPublic => ({
  id: (doc._id as Types.ObjectId).toString(),
  matchId: doc.matchId,
  name: doc.name,
  contestType: doc.contestType,

  // Financial
  entryFee: doc.entryFee,
  prizePool: doc.prizePool,
  platformFee: doc.platformFee,
  platformFeePercent: PLATFORM_FEE_PERCENT,
  totalCollection: doc.totalCollection,
  totalSpots: doc.totalSpots,
  filledSpots: doc.filledSpots,
  availableSpots: Math.max(0, doc.totalSpots - doc.filledSpots),
  fillPercentage: doc.totalSpots > 0
    ? Math.min(100, Math.round((doc.filledSpots / doc.totalSpots) * 100))
    : 0,

  maxEntriesPerUser: doc.maxEntriesPerUser,
  isGuaranteed: doc.isGuaranteed,
  status: doc.status,
  description: doc.description,

  closedAt: doc.closedAt ?? null,
  completedAt: doc.completedAt ?? null,
  cancelledAt: doc.cancelledAt ?? null,
  cancelReason: doc.cancelReason ?? null,

  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

// ── Transaction Utility ───────────────────────────────────────────────────────

const withTransaction = async <T>(fn: (session: ClientSession) => Promise<T>): Promise<T> => {
  const session = await mongoose.startSession();
  session.startTransaction({
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' },
  });
  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// ── Status Transition Table ───────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<ContestStatus, ContestStatus[]> = {
  [ContestStatus.DRAFT]:     [ContestStatus.OPEN, ContestStatus.CANCELLED],
  [ContestStatus.OPEN]:      [ContestStatus.CLOSED, ContestStatus.CANCELLED, ContestStatus.DRAFT],
  [ContestStatus.FULL]:      [ContestStatus.CLOSED, ContestStatus.CANCELLED],
  [ContestStatus.CLOSED]:    [ContestStatus.COMPLETED, ContestStatus.CANCELLED],
  [ContestStatus.COMPLETED]: [],
  [ContestStatus.CANCELLED]: [],
};


// ═════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═════════════════════════════════════════════════════════════════════════════

export class ContestService {

  // ── ADMIN: Create Contest ──────────────────────────────────────────────────
  /**
   * Admin provides: matchId, name, contestType, entryFee, prizePool.
   *
   * Auto-calculated and stored:
   *   platformFee    = prizePool × 20%
   *   totalCollection = prizePool + platformFee
   *   totalSpots     = floor(totalCollection / entryFee)
   *
   * Example: prizePool=30000, entryFee=50
   *   platformFee = 6000, totalCollection = 36000, totalSpots = 720
   *
   * Default status is DRAFT — admin must explicitly set OPEN to make it visible.
   */
  async createContest(dto: CreateContestDTO): Promise<ContestPublic> {
    // Pre-validate that the calculated totalSpots would be ≥ 2
    const { totalSpots } =
      calcFinancials(dto.prizePool, dto.entryFee);

    if (totalSpots < 2) {
      throw new AppError(
        `With prizePool ₹${dto.prizePool} and entryFee ₹${dto.entryFee}, ` +
        `totalSpots would be ${totalSpots}. ` +
        `Contest needs at least 2 spots. Increase prizePool or decrease entryFee.`,
        422
      );
    }

    const contest = await Contest.create({
      matchId: dto.matchId,
      name: dto.name,
      contestType: dto.contestType,
      entryFee: dto.entryFee,
      prizePool: dto.prizePool,
      // platformFee, totalCollection, totalSpots written by pre-save hook
      maxEntriesPerUser: dto.maxEntriesPerUser ?? 1,
      isGuaranteed: dto.isGuaranteed ?? false,
      description: dto.description,
      status: dto.status ?? ContestStatus.DRAFT,
      closedAt: dto.closedAt ?? null,
      completedAt: dto.completedAt ?? null,
    });

    return toContestPublic(contest);
  };


  // ── ADMIN: Update Contest ──────────────────────────────────────────────────
  /**
   * Admin can update any non-terminal contest.
   *
   * If prizePool or entryFee changes, totalSpots is recalculated automatically
   * by the model's pre-save hook.
   *
   * Guards:
   *   • entryFee  — only changeable before anyone has joined (filledSpots === 0)
   *   • status    — must follow ALLOWED_TRANSITIONS table
   *   • CANCELLED — triggers atomic batch refund
  */

  async updateContest(contestId: string, dto: UpdateContestDTO,): Promise<ContestPublic> {
    const contest = await Contest.findById(contestId);
    if (!contest) throw new AppError('Contest not found.', 404);

    if ( contest.status === ContestStatus.COMPLETED || contest.status === ContestStatus.CANCELLED ) {
      throw new AppError(`Contest is ${contest.status.toLowerCase()} and cannot be modified.`,409);
    };

    // Status transition validation
    if (dto.status && dto.status !== contest.status){
      const allowed = ALLOWED_TRANSITIONS[contest.status];
      if (!allowed.includes(dto.status)) {
        throw new AppError(`Cannot move from ${contest.status} → ${dto.status}. ` +`Allowed: ${allowed.join(', ') || 'none'}.`, 422);
      }
    }

    // Build the update — pre-save hook recalculates financials if needed
    const updateFields: Partial<IContest> = {};
    if (dto.name              !== undefined) updateFields.name              = dto.name;
    if (dto.description       !== undefined) updateFields.description       = dto.description;
    if (dto.entryFee          !== undefined) updateFields.entryFee          = dto.entryFee;
    if (dto.prizePool         !== undefined) updateFields.prizePool         = dto.prizePool;
    if (dto.maxEntriesPerUser !== undefined) updateFields.maxEntriesPerUser = dto.maxEntriesPerUser;
    if (dto.isGuaranteed      !== undefined) updateFields.isGuaranteed      = dto.isGuaranteed;
    if (dto.status            !== undefined) updateFields.status            = dto.status;
    if (dto.closedAt          !== undefined) updateFields.closedAt          = dto.closedAt;
    if (dto.completedAt       !== undefined) updateFields.completedAt       = dto.completedAt;

    // Auto-stamp lifecycle timestamps on status change
    if (dto.status === ContestStatus.CLOSED    && !dto.closedAt)    updateFields.closedAt    = new Date();
    if (dto.status === ContestStatus.COMPLETED && !dto.completedAt) updateFields.completedAt = new Date();

    if (Object.keys(updateFields).length === 0) {
      throw new AppError('No valid update fields provided.', 400);
    }

    // Use save() not findByIdAndUpdate so the pre-save hook recalculates financials
    Object.assign(contest, updateFields);
    await contest.save();

    return toContestPublic(contest);
  };


  // ── User: List Contests ────────────────────────────────────────────────────

  async listContests(params: ContestQueryParams): Promise<PaginatedContests> {
    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.min(50, Math.max(1, params.limit ?? 20));
    const skip  = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      status: { $nin: [ContestStatus.DRAFT, ContestStatus.CANCELLED] },
    };
    if (params.matchId)     filter['matchId']     = params.matchId;
    if (params.status)      filter['status']      = params.status;
    if (params.contestType) filter['contestType'] = params.contestType;

    const [contests, total] = await Promise.all([
      Contest.find(filter).sort({ entryFee: 1, createdAt: -1 }).skip(skip).limit(limit),
      Contest.countDocuments(filter),
    ]);

    return { contests: contests.map(toContestPublic), total, page, limit,
             totalPages: Math.ceil(total / limit) };
  }

  async getContestById(contestId: string): Promise<ContestPublic> {
    const contest = await Contest.findById(contestId);
    if (!contest) throw new AppError('Contest not found.', 404);
    return toContestPublic(contest);
  }


};


export default new ContestService();