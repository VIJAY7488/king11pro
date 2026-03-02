

// ── Enums ─────────────────────────────────────────────────────────────────────

export enum DepositStatus {
  PENDING   = 'PENDING',   // submitted, awaiting admin approval
  APPROVED  = 'APPROVED',  // admin approved — wallet credited
  REJECTED  = 'REJECTED',  // admin rejected — no wallet change
};


// ── Request DTOs ──────────────────────────────────────────────────────────────

export interface CreateDepositDTO {
  amount: number;
  refNumber: string;         // payment reference / UTR number — always a string
}

export interface ReviewDepositDTO {
  status: DepositStatus.APPROVED | DepositStatus.REJECTED;
};

export interface DepositQueryParams {
  status?: DepositStatus;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

// ── Response Shapes ───────────────────────────────────────────────────────────

export interface DepositPublic {
  id: string;
  userId: string;
  amount: number;
  refNumber: string;
  status: DepositStatus;
  reviewedAt?: Date;
  walletTransactionId?: string;  // set after approval credits the wallet
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedDeposits {
  deposits: DepositPublic[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}