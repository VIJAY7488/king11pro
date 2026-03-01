import { Document, model, Schema } from "mongoose";




// ── Interface ────────────────────────────────────────────────────────────────
export interface IUser extends Document {
    name: string;
    mobileNumber: string;
    telegramUsername?: string;
    password: string;
    walletBalance: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;

    // Instance methods

};

// ── Schema ───────────────────────────────────────────────────────────────────
const userSchema = new Schema<IUser>({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [3, 'Name must be at least 2 characters'],
        maxlength: [30, 'Name cannot exceed 100 characters'],
    },

    mobileNumber: {
        type: String,
        required: [true, 'Mobile number is required'],
        unique: true,
        trim: true,
        match: [/^\+?[1-9]\d{6,14}$/, 'Please enter a valid mobile number'],
    },

    telegramUsername: {
        type: String,
        trim: true,
        lowercase: true,
        sparse: true, // allows multiple null values with unique index
        match: [/^[a-zA-Z0-9_]{5,32}$/, 'Invalid Telegram username format'],
    },

    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 8 characters'],
        select: false, // never returned in queries unless explicitly requested
    },

    walletBalance: {
        type: Number,
        default: 0,
        min: [0, 'Wallet balance cannot be negative'],
    },

    isActive: {
        type: Boolean,
        default: true,
    },

}, {
    timestamps: true,           // auto-manages createdAt / updatedAt
    versionKey: false,          // removes __v field
});


// ── Indexes ──────────────────────────────────────────────────────────────────
userSchema.index({ mobileNumber: 1 });
userSchema.index({ telegramUsername: 1 }, { sparse: true });
userSchema.index({ createdAt: -1 });



// ── Model ────────────────────────────────────────────────────────────────────
const User = model<IUser>('User', userSchema);
export default User;