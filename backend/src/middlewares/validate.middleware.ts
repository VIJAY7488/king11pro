import { Request, Response, NextFunction } from 'express';
import { ObjectSchema } from 'joi';
import AppError from '../utils/AppError';



type ValidationTarget = 'body' | 'query' | 'params';

const validate = 
    (schema: ObjectSchema, target: ValidationTarget = 'body') => (req: Request, res:Response, next: NextFunction): void => {
        const { error, value } = schema.validate(req[target], {
            abortEarly: false, // collect all errors, not just the first
            stripUnknown: true  // drop undeclared keys
        });

        if(error) {
            const message = error.details.map((d) => d.message).join('; ');
            return next(new AppError(message, 422));
        }

        req[target] = value; // replace with sanitised value
        next();
};

export default validate;
