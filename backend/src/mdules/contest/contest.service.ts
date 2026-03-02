



// ── Shape Mappers ─────────────────────────────────────────────────────────────

import mongoose, { ClientSession, Types } from "mongoose";
import { Contest, ContestEntry, IContest, IContestEntry } from "./contest.model";
import { ContestEntryPublic, ContestPublic, ContestStatus, CreateContestDTO, EntryStatus, JoinContestDTO, JoinContestResult } from "./contest.types";
import AppError from "../../utils/AppError";
import Transaction from "../wallet/wallet.model";
import User from "../user/users.model";
import { TransactionStatus, TransactionType } from "../wallet/wallet.types";

const toContestPublic = (doc: IContest): ContestPublic => ({
  id: (doc._id as Types.ObjectId).toString(),
  matchId: doc.matchId.toString(),
  name: doc.name,
  contestType: doc.contestType,
  entryFee: doc.entryFee,
  totalSpots: doc.totalSpots,
  filledSpots: doc.filledSpots,
  availableSpots: doc.totalSpots - doc.filledSpots,
  prizePool: doc.prizePool,
  status: doc.status,
  maxEntriesPerUser: doc.maxEntriesPerUser,
  createdAt: doc.createdAt,
});


const toEntryPublic = (doc: IContestEntry): ContestEntryPublic => ({
  id: (doc._id as Types.ObjectId).toString(),
  contestId: doc.contestId.toString(),
  userId: doc.userId.toString(),
  teamId: doc.teamId,
  status: doc.status,
  entryFee: doc.entryFee,
  transactionId: doc.transactionId,
  rank: doc.rank,
  prizeWon: doc.prizeWon,
  joinedAt: doc.joinedAt,
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



// ── Service ───────────────────────────────────────────────────────────────────
export class ContestService {

  // ── Admin: Create Contest ──────────────────────────────────────────────────

  async createContest(dto: CreateContestDTO): Promise<ContestPublic> {
    
    const contest = await Contest.create({
      matchId: dto.matchId,
      name: dto.name,
      contestType: dto.contestType,
      entryFee: dto.entryFee,
      totalSpots: dto.totalSpots,
      prizePool: dto.prizePool,
      maxEntriesPerUser: dto.maxEntriesPerUser ?? 1,
      status: ContestStatus.OPEN,
    });

    return toContestPublic(contest);
  };


  // ── Join Contest — the core operation ─────────────────────────────────────
  /**
  * Atomically:
  *   1. Validates contest is OPEN and has capacity
  *   2. Checks user hasn't exceeded maxEntriesPerUser
  *   3. Deducts entry fee from user's wallet (atomic $inc with balance guard)
  *   4. Records the wallet Transaction ledger entry
  *   5. Increments contest.filledSpots (atomic $inc — race-safe)
  *   6. Auto-closes contest if now full
  *   7. Creates the ContestEntry record with a link to the wallet transaction
  *
  * All 4 writes happen in ONE MongoDB session. Any failure rolls back all of them.
  */

  async joinContest(userId: string, dto: JoinContestDTO): Promise<JoinContestResult> {
    // ── Pre-flight checks (outside transaction — fast reads, no locks needed) ──
    const contest = await Contest.findById(dto.contestId);
    if (!contest) throw new AppError('Contest not found.', 404);
    if (contest.status !== ContestStatus.OPEN) {
      throw new AppError(`Contest is not open for entries. Current status: ${contest.status}.`, 409);
    }

    if (contest.filledSpots >= contest.totalSpots) {
      throw new AppError('Contest is full. No spots available.', 409);
    }

    // Idempotency key — the same key used by wallet service for cross-linking
    const walletTxnRef = `CONTEST:${dto.contestId}:USER:${userId}`;

    // Check for a prior completed entry (re-entry guard before acquiring session)
    const existingEntries = await ContestEntry.countDocuments({
      contestId: new Types.ObjectId(dto.contestId),
      userId: new Types.ObjectId(userId),
      status: { $ne: EntryStatus.REFUNDED },
    });

    if (existingEntries >= contest.maxEntriesPerUser) {
      throw new AppError(`You have reached the maximum entries (${contest.maxEntriesPerUser}) for this contest.`, 409);
    }

    // Check for a duplicate wallet transaction key (idempotency for single-entry contests)
    if (contest.maxEntriesPerUser === 1) {
      const dupTxn = await Transaction.findOne({ referenceId: walletTxnRef });
      if (dupTxn) throw new AppError('You have already joined this contest.', 409);
    }

    // ── Atomic transaction block ───────────────────────────────────────────────
    return withTransaction(async (session) => {
      // Step 1: Atomically deduct entry fee + enforce balance ≥ 0 in one op.
      // The filter includes walletBalance: { $gte: entryFee } — if this returns
      // null, the DB rejected the update because the balance was insufficient.
      const updatedUser = await User.findOneAndUpdate(
        {
          _id: new Types.ObjectId(userId),
          isActive: true,
          walletBalance: { $gte: contest.entryFee },
        },
        { $inc: { walletBalance: -contest.entryFee } },
        { new: true, session }
      );

      if (!updatedUser) {
        const exists = await User.exists({ _id: userId }).session(session);
        if (!exists) throw new AppError('User not found.', 404);
        throw new AppError(`Insufficient wallet balance. Entry fee: ₹${contest.entryFee}.`, 402)
      }

      const balanceAfter  = updatedUser.walletBalance;
      const balanceBefore = balanceAfter + contest.entryFee;

      // Step 2: Write the wallet ledger entry.
      // const [walletTxn] = await Transaction.create(
      //   [
      //     {
      //       userId: updatedUser._id,
      //       type: TransactionType.JOIN_CONTEST,
      //       status: TransactionStatus.SUCCESS,
      //       amount: contest.entryFee,
      //       balanceBefore,
      //       balanceAfter,
      //       description: `Entry fee for "${contest.name}"`,
      //       referenceId: walletTxnRef,
      //       metadata: {
      //         contestId: dto.contestId,
      //         contestName: contest.name,
      //         matchId: contest.matchId,
      //       },
      //     },
      //   ],
      //   { session }
      // )

    })
  }
}