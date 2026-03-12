import { Router } from "express";
import { register, login } from "../controllers/auth.controller.js";
import { refreshAccessToken } from "../middleware/verifyToken.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshAccessToken);


export default router;