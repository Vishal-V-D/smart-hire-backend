import { AppDataSource } from "../config/db";
import { AssessmentOTP } from "../entities/AssessmentOTP.entity";
import { Assessment } from "../entities/Assessment.entity";
import { AssessmentInvitation, InvitationStatus } from "../entities/AssessmentInvitation.entity";
import { sendEmail, FRONTEND_URL } from "../config/brevo";

const otpRepo = () => AppDataSource.getRepository(AssessmentOTP);
const assessmentRepo = () => AppDataSource.getRepository(Assessment);
const invitationRepo = () => AppDataSource.getRepository(AssessmentInvitation);

/**
 * Generate 6-digit OTP
 */
const generateOTP = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send OTP to email
 */
export const sendOTP = async (email: string, assessmentId: string): Promise<{ success: boolean }> => {
    console.log(`\n📧 [OTP] Sending OTP to ${email}...`);

    // Check if assessment exists
    const assessment = await assessmentRepo().findOne({ where: { id: assessmentId } });
    if (!assessment) {
        throw { status: 404, message: "Assessment not found" };
    }

    // SECURITY CHECK: Verify email has a valid invitation for this assessment
    // Check for PENDING, SENT, or ACCEPTED status
    const invitation = await invitationRepo().findOne({
        where: [
            {
                assessment: { id: assessmentId },
                email: email.toLowerCase(),
                status: InvitationStatus.PENDING
            },
            {
                assessment: { id: assessmentId },
                email: email.toLowerCase(),
                status: InvitationStatus.SENT
            },
            {
                assessment: { id: assessmentId },
                email: email.toLowerCase(),
                status: InvitationStatus.ACCEPTED
            }
        ]
    });

    if (!invitation) {
        console.log(`   ❌ Security Check Failed: No invitation found for ${email}`);
        throw { status: 403, message: "This email is not invited to this assessment." };
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log(`   Generated OTP: ${otp}`);
    console.log(`   Expires at: ${expiresAt.toISOString()}`);

    // Delete any existing unverified OTPs for this email + assessment
    await otpRepo().delete({
        email: email.toLowerCase(),
        assessment: { id: assessmentId },
        verified: false,
    });

    // Save new OTP
    const otpRecord = otpRepo().create({
        email: email.toLowerCase(),
        otp,
        assessment,
        expiresAt,
        verified: false,
    });

    await otpRepo().save(otpRecord);

    const expiryTime = new Date(Date.now() + 10 * 60 * 1000);

    // Send email via Brevo
    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Verification Code - SmartHire</title>
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
                
                <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #111827;">Your verification code</h2>
                
                <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #374151;">
                  Use the code below to verify your identity and access <strong>${assessment.title}</strong>.
                </p>
                
                <!-- OTP Box -->
                <div style="margin: 0 0 24px; padding: 32px; background-color: #f9fafb; border: 2px dashed #6366f1; border-radius: 8px; text-align: center;">
                  <p style="margin: 0 0 12px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Verification Code</p>
                  <div style="margin: 0; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #6366f1; font-family: 'Courier New', monospace;">${otp}</div>
                  <p style="margin: 16px 0 0; font-size: 13px; color: #ef4444;">
                    Expires at ${expiryTime.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })} (10 minutes)
                  </p>
                </div>
                
                <!-- Instructions -->
                <div style="margin: 0 0 32px; padding: 20px; background-color: #eff6ff; border-left: 3px solid #3b82f6; border-radius: 4px;">
                  <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #1e40af;">
                    <strong>How to use:</strong> Enter this code on the registration page to continue with your assessment access.
                  </p>
                </div>
                
                <!-- Divider -->
                <div style="height: 1px; background-color: #e5e7eb; margin: 32px 0;"></div>
                
                <!-- Security Note -->
                <p style="margin: 0; padding: 16px; background-color: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 4px; font-size: 14px; line-height: 1.5; color: #92400e;">
                  <strong>Security reminder:</strong> Never share this code with anyone. If you didn't request this code, you can safely ignore this email.
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

    const success = await sendEmail({
        to: email,
        toName: email,
        subject: `Your SmartHire Verification Code: ${otp}`,
        html: emailHtml,
        text: `Your OTP is: ${otp}. Valid for 10 minutes for ${assessment.title}.`,
    });

    if (success) {
        console.log(`   ✅ OTP sent successfully`);
    } else {
        console.log(`   ❌ Failed to send OTP email`);
    }

    return { success };
};

/**
 * Verify OTP
 */
export const verifyOTP = async (
    email: string,
    otp: string,
    assessmentId: string
): Promise<{ success: boolean; message: string }> => {
    console.log(`\n🔍 [OTP] Verifying OTP for ${email}...`);

    const otpRecord = await otpRepo().findOne({
        where: {
            email: email.toLowerCase(),
            otp,
            assessment: { id: assessmentId },
            verified: false,
        },
        relations: ["assessment"],
    });

    if (!otpRecord) {
        console.log(`   ❌ Invalid OTP`);
        throw { status: 400, message: "Invalid OTP" };
    }

    // Check expiry
    if (new Date() > otpRecord.expiresAt) {
        console.log(`   ❌ OTP expired`);
        throw { status: 400, message: "OTP has expired. Please request a new one." };
    }

    // Mark as verified
    otpRecord.verified = true;
    await otpRepo().save(otpRecord);

    console.log(`   ✅ OTP verified successfully`);

    return {
        success: true,
        message: "OTP verified successfully",
    };
};
