import axios from 'axios';
import { sendEmail, FRONTEND_URL } from "../config/brevo";

interface ContestInvitationRequest {
  recipient: string;
  contest_name: string;
  invite_link: string;
  start_time?: string;
}

export const sendVerificationEmail = async (email: string, token: string) => {
  const verificationLink = `${FRONTEND_URL}/verify-email?token=${token}`;

  const html_body = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - SmartHire</title>
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
              
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #111827;">Verify your email address</h2>
              
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #374151;">
                Thanks for signing up! To complete your registration and start using SmartHire, please verify your email address by clicking the button below.
              </p>
              
              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 20px 0 32px;">
                    <a href="${verificationLink}" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 500;">Verify Email Address</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 16px; font-size: 14px; color: #6b7280;">
                This link will expire in <strong style="color: #111827;">1 hour</strong>.
              </p>
              
              <!-- Divider -->
              <div style="height: 1px; background-color: #e5e7eb; margin: 32px 0;"></div>
              
              <!-- Alternative Link -->
              <p style="margin: 0 0 12px; font-size: 13px; color: #6b7280;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 32px; padding: 12px; background-color: #f9fafb; border-radius: 4px; font-size: 13px; color: #6366f1; word-break: break-all; font-family: 'Courier New', monospace;">
                ${verificationLink}
              </p>
              
              <!-- Security Note -->
              <p style="margin: 0; padding: 16px; background-color: #fef3c7; border-left: 3px solid: #f59e0b; border-radius: 4px; font-size: 14px; line-height: 1.5; color: #92400e;">
                <strong>Security reminder:</strong> We'll never ask for your password via email. If you didn't create this account, you can safely ignore this email.
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
                <a href="${FRONTEND_URL}" style="color: #6366f1; text-decoration: none;">Visit Dashboard</a> · 
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
</html>
  `;

  try {
    console.log(`📨 [Email Service] Sending verification email to: ${email}`);

    const success = await sendEmail({
      to: email,
      subject: "Verify your SmartHire Account - Action Required",
      html: html_body,
      text: `Welcome to SmartHire! Please verify your email: ${verificationLink} (Expires in 1 hour)`,
    });

    if (success) {
      console.log(`✅ [Email Service] Verification email sent to ${email}`);
      return { success: true };
    } else {
      throw new Error("Brevo returned false");
    }

  } catch (error: any) {
    console.error(`❌ [Email Service] Failed to send verification email:`, error.message);
    throw error;
  }
};

export const sendContestInvitation = async (
  email: string,
  contestTitle: string,
  inviteLink: string,
  startTime?: Date
) => {
  try {
    console.log(`📨 [Email Service] Sending contest invitation to: ${email}`);

    const formattedStartTime = startTime ? startTime.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : null;

    const html_body = `
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
              
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #374151;">
                You've been invited to participate in a technical assessment. This is your opportunity to demonstrate your skills.
              </p>
              
              <!-- Assessment Card -->
              <div style="margin: 0 0 32px; padding: 20px; background-color: #eff6ff; border-left: 3px solid #3b82f6; border-radius: 4px;">
                <h3 style="margin: 0 0 12px; font-size: 18px; font-weight: 600; color: #1e40af;">${contestTitle}</h3>
                ${startTime ? `
                <p style="margin: 0; font-size: 14px; color: #1e40af;">
                  <strong>Scheduled:</strong> ${formattedStartTime}
                </p>
                ` : ''}
              </div>
              
              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 0 0 32px;">
                    <a href="${inviteLink}" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 500;">Accept Invitation</a>
                  </td>
                </tr>
              </table>
              
              <!-- Preparation Tips -->
              <div style="margin: 0 0 32px; padding: 20px; background-color: #f9fafb; border-radius: 4px;">
                <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #111827;">Before you start:</p>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: #374151;">
                  <li>Ensure you have a stable internet connection</li>
                  <li>Find a quiet environment</li>
                  <li>Have your materials ready</li>
                </ul>
              </div>
              
              <!-- Divider -->
              <div style="height: 1px; background-color: #e5e7eb; margin: 32px 0;"></div>
              
              <!-- Alternative Link -->
              <p style="margin: 0 0 12px; font-size: 13px; color: #6b7280;">
                Or copy and paste this link:
              </p>
              <p style="margin: 0; padding: 12px; background-color: #f9fafb; border-radius: 4px; font-size: 13px; color: #6366f1; word-break: break-all; font-family: 'Courier New', monospace;">
                ${inviteLink}
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
</html>
    `;

    const success = await sendEmail({
      to: email,
      subject: `Assessment Invitation: ${contestTitle}`,
      html: html_body,
      text: `You have been invited to ${contestTitle}. Join here: ${inviteLink}`,
    });

    if (success) {
      console.log(`✅ [Email Service] Contest invitation sent to ${email}`);
      return { success: true };
    } else {
      throw new Error("Brevo returned false");
    }

  } catch (error: any) {
    console.error(`❌ [Email Service] Failed to send invitation email:`, error.message);
    throw new Error(`Failed to send invitation email: ${error.message}`);
  }
};
