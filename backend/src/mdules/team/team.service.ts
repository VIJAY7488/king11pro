import mongoose, { ClientSession, Types } from "mongoose";
import { ITeam, Team } from "./team.model";
import { CreateTeamDTO, TeamPublic } from "./team.types";
import { Contest } from "../contest/contest.model";
import { ContestStatus } from "../contest/contest.types";
import AppError from "../../utils/AppError";

// ── Shape Mapper ──────────────────────────────────────────────────────────────

const toTeamPublic = (doc: ITeam): TeamPublic => ({
    id:           (doc._id as Types.ObjectId).toString(),
    contestId:    doc.contestId.toString(),
    userId:       doc.userId.toString(),
    teamName:     doc.teamName,
    players:      doc.players.map(p => ({
        playerId:    p.playerId,
        playerName:  p.playerName,
        playerRole:  p.playerRole,
        captainRole: p.captainRole,
        teamName:    p.teamName,
    })),
    captainId:     doc.captainId     ?? null,
    viceCaptainId: doc.viceCaptainId ?? null,
    isLocked:      doc.isLocked,
    totalPlayers:  doc.players.length,
    createdAt:     doc.createdAt,
    updatedAt:     doc.updatedAt,
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


// ═════════════════════════════════════════════════════════════════════════════
// TEAM SERVICE
// ═════════════════════════════════════════════════════════════════════════════


export class TeamService {

    // ── Step 1: Create team (before joining contest) ───────────────────────────
    /**
     * User builds and saves their team for a specific contest.
     * This does NOT deduct any money — it just saves the team.
     *
     * Called when user clicks "Save Team" on the team-building page.
     * The saved team ID is then used in joinContest().
     *
     * Rules enforced by model's pre-save hook:
     *   • Exactly 11 players
     *   • Exactly 1 captain (2× points)
     *   • Exactly 1 vice-captain (1.5× points)
     *   • No duplicate players
     *   • At least 1 wicket-keeper, 1 bowler, 1 batsman
     *   • One team per user per contest
    */

    async createTeam(userId: string, dto: CreateTeamDTO): Promise<TeamPublic> {
        // Verify contest exists and is still accepting entries
        const contest = await Contest.findById(dto.contestId);
        if (!contest) throw new AppError('Contest not found.', 404);
        if (
            contest.status !== ContestStatus.OPEN &&
            contest.status !== ContestStatus.FULL
        ) {
          throw new AppError(
            `Cannot create a team for a contest with status: ${contest.status}.`,
            409
          );
        }

        const team = await Team.create({
            contestId: new Types.ObjectId(dto.contestId),
            userId:    new Types.ObjectId(userId),
            teamName:  dto.teamName,
            players:   dto.players,
            // captainId, viceCaptainId, isLocked set by pre-save hook
        });

        return toTeamPublic(team);
    }
};

export default new TeamService();