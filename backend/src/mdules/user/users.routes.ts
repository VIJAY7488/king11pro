import { Router } from "express";
import { registerSchema } from "./users.validator";
import usersController from "./users.controller";
import validate from "../../middlewares/validate.middleware";

const router = Router();

// ── Public Routes (no auth required) ─────────────────────────────────────────
router.post('/register', validate(registerSchema), usersController.register);


export default router;