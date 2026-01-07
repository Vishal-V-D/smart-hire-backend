import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();
const userController = new UserController();

// Protected Routes
// Follow routes removed


import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

// Photo Routes
router.post("/upload-photo", authenticate, upload.single("photo"), (req, res) => userController.uploadPhoto(req, res));
router.get("/:userId/photo", authenticate, (req, res) => userController.getPhoto(req, res));

export default router;
