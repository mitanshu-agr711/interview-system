import { Router } from "express";
import { uploadAvatar } from "../controllers/image.js";
import { upload } from "../middleware/multer.js";
import { getAllImages } from "../controllers/image.js";
const router = Router();
router.post("/upload-avatar", upload.fields([{ name: "avatar", maxCount: 1 }]), uploadAvatar);
router.get("/images", getAllImages);
export default router;
