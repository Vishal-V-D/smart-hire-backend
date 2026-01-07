import crypto from "crypto";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const MAGIC_LINK_EXPIRY = 3600; // 1 hour in seconds
const RESET_TOKEN_EXPIRY = 86400; // 24 hours in seconds

export class TokenGenerator {
  /**
   * Generate JWT token
   */
  static generateJWT(
    userId: string,
    email: string,
    role: string,
    expiresIn: string = "7d",
    additionalData?: { assignedOrganizerId?: string; username?: string; fullName?: string }
  ): string {
    return jwt.sign(
      {
        id: userId,
        email,
        role,
        ...additionalData,
      },
      JWT_SECRET || "default-secret",
      { expiresIn } as any
    );
  }

  /**
   * Generate magic login token (unique, secure)
   */
  static generateMagicToken(): {
    token: string;
    expiryDate: Date;
  } {
    const token = crypto.randomBytes(32).toString("hex");
    const expiryDate = new Date(Date.now() + MAGIC_LINK_EXPIRY * 1000);

    return { token, expiryDate };
  }

  /**
   * Generate password reset token
   */
  static generateResetToken(): {
    token: string;
    expiryDate: Date;
  } {
    const token = crypto.randomBytes(32).toString("hex");
    const expiryDate = new Date(Date.now() + RESET_TOKEN_EXPIRY * 1000);

    return { token, expiryDate };
  }

  /**
   * Verify JWT token
   */
  static verifyJWT(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(expiryDate: Date): boolean {
    return new Date() > expiryDate;
  }

  /**
   * Generate temporary password
   */
  static generateTemporaryPassword(length: number = 12): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}
