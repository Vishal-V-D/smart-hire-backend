import express, { Router } from "express";
import { AuthenticationController } from "../controllers/authentication.controller";
import { authenticate } from "../middleware/auth.middleware";

const router: Router = express.Router();
const authController = new AuthenticationController();

// ✅ Public routes (no auth required)

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post("/login", (req, res) => authController.login(req, res));

/**
 * GET /api/auth/magic-login/:token
 * Magic link login (auto-redirect to dashboard)
 */
router.get("/magic-login/:token", (req, res) =>
  authController.magicLogin(req, res)
);

/**
 * POST /api/auth/magic-login
 * Magic link login via POST (for frontend API calls)
 */
router.post("/magic-login", (req, res) =>
  authController.magicLogin(req, res)
);

/**
 * POST /api/auth/password-reset/request
 * Request password reset email
 */
router.post("/password-reset/request", (req, res) =>
  authController.requestPasswordReset(req, res)
);

/**
 * POST /api/auth/password-reset/confirm
 * Reset password with token
 */
router.post("/password-reset/confirm", (req, res) =>
  authController.resetPassword(req, res)
);

// ✅ Protected routes (auth required)

/**
 * POST /api/auth/change-password
 * Change password for authenticated user (requires current password)
 */
router.post(
  "/change-password",
  authenticate,
  (req, res) => authController.changePassword(req, res)
);

/**
 * POST /api/auth/set-password
 * Set password for first time (after magic link login, no current password required)
 */
router.post(
  "/set-password",
  authenticate,
  (req, res) => authController.setPassword(req, res)
);

export default router;
