

// ── Enums ─────────────────────────────────────────────────────────────────────

export enum ContestStatus {
    DRAFT     = 'DRAFT',    // created but not visible
    OPEN      = 'OPEN',     // accepting entries
    FULL      = 'FULL',     // all spots taken, still accepting waitlist
    CLOSED    = 'CLOSED',   // no more entries, match started
    COMPLETED = 'COMPLETED',// results declared
    CANCELLED = 'CANCELLED',// cancelled — all fees refunded
}


export enum ContestType {
    HEAD_TO_HEAD = 'HEAD_TO_HEAD', // 2 players
    SMALL_LEAGUE = 'SMALL_LEAGUE', // 100 players
    MEGA_LEAGUE  = 'MEGA_LEAGUE',  // 1000+ players
}


export enum EntryStatus {
    ACTIVE   = 'ACTIVE',
    REFUNDED = 'REFUNDED',
    WON      = 'WON',
    LOST     = 'LOST',
}


// ── Request DTOs ──────────────────────────────────────────────────────────────

export interface CreateContestDTO {
    matchId: string;
    name: string;
    contestType: ContestType;
    entryFee: number;
    totalSpots: number;
    prizePool: number;
    maxEntriesPerUser?: number;
}


export interface JoinContestDTO {
    contestId: string;
    teamId?: string;  // user's selected fantasy team (optional for now, extensible)
}

export interface ContestQueryParams {
    matchId?: string;
    status?: ContestStatus;
    contestType?: ContestType;
    page?: number;
    limit?: number;
}


// ── Response Shapes ───────────────────────────────────────────────────────────

export interface ContestPublic {
    id: string;
    matchId: string;
    name: string;
    contestType: ContestType;
    entryFee: number;
    totalSpots: number;
    filledSpots: number;
    availableSpots: number;
    prizePool: number;
    status: ContestStatus;
    maxEntriesPerUser: number;
    createdAt: Date;
}


export interface ContestEntryPublic {
    id: string;
    contestId: string;
    userId: string;
    teamId?: string;
    status: EntryStatus;
    entryFee: number;
    transactionId: string;
    rank?: number;
    prizeWon?: number;
    joinedAt: Date;
}


export interface JoinContestResult {
    entry: ContestEntryPublic;
    contest: ContestPublic;
    walletBalance: number;
}


export interface PaginatedContests {
    contests: ContestPublic[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}


export interface ContestLeaderboard {
    contestId: string;
    entries: Array<ContestEntryPublic & { userName: string }>;
    totalEntries: number;
}