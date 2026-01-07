import * as SibApiV3Sdk from "@sendinblue/client";

// Brevo (Sendinblue) configuration from environment variables
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || "SecureHire";
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "noreply@securehire.com";

// Frontend URL for invitation links
export const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Initialize Brevo API client
let apiInstance: SibApiV3Sdk.TransactionalEmailsApi | null = null;

const getApiInstance = (): SibApiV3Sdk.TransactionalEmailsApi => {
    if (!apiInstance) {
        apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
        apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, BREVO_API_KEY);
    }
    return apiInstance;
};

/**
 * Email options interface
 */
export interface EmailOptions {
    to: string;
    toName?: string;
    subject: string;
    html: string;
    text?: string;
}

/**
 * Verify Brevo API connection
 */
export const verifyEmailConfig = async (): Promise<boolean> => {
    try {
        if (!BREVO_API_KEY) {
            console.warn("⚠️ [BREVO] API key not configured! Set BREVO_API_KEY in .env");
            return false;
        }

        console.log(`✅ [BREVO] API key configured`);
        console.log(`   📧 Sender: ${BREVO_SENDER_NAME} <${BREVO_SENDER_EMAIL}>`);
        return true;
    } catch (error: any) {
        console.error("❌ [BREVO] Connection failed:", error.message);
        return false;
    }
};

/**
 * Send an email using Brevo API
 */
export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
    try {
        if (!BREVO_API_KEY) {
            console.error("❌ [BREVO] API key not configured!");
            return false;
        }

        console.log(`\n📤 [BREVO] Sending email...`);
        console.log(`   To: ${options.to}`);
        console.log(`   Subject: ${options.subject}`);

        const api = getApiInstance();

        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
        sendSmtpEmail.sender = {
            name: BREVO_SENDER_NAME,
            email: BREVO_SENDER_EMAIL,
        };
        sendSmtpEmail.to = [
            {
                email: options.to,
                name: options.toName || options.to,
            },
        ];
        sendSmtpEmail.subject = options.subject;
        sendSmtpEmail.htmlContent = options.html;
        if (options.text) {
            sendSmtpEmail.textContent = options.text;
        }

        const result = await api.sendTransacEmail(sendSmtpEmail);

        console.log(`✅ [BREVO] Email sent successfully!`);
        console.log(`   Message ID: ${result.body.messageId}`);
        return true;
    } catch (error: any) {
        console.error(`❌ [BREVO] Failed to send email:`, error.message);
        if (error.body) {
            console.error(`   Error details:`, JSON.stringify(error.body));
        }
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
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 28px; }
        .content { background: white; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .assessment-title { font-size: 24px; color: #667eea; margin: 20px 0; font-weight: 600; }
        .btn { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; padding: 16px 40px; text-decoration: none; border-radius: 8px; margin: 25px 0; font-weight: 600; font-size: 16px; }
        .btn:hover { opacity: 0.9; }
        .expiry { background: #fff8e1; border-left: 4px solid #ffc107; padding: 15px 20px; border-radius: 4px; margin: 20px 0; }
        .footer { text-align: center; color: #888; font-size: 12px; margin-top: 30px; padding: 20px; }
        .link-fallback { word-break: break-all; color: #667eea; font-size: 14px; background: #f5f5f5; padding: 10px; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Assessment Invitation</h1>
        </div>
        <div class="content">
            <p style="font-size: 16px;">${greeting}</p>
            <p>You have been invited by <strong>${params.organizerName}</strong> to participate in an assessment:</p>
            <p class="assessment-title">${params.assessmentTitle}</p>
            <p>Click the button below to accept your invitation and start the assessment:</p>
            <p style="text-align: center;">
                <a href="${params.inviteLink}" class="btn">Accept Invitation</a>
            </p>
            <div class="expiry">
                ⏳ <strong>Expires:</strong> ${expiryDate}
            </div>
            <p style="font-size: 14px; color: #666;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p class="link-fallback">${params.inviteLink}</p>
        </div>
        <div class="footer">
            <p>This is an automated message from SecureHire Assessment Platform.</p>
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
SecureHire Assessment Platform
`;

    return { html, text };
};
