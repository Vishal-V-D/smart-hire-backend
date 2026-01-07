import { AppDataSource } from "../config/db";
import { AssessmentOTP } from "../entities/AssessmentOTP.entity";
import { Assessment } from "../entities/Assessment.entity";
import { AssessmentInvitation, InvitationStatus } from "../entities/AssessmentInvitation.entity";
import { sendEmail } from "../config/brevo";

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

    // Send email via Brevo
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #667eea; margin: 20px 0; border-radius: 8px; }
        .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Assessment Verification</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>Your One-Time Password (OTP) for accessing <strong>${assessment.title}</strong> is:</p>
            <div class="otp-box">${otp}</div>
            <p><strong>⏳ Valid for 10 minutes</strong></p>
            <p>Please enter this code to continue with your registration.</p>
            <p style="color: #888; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
        </div>
        <div class="footer">
            <p>SecureHire Assessment Platform</p>
        </div>
    </div>
</body>
</html>`;

    const success = await sendEmail({
        to: email,
        toName: email,
        subject: `🔐 Your OTP for ${assessment.title}`,
        html: emailHtml,
        text: `Your OTP is: ${otp}. Valid for 10 minutes.`,
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
