import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import AppError from '../utils/AppError';
import config from '../config/env';
import { JwtPayload } from '../mdules/user/users.types';


const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return next(new AppError('Authorization header missing or malformed.', 401));
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
        req.user = { id: payload.sub, mobile: payload.mobile };
        next();
    } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            return next(new AppError('Access token has expired.', 401));
        }
        return next(new AppError('Invalid access token.', 401));
    }
};

export default authenticate;