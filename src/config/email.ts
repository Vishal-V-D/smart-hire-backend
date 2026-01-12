import nodemailer from "nodemailer";

// Email configuration from environment variables
const config = {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
    },
};

// Create reusable transporter
export const transporter = nodemailer.createTransport(config);

// Default sender
export const EMAIL_FROM = process.env.EMAIL_FROM || "SmartHire <noreply@smarthire.com>";

// Frontend URL for invitation links
export const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

/**
 * Verify SMTP connection
 */
export const verifyEmailConfig = async (): Promise<boolean> => {
    try {
        await transporter.verify();
        console.log("✅ [EMAIL] SMTP connection verified");
        return true;
    } catch (error: any) {
        console.error("❌ [EMAIL] SMTP connection failed:", error.message);
        return false;
    }
};

/**
 * Send an email
 */
export interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
    try {
        const info = await transporter.sendMail({
            from: EMAIL_FROM,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
        });

        console.log(`✅ [EMAIL] Sent to ${options.to}: ${info.messageId}`);
        return true;
    } catch (error: any) {
        console.error(`❌ [EMAIL] Failed to send to ${options.to}:`, error.message);
        return false;
    }
};

/**
 * Generate invitation email HTML
 */
export const generateInvitationEmail = (params: {
    name?: string;
    assessmentTitle: string;
    organizerName: string;
    inviteLink: string;
    expiresAt: Date;
}): { html: string; text: string } => {
    const greeting = params.name ? `Hello ${params.name},` : "Hello,";
    const expiryDate = params.expiresAt.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

    const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .btn { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; }
        .expiry { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 5px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Assessment Invitation</h1>
        </div>
        <div class="content">
            <p>${greeting}</p>
            <p>You have been invited by <strong>${params.organizerName}</strong> to participate in an assessment:</p>
            <h2 style="color: #667eea;">${params.assessmentTitle}</h2>
            <p>Click the button below to accept your invitation and start the assessment:</p>
            <p style="text-align: center;">
                <a href="${params.inviteLink}" class="btn">Accept Invitation</a>
            </p>
            <div class="expiry">
                <strong>Expires:</strong> ${expiryDate}
            </div>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${params.inviteLink}</p>
        </div>
        <div class="footer">
            <p>This is an automated message from SmartHire Assessment Platform.</p>
            <p>If you didn't expect this invitation, please ignore this email.</p>
        </div>
    </div>
</body>
</html>`;

    const text = `
${greeting}

You have been invited by ${params.organizerName} to participate in an assessment:

${params.assessmentTitle}

Accept your invitation: ${params.inviteLink}

This invitation expires on: ${expiryDate}

---
SmartHire Assessment Platform
`;

    return { html, text };
};
