import multer from "multer";
import fs from "fs";
const storage = multer.diskStorage({
    destination: function (_req, _file, cb) {
        const dir = "./public/temp";
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (_req, file, cb) {
        cb(null, file.originalname);
    },
});
export const upload = multer({ storage });
