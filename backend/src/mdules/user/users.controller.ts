import { Request, Response } from 'express';
import asyncHandler from "../../utils/asyncHandler";
import usersService from './users.service';

export class UserController {
    // ── Auth ──────────────────────────────────────────────────────────────────
    register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const result = await usersService.register(req.body);

        res.status(201).json({
            status: 'success',
            message: 'Account created successfully.',
            data: result,
        });
    });

    login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const result = await usersService.login(req.body);
        res.status(200).json({
            status: 'success',
            message: 'Login successful.',
            data: result,
        });
    });

    refreshTokens = asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { refreshToken } = req.body;
        const tokens = await usersService.refreshTokens(refreshToken);
        res.status(200).json({
            status: 'success',
            message: 'Tokens refreshed.',
            data: { tokens },
        });
    });
};

export default new UserController;