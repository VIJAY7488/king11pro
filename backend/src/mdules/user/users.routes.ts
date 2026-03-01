import { Router } from "express";
import { loginSchema, refreshTokenSchema, registerSchema } from "./users.validator";
import usersController from "./users.controller";
import validate from "../../middlewares/validate.middleware";
import authenticate from "../../middlewares/authenticate.middleware";

const router = Router();

// ── Public Routes (no auth required) ─────────────────────────────────────────
router.post('/register', validate(registerSchema), usersController.register);
router.post('/login',    validate(loginSchema),    usersController.login);
router.post('/refresh',  validate(refreshTokenSchema), usersController.refreshTokens);


// ── Protected Routes (JWT required) ──────────────────────────────────────────
router.use(authenticate);

router.get('/me', usersController.getProfile);
export default router;