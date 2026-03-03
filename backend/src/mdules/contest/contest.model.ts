import { Schema, model, Document, Model, Types } from 'mongoose';
import { ContestStatus, ContestType, PLATFORM_FEE_PERCENT } from './contest.types';

// ═════════════════════════════════════════════════════════════════════════════
// CONTEST INTERFACE
// ═════════════════════════════════════════════════════════════════════════════

export interface IContest extends Document {
    matchId: string;
    name: string;
    contestType: ContestType;

    // ── Financial (admin sets entryFee + prizePool; rest auto-calculated) ──────
    entryFee: number;         // rupees per entry
    prizePool: number;        // net prize distributed to winners
    platformFee: number;      // prizePool × PLATFORM_FEE_PERCENT / 100 — stored
    totalCollection: number;  // prizePool + platformFee — stored
    totalSpots: number;       // floor(totalCollection / entryFee) — AUTO-CALCULATED

    filledSpots: number;      // incremented per join, never set manually

    // ── Settings ───────────────────────────────────────────────────────────────
    maxEntriesPerUser: number;
    isGuaranteed: boolean;

    // ── Status & Lifecycle ─────────────────────────────────────────────────────
    status: ContestStatus;
    closedAt: Date | null;
    completedAt: Date | null;
    cancelledAt: Date | null;
    cancelReason: string | null;

    // ── Audit ──────────────────────────────────────────────────────────────────
    createdBy: Types.ObjectId;
    cancelledBy: Types.ObjectId | null;

    // ── Meta ───────────────────────────────────────────────────────────────────
    description?: string;
    createdAt: Date;
    updatedAt: Date;

    // ── Virtuals (not stored) ──────────────────────────────────────────────────
    availableSpots: number;
    isFull: boolean;
    fillPercentage: number;
}

// ── Contest Model Interface (statics) ────────────────────────────────────────

export interface IContestModel extends Model<IContest> {
    findOpenByMatch(matchId: string): Promise<IContest[]>;
    findByStatus(status: ContestStatus): Promise<IContest[]>;
    countActiveByMatch(matchId: string): Promise<number>;
}

// ── Exported helper — shared by pre-save hook and service ─────────────────────

export function calcFinancials(prizePool: number, entryFee: number): {
    platformFee: number;
    totalCollection: number;
    totalSpots: number;
} 
{
    const platformFee     = Math.round(prizePool * PLATFORM_FEE_PERCENT / 100);
    const totalCollection = prizePool + platformFee;
    const totalSpots      = entryFee > 0 ? Math.floor(totalCollection / entryFee) : 0;
    return { platformFee, totalCollection, totalSpots };
}

// ═════════════════════════════════════════════════════════════════════════════
// CONTEST SCHEMA
// ═════════════════════════════════════════════════════════════════════════════

const contestSchema = new Schema<IContest, IContestModel>(
    {
        // ── Identity ──────────────────────────────────────────────────────────────
        matchId: {
            type: String,
            required: [true, 'Match ID is required'],
            trim: true,
            index: true,
        },

        name: {
            type: String,
            required: [true, 'Contest name is required'],
            trim: true,
            minlength: [3,   'Contest name must be at least 3 characters'],
            maxlength: [200, 'Contest name cannot exceed 200 characters'],
        },

        contestType: {
            type: String,
            enum: {
                message: `Contest type must be one of: ${Object.values(ContestType).join(', ')}`,
                values: Object.values(ContestType),
            },
            required: [true, 'Contest type is required'],
        },

        // ── Financial (admin sets these two; hook derives the rest) ───────────────
        entryFee: {
            type: Number,
            required: [true, 'Entry fee is required'],
            min: [1, 'Entry fee must be at least ₹1'],
        },

        prizePool: {
            type: Number,
            required: [true, 'Prize pool is required'],
            min: [1, 'Prize pool must be at least ₹1'],
        },

        // Derived — written only by the pre-save hook, never accepted from client
        platformFee: {
            type: Number,
            default: 0,
            min: [0, 'Platform fee cannot be negative'],
        },

        totalCollection: {
            type: Number,
            default: 0,
            min: [0, 'Total collection cannot be negative'],
        },
    
        // AUTO-CALCULATED: floor((prizePool + platformFee) / entryFee)
        totalSpots: {
            type: Number,
            default: 0,
            min: [2, 'Contest must support at least 2 spots'],
        },

        filledSpots: {
            type: Number,
            default: 0,
            min: [0, 'Filled spots cannot be negative'],
        },
    
        // ── Settings ──────────────────────────────────────────────────────────────
        maxEntriesPerUser: {
            type: Number,
            default: 1,
            min: [1,  'Max entries per user must be at least 1'],
            max: [10, 'Max entries per user cannot exceed 10'],
        },
    
        isGuaranteed: {
            type: Boolean,
            default: false,
        },
    
        // ── Status ────────────────────────────────────────────────────────────────
        status: {
            type: String,
            enum: {
                values: Object.values(ContestStatus),
                message: `Status must be one of: ${Object.values(ContestStatus).join(', ')}`,
            },
            default: ContestStatus.DRAFT,
            index: true,
        },
    
        // ── Lifecycle timestamps ──────────────────────────────────────────────────
        closedAt:    { type: Date, default: null },
        completedAt: { type: Date, default: null },
        cancelledAt: { type: Date, default: null },
    
        cancelReason: {
            type: String,
            trim: true,
            maxlength: [500, 'Cancel reason cannot exceed 500 characters'],
            default: null,
        },
    
        // ── Audit ─────────────────────────────────────────────────────────────────
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Creator (admin) ID is required'],
        },
    
        cancelledBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    
        // ── Meta ──────────────────────────────────────────────────────────────────
        description: {
            type: String,
            trim: true,
            maxlength: [1000, 'Description cannot exceed 1000 characters'],
        },
    },
    {
        timestamps: true,
        versionKey: false,
        toJSON:   { virtuals: true },
        toObject: { virtuals: true },
    }
);

