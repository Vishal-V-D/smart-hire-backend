import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

export class EmailService {
  private static transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  /**
   * Send admin creation email with magic login link
   */
  static async sendAdminCreationEmail(
    adminEmail: string,
    adminName: string,
    magicToken: string,
    organizerEmail: string
  ): Promise<boolean> {
    try {
      // Link to frontend magic-login page that will call the API
      const loginLink = `${APP_URL}/auth/magic-login?token=${magicToken}`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .button { background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
            .footer { background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Secure Hire</h1>
            </div>
            <div class="content">
              <p>Dear ${adminName},</p>
              <p>You've been added as an Admin to view assessments and reports.</p>
              <p><strong>🔗 CLICK HERE TO LOGIN:</strong></p>
              <a href="${loginLink}" class="button">LOGIN NOW</a>
              <p><strong>This link is valid for 1 hour.</strong></p>
              <p>After clicking, you'll be asked to set your permanent password.</p>
              <p>Questions? Contact: ${organizerEmail}</p>
            </div>
            <div class="footer">
              <p>&copy; 2024 Secure Hire. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.transporter.sendMail({
        from: SMTP_USER,
        to: adminEmail,
        subject: "You've been added as an Admin - Secure Login Link",
        html: htmlContent,
      });

      return true;
    } catch (error) {
      console.error("Failed to send admin creation email:", error);
      return false;
    }
  }

  /**
   * Send password reset email
   */
  static async sendPasswordResetEmail(
    email: string,
    resetToken: string
  ): Promise<boolean> {
    try {
      const resetLink = `${APP_URL}/reset-password?token=${resetToken}`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; }
            .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .button { background-color: #FF9800; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
            .footer { background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hi,</p>
              <p>Someone requested a password reset for your account.</p>
              <p><strong>🔗 RESET PASSWORD:</strong></p>
              <a href="${resetLink}" class="button">RESET PASSWORD</a>
              <p><strong>This link is valid for 24 hours.</strong></p>
              <p>If you didn't request this, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; 2024 Secure Hire. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.transporter.sendMail({
        from: SMTP_USER,
        to: email,
        subject: "Password Reset Request",
        html: htmlContent,
      });

      return true;
    } catch (error) {
      console.error("Failed to send password reset email:", error);
      return false;
    }
  }

  /**
   * Send login link resent email
   */
  static async sendLoginLinkResendEmail(
    email: string,
    adminName: string,
    magicToken: string
  ): Promise<boolean> {
    try {
      const loginLink = `${APP_URL}/login?token=${magicToken}`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; }
            .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .button { background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
            .footer { background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Login Link - Access Your Admin Dashboard</h1>
            </div>
            <div class="content">
              <p>Dear ${adminName},</p>
              <p>Here's your login link:</p>
              <p><strong>🔗 LOGIN NOW:</strong></p>
              <a href="${loginLink}" class="button">LOGIN NOW</a>
              <p><strong>Valid for 1 hour.</strong></p>
            </div>
            <div class="footer">
              <p>&copy; 2024 Secure Hire. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.transporter.sendMail({
        from: SMTP_USER,
        to: email,
        subject: "Login Link - Access Your Admin Dashboard",
        html: htmlContent,
      });

      return true;
    } catch (error) {
      console.error("Failed to send login link resend email:", error);
      return false;
    }
  }

  /**
   * Send admin disabled notification
   */
  static async sendAdminDisabledEmail(
    email: string,
    adminName: string
  ): Promise<boolean> {
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; }
            .header { background-color: #F44336; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .footer { background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Account Status Changed</h1>
            </div>
            <div class="content">
              <p>Dear ${adminName},</p>
              <p>Your admin access has been revoked or disabled.</p>
              <p>You will no longer be able to access assessments and reports.</p>
              <p>If you believe this is an error, please contact your organizer.</p>
            </div>
            <div class="footer">
              <p>&copy; 2024 Secure Hire. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.transporter.sendMail({
        from: SMTP_USER,
        to: email,
        subject: "Your Admin Access Has Been Disabled",
        html: htmlContent,
      });

      return true;
    } catch (error) {
      console.error("Failed to send admin disabled email:", error);
      return false;
    }
  }
}
