import { Router } from "express";
import { uploadAvatar } from "../controllers/image.js";
import { upload } from "../middleware/multer.js";

const router = Router();

router.post("/upload-avatar", upload.fields([{ name: "avatar", maxCount: 1 }]), uploadAvatar as any);

export default router;
