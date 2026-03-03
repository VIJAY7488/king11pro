import mongoose, { ClientSession, Types } from "mongoose";
import { calcFinancials, Contest, IContest } from "./contest.model";
import { ContestPublic, ContestStatus, CreateContestDTO, PLATFORM_FEE_PERCENT } from "./contest.types";
import AppError from "../../utils/AppError";


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
  }
};


export default new ContestService();