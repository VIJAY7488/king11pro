import { Router } from 'express';
import userRouter from '../mdules/user/users.routes'

const router = Router();

router.use('/users', userRouter);

export default router;