import jwt from 'jsonwebtoken';
import AppError from "../../utils/AppError";
import User, { IUser } from "./users.model";
import { AuthResponse, AuthTokens, JwtPayload, LoginDTO, RegisterDTO, UserPublicProfile } from "./users.types";
import config from '../../config/env';



// ── Token Helpers ─────────────────────────────────────────────────────────────
const signTokens = (user: IUser): AuthTokens => {
    const payload: JwtPayload = {
        sub: user._id.toString(),
        mobile: user.mobileNumber,
    };

    const accessToken = jwt.sign(payload, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn,
    } as jwt.SignOptions);


    const refreshToken = jwt.sign(payload, config.jwtRefreshSecret, {
        expiresIn: config.jwtRefreshExpiresIn,
    } as jwt.SignOptions);

    return { accessToken, refreshToken };
};


const toPublicProfile = (user: IUser): UserPublicProfile => ({
    id: user._id.toString(),
    name: user.name,
    mobileNumber: user.mobileNumber,
    telegramUsername: user.telegramUsername,
    walletBalance: user.walletBalance,
    isActive: user.isActive,
    createdAt: user.createdAt,
})


// ── Service ───────────────────────────────────────────────────────────────────
export class UserService {
    // ── Auth ──────────────────────────────────────────────────────────────────
    async register(dto: RegisterDTO): Promise<AuthResponse> {
        const existing = await User.findOne({mobileNumber: dto.mobileNumber});

        if(existing) {
            throw new AppError('An account with this mobile number already exists.', 409)
        };

        const user = await User.create({
            name: dto.name,
            mobileNumber: dto.mobileNumber,
            telegramUsername: dto.telegramUsername,
            password: dto.password  // hashed via pre-save hook
        });

        const tokens = signTokens(user);
        return { user: toPublicProfile(user), tokens };
    };

    async login(dto: LoginDTO): Promise<AuthResponse> {
        const user = await User.findByMobile(dto.mobileNumber);

        if (!user || !(await user.comparePassword(dto.password))){
            throw new AppError('Invalid mobile number or password.', 401);
        };

        if (!user.isActive) {
            throw new AppError('Your account has been deactivated. Please contact support.', 403);
        };

        const tokens = signTokens(user);
        return { user: toPublicProfile(user), tokens };
    };
};

export default new UserService;