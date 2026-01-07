import { Request, Response } from "express";
import { AuthenticationService } from "../services/authentication.service";

export class AuthenticationController {
  private authService = new AuthenticationService();

  /**
   * Login with email and password
   */
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: "Email and password are required",
        });
      }

      const result = await this.authService.loginWithPassword(email, password);

      if (!result) {
        return res.status(401).json({
          success: false,
          error: "Invalid email or password",
        });
      }

      res.status(200).json({
        success: true,
        token: result.token,
        user: {
          id: result.user.id,
          email: result.user.email,
          username: result.user.username,
          role: result.user.role,
          fullName: result.user.fullName,
        },
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Magic link login
   */
  async magicLogin(req: Request, res: Response) {
    try {
      // Support both GET param and POST body
      const token = req.params.token || req.body.token || req.query.token;

      console.log("[MAGIC LOGIN CONTROLLER] Received request");
      console.log("[MAGIC LOGIN CONTROLLER] req.params.token:", req.params.token ? "exists" : "null");
      console.log("[MAGIC LOGIN CONTROLLER] req.body.token:", req.body.token ? req.body.token.substring(0, 20) + "..." : "null");
      console.log("[MAGIC LOGIN CONTROLLER] req.query.token:", req.query.token ? "exists" : "null");
      console.log("[MAGIC LOGIN CONTROLLER] Final token:", token ? (token as string).substring(0, 20) + "..." : "null");

      if (!token) {
        return res.status(400).json({
          success: false,
          error: "Magic link token is required",
        });
      }

      const result = await this.authService.loginWithMagicToken(token as string);

      if (!result) {
        return res.status(401).json({
          success: false,
          error: "Invalid or expired magic link",
        });
      }

      // Return JSON response with token and user info
      // Frontend will handle the redirect
      res.status(200).json({
        success: true,
        message: "Login successful",
        token: result.jwtToken,
        user: {
          id: result.user.id,
          email: result.user.email,
          username: result.user.username,
          role: result.user.role,
          fullName: result.user.fullName,
          status: result.user.status,
        },
        requiresPasswordSetup: result.requiresPasswordSetup,
      });
    } catch (error: any) {
      console.log("[MAGIC LOGIN CONTROLLER] Error:", error.message);
      res.status(401).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: "Email is required",
        });
      }

      const message = await this.authService.requestPasswordReset(email);

      res.status(200).json({
        success: true,
        message,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          error: "Token and new password are required",
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: "Password must be at least 8 characters",
        });
      }

      await this.authService.resetPasswordWithToken(token, newPassword);

      res.status(200).json({
        success: true,
        message: "Password reset successfully",
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Change password (authenticated user)
   */
  async changePassword(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const { currentPassword, newPassword } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "User not authenticated",
        });
      }

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: "Current password and new password are required",
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: "New password must be at least 8 characters",
        });
      }

      await this.authService.changePassword(
        userId,
        currentPassword,
        newPassword
      );

      res.status(200).json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Set password for first time (after magic link login)
   * No current password required
   */
  async setPassword(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const { newPassword } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "User not authenticated",
        });
      }

      if (!newPassword) {
        return res.status(400).json({
          success: false,
          error: "New password is required",
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: "Password must be at least 8 characters",
        });
      }

      await this.authService.setPasswordFirstTime(userId, newPassword);

      res.status(200).json({
        success: true,
        message: "Password set successfully",
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
}
