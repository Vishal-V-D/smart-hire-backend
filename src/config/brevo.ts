import * as SibApiV3Sdk from "@sendinblue/client";

// Brevo (Sendinblue) configuration from environment variables
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || "SmartHire";
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "noreply@smarthire.com";

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
  organizationName: string;
  organizerUsername: string;
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
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Assessment Invitation - SmartHire</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 40px 20px;">
      <tr>
        <td align="center">
          
          <!-- Main Container -->
          <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <tr>
              <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 600; color: #111827; letter-spacing: -0.5px;">SmartHire</h1>
                <p style="margin: 0; font-size: 14px; color: #6b7280;">Technical Assessment Platform</p>
              </td>
            </tr>
            
            <!-- Content -->
            <tr>
              <td style="padding: 40px;">
                
                <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #111827;">You're invited to an assessment</h2>
                
                <p style="margin: 0 0 8px; font-size: 15px; line-height: 1.6; color: #374151;">
                  ${greeting}
                </p>
                
                <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #374151;">
                  You've been invited by <strong>${params.organizationName}</strong> to participate in a technical assessment. This is your opportunity to demonstrate your skills.
                </p>
                
                <!-- Assessment Card -->
                <div style="margin: 0 0 32px; padding: 20px; background-color: #eff6ff; border-left: 3px solid #3b82f6; border-radius: 4px;">
                  <h3 style="margin: 0 0 12px; font-size: 18px; font-weight: 600; color: #1e40af;">${params.assessmentTitle}</h3>
                  <p style="margin: 0; font-size: 14px; color: #1e40af;">
                    <strong>Organizer:</strong> ${params.organizerUsername}<br/>
                    <strong>Expires:</strong> ${expiryDate}
                  </p>
                </div>
                
                <!-- Button -->
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" style="padding: 0 0 32px;">
                      <a href="${params.inviteLink}" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 500;">Accept Invitation</a>
                    </td>
                  </tr>
                </table>
                
                <!-- Preparation Tips -->
                <div style="margin: 0 0 32px; padding: 20px; background-color: #f9fafb; border-radius: 4px;">
                  <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #111827;">Before you start:</p>
                  <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #374151;">
                    <li>Ensure you have a stable internet connection</li>
                    <li>Find a quiet, distraction-free environment</li>
                    <li>Have your materials and setup ready</li>
                    <li>Review any instructions carefully</li>
                  </ul>
                </div>
                
                <!-- Divider -->
                <div style="height: 1px; background-color: #e5e7eb; margin: 32px 0;"></div>
                
                <!-- Alternative Link -->
                <p style="margin: 0 0 12px; font-size: 13px; color: #6b7280;">
                  Or copy and paste this link:
                </p>
                <p style="margin: 0; padding: 12px; background-color: #f9fafb; border-radius: 4px; font-size: 13px; color: #6366f1; word-break: break-all; font-family: 'Courier New', monospace;">
                  ${params.inviteLink}
                </p>
                
              </td>
            </tr>
            
            <!-- Footer -->
            <tr>
              <td style="padding: 32px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">
                  SmartHire · Modern Technical Assessment Platform
                </p>
                <p style="margin: 0; font-size: 13px; color: #9ca3af;">
                  <a href="${FRONTEND_URL}" style="color: #6366f1; text-decoration: none;">Dashboard</a> · 
                  <a href="${FRONTEND_URL}/support" style="color: #6366f1; text-decoration: none;">Support</a>
                </p>
                <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">
                  © ${new Date().getFullYear()} SmartHire. All rights reserved.
                </p>
              </td>
            </tr>
            
          </table>
          
        </td>
      </tr>
    </table>
    
</body>
</html>`;

  const text = `
${greeting}

You have been invited by ${params.organizationName} to participate in an assessment:

${params.assessmentTitle}
Organizer: ${params.organizerUsername}

Accept your invitation: ${params.inviteLink}

This invitation expires on: ${expiryDate}

---
SmartHire Assessment Platform
`;

  return { html, text };
};
