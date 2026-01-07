import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { UserRole } from "../entities/user.entity";

// ✅ REGISTER ORGANIZER
export const registerOrganizer = async (req: Request, res: Response) => {
  try {
    const { email, username, password, organizationName } = req.body;

    console.log(`\n📝 [SIGNUP_ORGANIZER] Request from ${email}`);
    console.log(`   Organization: ${organizationName || 'Not provided'}`);

    if (!email || !username || !password) {
      return res.status(400).json({
        success: false,
        message: "Email, username, and password are required",
      });
    }

    const user = await authService.registerOrganizer(email, username, password, organizationName);
    const token = authService.generateToken(user);

    res.status(201).json({
      success: true,
      message: "Organizer registered successfully",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        organizationName: user.organizationName,
        role: user.role,
      },
      token,
    });
  } catch (error: any) {
    console.error("❌ [SIGNUP_ORGANIZER] Error:", error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to register organizer",
    });
  }
};

// ✅ REGISTER CONTESTANT
export const registerContestant = async (req: Request, res: Response) => {
  try {
    const { email, username, password } = req.body;
    const user = await authService.registerUser(
      email,
      username,
      password,
      UserRole.CONTESTANT
    );

    res.status(201).json({
      message: "Contestant registered",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ✅ LOGIN
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const { accessToken, refreshToken, user } = await authService.loginUser(email, password);

    // Set refresh token in HTTP-only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Use secure cookies in production
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      message: "Login successful",
      token: accessToken, // Send access token in body
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ✅ VERIFY EMAIL
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    if (!token) throw { status: 400, message: "Verification token is required" };

    const result = await authService.verifyEmail(token as string);
    res.json(result);
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message });
  }
};


// ✅ LOGOUT
export const logout = async (req: Request, res: Response) => {
  res.clearCookie("refreshToken");
  res.status(200).json({ message: "Logged out successfully" });
};

// ✅ GET CURRENT USER
export const me = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const user = await authService.getUserById(userId);
    res.json({ user });
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ✅ GET USER BY ID (Internal/Admin)
export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await authService.getUserById(req.params.id);
    res.json(user);
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ✅ GOOGLE AUTH
export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { token, role } = req.body; // Extract role from body
    if (!token) throw { status: 400, message: "Google token is required" };

    // Normalize role to uppercase and validate
    let userRole = UserRole.CONTESTANT;
    if (role) {
      const normalizedRole = role.toUpperCase();
      if (normalizedRole === "ORGANIZER") {
        userRole = UserRole.ORGANIZER;
      } else if (normalizedRole === "CONTESTANT") {
        userRole = UserRole.CONTESTANT;
      }
    }

    const payload = await authService.verifyGoogleToken(token);
    const { email, name, sub: googleId, picture: avatarUrl } = payload;

    if (!email || !name || !googleId) {
      throw { status: 400, message: "Invalid Google token payload" };
    }

    const { accessToken, refreshToken, user } = await authService.loginOrRegisterWithGoogle(
      email,
      name,
      googleId,
      avatarUrl,
      userRole // Pass normalized role
    );

    // Set refresh token in HTTP-only cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      message: "Google authentication successful",
      token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err: any) {
    console.error("❌ [Google Auth Error]:", err);
    res.status(err.status || 500).json({ message: err.message });
  }
};

// ✅ REFRESH TOKEN
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) throw { status: 401, message: "Refresh token required" };

    const { accessToken } = await authService.refreshAccessToken(refreshToken);

    res.json({ token: accessToken });
  } catch (err: any) {
    res.status(err.status || 403).json({ message: err.message });
  }
};

// ✅ UPDATE PROFILE (Protected)
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { username, organizationName, avatarUrl } = req.body;

    const updatedUser = await authService.updateProfile(userId, {
      username,
      organizationName,
      avatarUrl
    });

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser
    });
  } catch (err: any) {
    console.error("❌ [UPDATE_PROFILE] Error:", err);
    res.status(err.status || 500).json({ message: err.message });
  }
};
