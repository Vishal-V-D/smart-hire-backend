import { Router } from "express";
import * as authCtrl from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.post("/signup/organizer", authCtrl.registerOrganizer);
router.post("/signup/contestant", authCtrl.registerContestant);
router.post("/login", authCtrl.login);
router.post("/google", authCtrl.googleAuth); // ✅ Google Auth endpoint
router.post("/refresh-token", authCtrl.refreshToken); // ✅ Refresh Token endpoint
router.post("/logout", authCtrl.logout);
router.get("/me", authenticate, authCtrl.me);
router.get("/users/:id", authCtrl.getUserById); // ✅ New endpoint for internal use
router.put("/profile", authenticate, authCtrl.updateProfile); // ✅ Update Profile Route
router.get("/verify-email", authCtrl.verifyEmail); // ✅ Email verification endpoint

export default router;
