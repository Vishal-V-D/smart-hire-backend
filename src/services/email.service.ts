import axios from 'axios';

const PYTHON_EMAIL_SERVICE_URL = process.env.PYTHON_EMAIL_SERVICE_URL || 'http://localhost:8000';

interface ContestInvitationRequest {
  recipient: string;
  contest_name: string;
  invite_link: string;
  start_time?: string;
}

export const sendVerificationEmail = async (email: string, token: string) => {
  const frontendUrl = process.env.FRONTEND_URL || "https://codevolt-secure.vercel.app";
  const verificationLink = `${frontendUrl}/verify-email?token=${token}`;

  const subject = "Verify your CodeVolt Account";
  const body = `
Hello,

Thank you for registering with CodeVolt. Please verify your email address to activate your account.

Verification Link: ${verificationLink}

If you didn't create an account, you can safely ignore this email.

Best regards,
CodeVolt Team
  `.trim();

  const html_body = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <h2 style="color: #2563eb; text-align: center;">Welcome to CodeVolt!</h2>
      <p>Thank you for registering. Please verify your email address to activate your account.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email</a>
      </div>
      <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
      <p style="font-size: 12px; color: #666; word-break: break-all;">${verificationLink}</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #999; text-align: center;">If you didn't create an account, you can safely ignore this email.</p>
    </div>
  `;

  try {
    console.log(`📨 [Email Service] Sending verification email to: ${email}`);
    const response = await axios.post(`${PYTHON_EMAIL_SERVICE_URL}/api/v1/email/send`, {
      recipient: email,
      subject,
      body,
      html_body
    });
    console.log(`✅ [Email Service] Verification email sent to ${email}`);
    return response.data;
  } catch (error: any) {
    console.error(`❌ [Email Service] Failed to send verification email:`, error.response?.data || error.message);
    throw error;
  }
};

export const sendContestInvitation = async (
  email: string,
  contestTitle: string,
  inviteLink: string,
  startTime?: Date
) => {
  const request: ContestInvitationRequest = {
    recipient: email,
    contest_name: contestTitle,
    invite_link: inviteLink,
    start_time: startTime ? startTime.toISOString() : undefined
  };

  try {
    console.log(`📨 [Email Service] Sending contest invitation to: ${email}`);
    console.log(`🏆 [Email Service] Contest: ${contestTitle}`);
    console.log(`🔗 [Email Service] Invite link: ${inviteLink}`);

    const response = await axios.post(
      `${PYTHON_EMAIL_SERVICE_URL}/api/v1/email/contest-invitation`,
      request
    );

    console.log(`✅ [Email Service] Contest invitation sent to ${email}`);
    return response.data;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.error(`❌ [Email Service] HTTP Error:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url
      });
    } else {
      console.error(`❌ [Email Service] Unknown Error:`, error);
    }
    console.error(`📧 [Email Service] Python service URL: ${PYTHON_EMAIL_SERVICE_URL}`);
    throw new Error(`Failed to send invitation email: ${error.response?.data?.detail || error.message}`);
  }
};
