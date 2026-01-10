import { AppDataSource } from "../config/db";
import { User, UserRole } from "../entities/user.entity";
import { hashPassword, comparePassword } from "../utils/password.util";
import { signJwt, signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.util";
import { sendVerificationEmail } from "./email.service";
import crypto from "crypto";

const repo = () => AppDataSource.getRepository(User);

export const registerUser = async (
  email: string,
  username: string,
  password: string,
  role: UserRole
) => {
  console.log(`[REGISTER ATTEMPT] Email: ${email}, Username: ${username}, Role: ${role}`);

  const exists = await repo().findOne({
    where: [{ email }, { username }],
  });

  if (exists) {
    console.log(`[REGISTER FAILED] User already exists - Email: ${exists.email}, Username: ${exists.username}, Role: ${exists.role}, Verified: ${exists.isVerified}`);
    throw { status: 400, message: "Email or username already exists" };
  }

  const hashedPassword = await hashPassword(password);
  const verificationToken = crypto.randomBytes(32).toString("hex");

  const user = repo().create({
    email,
    username,
    password: hashedPassword,
    role,
    isVerified: false,
    verificationToken,
  });

  const savedUser = await repo().save(user);

  console.log(`[REGISTER SUCCESS] User created: ${savedUser.username} (${savedUser.email}), Role: ${savedUser.role}`);

  // Send verification email
  await sendVerificationEmail(email, verificationToken);

  return {
    id: savedUser.id,
    email: savedUser.email,
    username: savedUser.username,
    role: savedUser.role,
    createdAt: savedUser.createdAt,
    message: "Registration successful. Please check your email to verify your account.",
  };
};

export const loginUser = async (emailOrUsername: string, password: string) => {
  console.log(`[LOGIN ATTEMPT] Email/Username: ${emailOrUsername}`);

  const user = await repo()
    .createQueryBuilder("user")
    .addSelect("user.verificationToken") // Select hidden column if needed for debugging, but mainly we need isVerified
    .where("user.email = :q OR user.username = :q", { q: emailOrUsername })
    .getOne();

  if (!user) {
    console.log(`[LOGIN FAILED] User not found: ${emailOrUsername}`);
    throw { status: 401, message: "Invalid credentials" };
  }

  console.log(`[LOGIN] User found: ${user.username} (${user.email}), Role: ${user.role}, Verified: ${user.isVerified}`);

  const passwordMatch = await comparePassword(password, user.password);
  if (!passwordMatch) {
    console.log(`[LOGIN FAILED] Password mismatch for user: ${user.username}`);
    throw { status: 401, message: "Invalid credentials" };
  }

  console.log(`[LOGIN] Password matched for user: ${user.username}`);

  if (!user.isVerified) {
    console.log(`[LOGIN FAILED] Email not verified for user: ${user.username}`);
    throw { status: 403, message: "Email not verified. Please check your inbox." };
  }

  console.log(`[LOGIN SUCCESS] User ${user.username} logged in successfully`);

  const payload = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    // Include assignedOrganizerId for ADMIN/COMPANY users
    ...(user.assignedOrganizerId && { assignedOrganizerId: user.assignedOrganizerId }),
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Save refresh token to DB
  user.refreshToken = refreshToken;
  await repo().save(user);

  return { accessToken, refreshToken, user };
};

export const verifyEmail = async (token: string) => {
  const user = await repo().findOne({
    where: { verificationToken: token },
  });

  if (!user) throw { status: 400, message: "Invalid or expired verification token" };

  user.isVerified = true;
  user.verificationToken = null as any; // Clear the token
  await repo().save(user);

  return { message: "Email verified successfully. You can now login." };
};

export const getUserById = async (userId: string) => {
  const user = await repo().findOne({ where: { id: userId } });
  if (!user) throw { status: 404, message: "User not found" };
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    organizationName: user.organizationName,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };
};

