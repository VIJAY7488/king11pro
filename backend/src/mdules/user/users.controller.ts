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
};

export default new UserController;