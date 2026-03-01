import { Types } from 'mongoose';



// ── Enums ─────────────────────────────────────────────────────────────────────

export enum TransactionType {
    DEPOSIT    = 'DEPOSIT',
    DEDUCTION  = 'DEDUCTION',
    REFUND     = 'REFUND',
    JOIN_CONTEST = 'JOIN_CONTEST',
    WIN_PRIZE  = 'WIN_PRIZE',
}


export enum TransactionStatus {
    PENDING   = 'PENDING',
    SUCCESS   = 'SUCCESS',
    FAILED    = 'FAILED',
    REVERSED  = 'REVERSED',
}


// ── Request DTOs ──────────────────────────────────────────────────────────────

export interface DepositDTO {
    amount: number;
    description?: string;
    referenceId?: string;   // external payment gateway ref
}

export interface DeductDTO {
    amount: number;
    description?: string;
    referenceId?: string;
}

export interface JoinContestDTO {
    contestId: string;
    entryFee: number;
    contestName?: string;
}



// ── Response Shapes ───────────────────────────────────────────────────────────

export interface TransactionRecord {
    id: string;
    userId: string;
    type: TransactionType;
    status: TransactionStatus;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    description: string;
    referenceId?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
}

export interface WalletSummary {
    userId: string;
    balance: number;
    totalDeposited: number;
    totalDeducted: number;
    transactionCount: number;
}

export interface WalletOperationResult {
    transaction: TransactionRecord;
    currentBalance: number;
}

export interface PaginatedTransactions {
    transactions: TransactionRecord[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// ── Query Params ──────────────────────────────────────────────────────────────
export interface TransactionQueryParams {
    page?: number;
    limit?: number;
    type?: TransactionType;
    status?: TransactionStatus;
    startDate?: string;
    endDate?: string;
}