// ✅ GOOGLE AUTH
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const verifyGoogleToken = async (token: string) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) throw new Error("Invalid token payload");
    return payload;
  } catch (error) {
    throw { status: 401, message: "Invalid Google token" };
  }
};

export const loginOrRegisterWithGoogle = async (
  email: string,
  name: string,
  googleId: string,
  avatarUrl?: string,
  role: UserRole = UserRole.CONTESTANT // Default to Contestant if not provided
) => {
  let user = await repo().findOne({ where: [{ googleId }, { email }] });

  if (!user) {
    // Register new user
    user = repo().create({
      email,
      username: name.replace(/\s+/g, "").toLowerCase() + Math.floor(Math.random() * 1000), // Generate unique username
      password: "", // No password for Google users
      googleId,
      avatarUrl,
      isVerified: true, // Google emails are already verified
      role: role, // Use provided role
    });
    await repo().save(user);
  } else {
    // Link Google ID if not already linked
    if (!user.googleId) {
      user.googleId = googleId;
      if (avatarUrl && !user.avatarUrl) user.avatarUrl = avatarUrl;
      await repo().save(user);
    }
  }

  const payload = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Save refresh token to DB
  user.refreshToken = refreshToken;
  await repo().save(user);

  return { accessToken, refreshToken, user };
};

export const refreshAccessToken = async (refreshToken: string) => {
  // 1. Verify token signature
  const decoded: any = verifyRefreshToken(refreshToken);

  // 2. Check if user exists and token matches DB
  const user = await repo()
    .createQueryBuilder("user")
    .addSelect("user.refreshToken")
    .where("user.id = :id", { id: decoded.id })
    .getOne();

  if (!user || user.refreshToken !== refreshToken) {
    throw { status: 403, message: "Invalid refresh token" };
  }

  // 3. Issue new access token
  const payload = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  };

  const accessToken = signAccessToken(payload);

  return { accessToken };
};

/**
 * Register organizer with organization name
 */
export const registerOrganizer = async (
  email: string,
  username: string,
  password: string,
  organizationName?: string
) => {
  console.log(`📝 [REGISTER_ORGANIZER] ${email}`);

  const existingUser = await repo().findOne({ where: { email } });
  if (existingUser) {
    throw { status: 400, message: "User already exists" };
  }

  const hashedPassword = await hashPassword(password);
  const verificationToken = crypto.randomBytes(32).toString("hex");

  const user = repo().create({
    email,
    username,
    password: hashedPassword,
    role: UserRole.ORGANIZER,
    organizationName,
    isVerified: false, // Require email verification
    verificationToken,
  });

  await repo().save(user);
  console.log(`✅ [REGISTER_ORGANIZER] User created: ${user.id}`);

  // Send verification email
  await sendVerificationEmail(email, verificationToken);

  return user;
};

/**
 * Generate JWT token (for backward compatibility)
 */
export const generateToken = (user: User) => {
  const payload = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  };
  return signAccessToken(payload);
};

/**
 * Update user profile (Organizer)
 */
export const updateProfile = async (
  userId: string,
  data: {
    username?: string;
    organizationName?: string;
    avatarUrl?: string; // For profile picture update
  }
) => {
  console.log(`🔄 [UPDATE_PROFILE] User: ${userId}`);

  const user = await repo().findOne({ where: { id: userId } });
  if (!user) throw { status: 404, message: "User not found" };

  if (data.username) user.username = data.username;
  if (data.organizationName) user.organizationName = data.organizationName;
  if (data.avatarUrl) user.avatarUrl = data.avatarUrl;

  const updatedUser = await repo().save(user);

  console.log(`✅ [UPDATE_PROFILE] Updated: ${updatedUser.username}`);

  return {
    id: updatedUser.id,
    email: updatedUser.email,
    username: updatedUser.username,
    organizationName: updatedUser.organizationName,
    avatarUrl: updatedUser.avatarUrl,
    role: updatedUser.role,
  };
};

