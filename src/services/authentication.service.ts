import bcryptjs from "bcryptjs";
import { AppDataSource } from "../config/db";
import { User, UserRole, AdminStatus } from "../entities/user.entity";
import { TokenGenerator } from "../utils/tokenGenerator";
import { EmailService } from "./emailService";

const bcrypt = bcryptjs;

export class AuthenticationService {
  private userRepo = AppDataSource.getRepository(User);

  /**
   * Register user (admin/organizer)
   */
  async registerUser(
    email: string,
    username: string,
    password: string,
    role: UserRole,
    fullName?: string,
    organizationName?: string
  ): Promise<User> {
    // Check if user exists
    const existingUser = await this.userRepo.findOne({
      where: [{ email }, { username }],
    });

    if (existingUser) {
      throw new Error("Email or username already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = this.userRepo.create({
      email,
      username,
      password: hashedPassword,
      role,
      fullName,
      organizationName,
      status: AdminStatus.ACTIVE,
      isVerified: true,
    });

    return this.userRepo.save(user);
  }

  /**
   * Login with email and password
   */
  async loginWithPassword(
    email: string,
    password: string
  ): Promise<{ user: User; token: string } | null> {
    const user = await this.userRepo.findOne({
      where: { email },
      select: ["id", "email", "username", "password", "role", "status"],
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (user.status === AdminStatus.DISABLED) {
      throw new Error("Account is disabled");
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new Error("Invalid password");
    }

    // Update last login
    user.lastLogin = new Date();
    await this.userRepo.save(user);

    // Generate JWT
    const token = TokenGenerator.generateJWT(
      user.id,
      user.email,
      user.role
    );

    return { user, token };
  }

  /**
   * Create admin with magic login link
   */
  async createAdminWithMagicLink(
    email: string,
    fullName: string,
    role: UserRole,
    organizerId: string,
    organizerEmail: string
  ): Promise<User> {
    // Check if user exists
    const existingUser = await this.userRepo.findOne({ where: { email } });

    if (existingUser) {
      throw new Error("Email already exists");
    }

    // Generate magic token
    const { token: magicToken, expiryDate: magicTokenExpiryDate } =
      TokenGenerator.generateMagicToken();

    // Create temporary username
    const username = email.split("@")[0] + "_" + Date.now();

    // Create user with magic token
    const user = this.userRepo.create({
      email,
      username,
      fullName,
      role,
      status: AdminStatus.PENDING,
      assignedOrganizerId: organizerId,
      magicLoginToken: magicToken,
      magicLoginTokenExpiry: magicTokenExpiryDate,
      password: await bcrypt.hash(
        TokenGenerator.generateTemporaryPassword(),
        10
      ),
    });

    const savedUser = await this.userRepo.save(user);

    // Send email with magic link
    await EmailService.sendAdminCreationEmail(
      email,
      fullName,
      magicToken,
      organizerEmail
    );

    return savedUser;
  }

  /**
   * Login with magic token (from email link)
   */
  async loginWithMagicToken(
    token: string
  ): Promise<{ user: User; jwtToken: string; requiresPasswordSetup: boolean } | null> {
    console.log("[MAGIC LOGIN] Attempting login with token:", token.substring(0, 30) + "...");
    console.log("[MAGIC LOGIN] Full token length:", token.length);
    console.log("[MAGIC LOGIN] Full token:", token);
    
    const user = await this.userRepo.findOne({
      where: { magicLoginToken: token },
      select: ["id", "email", "username", "role", "status", "fullName", "magicLoginTokenExpiry", "hasSetPassword"],
    });

    if (!user) {
      console.log("[MAGIC LOGIN] No user found with this token. Token may be already used or invalid.");
      
      // Debug: Show ALL tokens in database to compare
      const allUsersWithToken = await this.userRepo
        .createQueryBuilder("user")
        .where("user.magicLoginToken IS NOT NULL")
        .select(["user.id", "user.email", "user.magicLoginToken"])
        .getMany();
      
      console.log("[MAGIC LOGIN] Users with active magic tokens:", allUsersWithToken.length);
      allUsersWithToken.forEach((u, i) => {
        console.log(`[MAGIC LOGIN] Token ${i + 1}: ${u.magicLoginToken}`);
        console.log(`[MAGIC LOGIN] Token ${i + 1} length: ${u.magicLoginToken?.length}`);
        console.log(`[MAGIC LOGIN] Token ${i + 1} email: ${u.email}`);
        console.log(`[MAGIC LOGIN] Tokens match: ${u.magicLoginToken === token}`);
      });
      
      throw new Error("Invalid magic link");
    }

    console.log("[MAGIC LOGIN] User found:", user.email);
    console.log("[MAGIC LOGIN] Token expiry:", user.magicLoginTokenExpiry);

    // Check if token is expired
    if (TokenGenerator.isTokenExpired(user.magicLoginTokenExpiry!)) {
      console.log("[MAGIC LOGIN] Token has EXPIRED!");
      throw new Error("Magic link has expired");
    }

    // Check if password setup is required (first time login)
    const requiresPasswordSetup = !user.hasSetPassword;
    console.log("[MAGIC LOGIN] Requires password setup:", requiresPasswordSetup);

    // Get assignedOrganizerId for admin users
    const fullUser = await this.userRepo.findOne({
      where: { id: user.id },
      select: ["id", "assignedOrganizerId", "username", "fullName"],
    });

    // Invalidate magic token and verify user
    user.magicLoginToken = null as any;
    user.magicLoginTokenExpiry = null as any;
    user.status = AdminStatus.ACTIVE;
    user.isVerified = true;  // Mark as verified so they can login with password later
    user.lastLogin = new Date();

    await this.userRepo.save(user);
    console.log("[MAGIC LOGIN] Token invalidated, user verified and status updated to ACTIVE");

    // Generate JWT with additional data for admin users
    const jwtToken = TokenGenerator.generateJWT(
      user.id,
      user.email,
      user.role,
      "7d",
      {
        assignedOrganizerId: fullUser?.assignedOrganizerId,
        username: fullUser?.username,
        fullName: fullUser?.fullName,
      }
    );

    console.log("[MAGIC LOGIN] SUCCESS! JWT generated for:", user.email);
    return { user, jwtToken, requiresPasswordSetup };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<string> {
    const user = await this.userRepo.findOne({ where: { email } });

    if (!user) {
      // Don't reveal if email exists (security best practice)
      return "If an account exists with that email, a reset link will be sent.";
    }

    // Generate reset token
    const { token: resetToken, expiryDate: resetTokenExpiry } =
      TokenGenerator.generateResetToken();

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;

    await this.userRepo.save(user);

    // Send email
    await EmailService.sendPasswordResetEmail(email, resetToken);

    return "Password reset link sent to email";
  }

  /**
   * Reset password with token
   */
  async resetPasswordWithToken(
    token: string,
    newPassword: string
  ): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: { resetToken: token },
      select: ["id", "email", "resetTokenExpiry"],
    });

    if (!user) {
      throw new Error("Invalid reset token");
    }

    // Check if token is expired
    if (TokenGenerator.isTokenExpired(user.resetTokenExpiry)) {
      throw new Error("Reset token has expired");
    }

    // Hash new password
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = null as any;
    user.resetTokenExpiry = null as any;
    user.hasSetPassword = true; // Mark that user has set their password
    user.isVerified = true;  // Mark as verified so they can login

    await this.userRepo.save(user);

    return true;
  }

  /**
   * Change password (authenticated user)
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ["id", "password"],
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isCurrentPasswordValid) {
      throw new Error("Current password is incorrect");
    }

    // Hash new password
    user.password = await bcrypt.hash(newPassword, 10);
    user.hasSetPassword = true; // Mark that user has set their password

    await this.userRepo.save(user);

    return true;
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }

  /**
   * Update user last login
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepo.update(userId, {
      lastLogin: new Date(),
    });
  }

  /**
   * Set password for first time (after magic link login)
   * No current password verification required
   */
  async setPasswordFirstTime(userId: string, newPassword: string): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ["id", "hasSetPassword"],
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Only allow if user hasn't set password yet
    if (user.hasSetPassword) {
      throw new Error("Password already set. Use change password instead.");
    }

    // Hash new password
    user.password = await bcrypt.hash(newPassword, 10);
    user.hasSetPassword = true;
    user.isVerified = true;  // Mark as verified so they can login with password

    await this.userRepo.save(user);

    return true;
  }
}