// ── Pre-save Hook ─────────────────────────────────────────────────────────────
// Recalculates platformFee, totalCollection, totalSpots whenever
// prizePool or entryFee is modified. This is the ONLY place those fields are set.

contestSchema.pre('save', async function (this: IContest) {
    if (this.isModified('prizePool') || this.isModified('entryFee') || this.isNew) {
        const { platformFee, totalCollection, totalSpots } =
            calcFinancials(this.prizePool, this.entryFee);

        this.platformFee     = platformFee;
        this.totalCollection = totalCollection;
        this.totalSpots      = totalSpots;
    }

    if (this.totalSpots < 2) {
        throw new Error(
          `totalSpots (${this.totalSpots}) must be at least 2. ` +
          `Increase prizePool or decrease entryFee.`
        );
    }

    if (this.filledSpots > this.totalSpots) {
        throw new Error(
          `filledSpots (${this.filledSpots}) cannot exceed totalSpots (${this.totalSpots})`
        );
    }
});

// ── Virtuals ──────────────────────────────────────────────────────────────────

contestSchema.virtual('availableSpots').get(function (this: IContest) {
    return Math.max(0, this.totalSpots - this.filledSpots);
});

contestSchema.virtual('isFull').get(function (this: IContest) {
    return this.filledSpots >= this.totalSpots;
});

contestSchema.virtual('fillPercentage').get(function (this: IContest) {
    if (this.totalSpots === 0) return 0;
    return Math.min(100, Math.round((this.filledSpots / this.totalSpots) * 100));
});

// ── Indexes ───────────────────────────────────────────────────────────────────

contestSchema.index({ matchId: 1, status: 1 });
contestSchema.index({ matchId: 1, contestType: 1 });
contestSchema.index({ status: 1, createdAt: -1 });
contestSchema.index({ status: 1, entryFee: 1 });
contestSchema.index({ createdBy: 1, createdAt: -1 });
contestSchema.index({ createdAt: -1 });

// ── Statics ───────────────────────────────────────────────────────────────────

contestSchema.statics.findOpenByMatch = function (matchId: string): Promise<IContest[]> {
    return this.find({ matchId, status: ContestStatus.OPEN }).sort({ entryFee: 1 });
};

contestSchema.statics.findByStatus = function (status: ContestStatus): Promise<IContest[]> {
    return this.find({ status }).sort({ createdAt: -1 });
};

contestSchema.statics.countActiveByMatch = function (matchId: string): Promise<number> {
    return this.countDocuments({
        matchId,
        status: { $in: [ContestStatus.OPEN, ContestStatus.FULL] },
    });
};



// ═════════════════════════════════════════════════════════════════════════════
// MODELS
// ═════════════════════════════════════════════════════════════════════════════

export const Contest      = model<IContest,      IContestModel>     ('Contest',      contestSchema);
