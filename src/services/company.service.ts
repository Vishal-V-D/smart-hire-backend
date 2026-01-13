
import { AppDataSource } from "../config/db";
import { Company, CompanyStatus } from "../entities/Company.entity";
import { User, UserRole, AdminStatus } from "../entities/user.entity";
import { hashPassword } from "../utils/password.util";
import { sendEmail, FRONTEND_URL } from "../config/brevo";
import crypto from "crypto";
import { Assessment } from "../entities/Assessment.entity";
import { AssessmentSection } from "../entities/AssessmentSection.entity";

const companyRepo = () => AppDataSource.getRepository(Company);
const userRepo = () => AppDataSource.getRepository(User);
const assessmentRepo = () => AppDataSource.getRepository(Assessment);

// Import Logger
import { logRequest, getLogsForCompany } from "./companyRequestLog.service";
import { RequestAction } from "../entities/CompanyRequestLog.entity";

/**
 * Get Team Members for a Company
 */
export const getCompanyTeam = async (companyId: string) => {
  const users = await userRepo().find({
    where: { company: { id: companyId }, role: UserRole.ADMIN },
    select: ["id", "fullName", "email", "status", "role", "createdAt"] // Be explicit about what to return
  });
  return { users };
};

/**
 * Send approval email with password setup link
 */
const sendCompanyApprovalEmail = async (
  email: string,
  name: string,
  companyName: string,
  setupToken: string
) => {
  const setupLink = `${FRONTEND_URL}/setup-password?token=${setupToken}`;

  const html_body = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Company Approved - SmartHire</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 600; color: #111827; letter-spacing: -0.5px;">SmartHire</h1>
              <p style="margin: 0; font-size: 14px; color: #6b7280;">Technical Assessment Platform</p>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px;">
              
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #111827;">Congratulations! Your company has been approved</h2>
              
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #374151;">
                Hi ${name},
              </p>
              
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #374151;">
                Great news! Your company <strong>${companyName}</strong> has been approved to use SmartHire. You can now set up your account and start creating assessments.
              </p>
              
              <div style="margin: 0 0 32px; padding: 20px; background-color: #ecfdf5; border-left: 3px solid #10b981; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #065f46;">
                  <strong>Next Step:</strong> Set your password to access your dashboard
                </p>
              </div>
              
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 0 0 32px;">
                    <a href="${setupLink}" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 500;">Set Up Your Password</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 16px; font-size: 14px; color: #6b7280;">
                This link will expire in <strong style="color: #111827;">24 hours</strong>.
              </p>
              
              <div style="height: 1px; background-color: #e5e7eb; margin: 32px 0;"></div>
              
              <p style="margin: 0 0 12px; font-size: 13px; color: #6b7280;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 0; padding: 12px; background-color: #f9fafb; border-radius: 4px; font-size: 13px; color: #6366f1; word-break: break-all; font-family: 'Courier New', monospace;">
                ${setupLink}
              </p>
              
            </td>
          </tr>
          
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

  await sendEmail({
    to: email,
    subject: `Account Approval and Password Setup - ${companyName}`,
    html: html_body,
    text: `Your company ${companyName} has been approved! Set your password here: ${setupLink} (Expires in 24 hours)`,
  });
};

/**
 * Register a new company with its first admin.
 * Both Company and User are set to PENDING status.
 * NO PASSWORD required - user will set it after approval via email link.
 */
export const registerCompany = async (
  companyName: string,
  website: string | undefined,
  details: string | undefined,
  contactEmail: string,
  contactPhone: string,
  adminName: string,
  adminEmail: string
) => {
  console.log(`[COMPANY REGISTRATION] Name: ${companyName}, Admin: ${adminEmail}`);

  // 1. Check if company or user already exists
  const existingCompany = await companyRepo().findOne({ where: { name: companyName } });
  if (existingCompany) throw { status: 400, message: "Company name already exists" };

  const existingUser = await userRepo().findOne({ where: { email: adminEmail } });
  if (existingUser) throw { status: 400, message: "Email already registered" };

  // 2. Create Company (PENDING)
  const newCompany = companyRepo().create({
    name: companyName,
    website,
    description: details,
    contactEmail,
    contactPhone,
    status: CompanyStatus.PENDING,
  });
  const savedCompany = await companyRepo().save(newCompany);

  // 3. Create Admin User (PENDING) WITHOUT password
  // Generate a magic token for password setup after approval
  const setupToken = crypto.randomBytes(32).toString("hex");
  const setupTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const newAdmin = userRepo().create({
    email: adminEmail,
    fullName: adminName,
    username: adminName.replace(/\s+/g, "").toLowerCase() + crypto.randomBytes(3).toString("hex"),
    // password will be set later via setupPassword
    role: UserRole.ADMIN,
    company: savedCompany,
    status: AdminStatus.PENDING,
    isVerified: false, // Will be verified when they set password
    magicLoginToken: setupToken, // Reusing magic login token for setup
    magicLoginTokenExpiry: setupTokenExpiry,
  });

  await userRepo().save(newAdmin);

  // 🔔 Notify Organizer
  try {
    // ... Notification logic ...
    const { createNotification } = require("./notification.service");
    const { NotificationType } = require("../entities/Notification.entity");

    await createNotification({
      type: NotificationType.NEW_COMPANY_REQUEST,
      title: "New Company Registration",
      message: `${companyName} has registered and is awaiting approval`,
      data: {
        companyId: savedCompany.id,
        companyName: savedCompany.name,
        adminEmail: adminEmail,
        adminName: adminName,
        website: website,
        contactEmail: contactEmail
      },
      isGlobalOrganizer: true
    });
  } catch (err) { console.error("Notif Error", err); }

  // 📜 Log History
  await logRequest(RequestAction.REGISTER_COMPANY, savedCompany.id, savedCompany.id, undefined, { name: companyName, adminEmail });

  return {
    message: "Company registration successful. Pending Organizer approval.",
    company: savedCompany,
  };
};

/**
 * Request to add a new admin to an existing company.
 * User is created as PENDING. Needs Organizer approval.
 */
export const requestNewAdmin = async (
  companyId: string,
  requesterId: string, // The current admin making the request
  newAdminName: string,
  newAdminEmail: string,
  newAdminPassword: string
) => {
  // 1. Validate Requester
  const requester = await userRepo().findOne({ where: { id: requesterId }, relations: ["company"] });
  if (!requester || requester.company.id !== companyId) {
    throw { status: 403, message: "Unauthorized action" };
  }
  if (requester.company.status !== CompanyStatus.APPROVED) {
    throw { status: 403, message: "Company is not active" };
  }

  // 2. Check if user exists
  const existingUser = await userRepo().findOne({ where: { email: newAdminEmail } });
  if (existingUser) throw { status: 400, message: "User already exists" };

  // 3. Create New Admin (PENDING)
  const hashedPassword = await hashPassword(newAdminPassword);

  const newAdmin = userRepo().create({
    email: newAdminEmail,
    fullName: newAdminName,
    username: newAdminName.replace(/\s+/g, "").toLowerCase() + crypto.randomBytes(3).toString("hex"),
    password: hashedPassword,
    role: UserRole.ADMIN,
    company: requester.company,
    status: AdminStatus.PENDING, // MUST be approved by Organizer
    isVerified: true,
  });

  await userRepo().save(newAdmin);

  // 🔔 Notify Organizer (Saved to DB + Real-time)
  try {
    const { createNotification } = require("./notification.service");
    const { NotificationType } = require("../entities/Notification.entity");

    await createNotification({
      type: NotificationType.NEW_ADMIN_REQUEST,
      title: "New Admin Request",
      message: `${requester.company.name} wants to add a new admin: ${newAdminName}`,
      data: {
        companyId: requester.company.id,
        companyName: requester.company.name,
        newAdminId: newAdmin.id,
        newAdminEmail: newAdminEmail,
        newAdminName: newAdminName,
        requestedBy: requester.fullName || requester.email
      },
      isGlobalOrganizer: true // Target all organizers
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }

  // 📜 Log History
  await logRequest(RequestAction.REQUEST_ADMIN, requesterId, companyId, newAdmin.id, { newAdminName, newAdminEmail });

  return { message: "Admin added. Pending Organizer approval." };
};

/**
 * ORGANIZER ONLY: Approve a Company
 * This approves the Company entity and sends setup email to admins.
 */
export const approveCompany = async (organizerId: string, companyId: string) => {
  const company = await companyRepo().findOne({ where: { id: companyId }, relations: ["users"] });
  if (!company) throw { status: 404, message: "Company not found" };

  const organizer = await userRepo().findOne({ where: { id: organizerId } });
  if (!organizer || organizer.role !== UserRole.ORGANIZER) {
    throw { status: 403, message: "Only Organizers can approve companies" };
  }

  // 1. Approve Company
  company.status = CompanyStatus.APPROVED;
  company.approvedBy = organizer;
  await companyRepo().save(company);

  // 2. Get all pending users for this company
  const pendingUsers = await userRepo()
    .createQueryBuilder("user")
    .where("user.companyId = :companyId", { companyId })
    .andWhere("user.status = :status", { status: AdminStatus.PENDING })
    .addSelect("user.magicLoginToken") // Explicitly fetch hidden column
    .getMany();

  // 3. Send setup email to each pending user
  for (const user of pendingUsers) {
    try {
      await sendCompanyApprovalEmail(user.email, user.fullName, company.name, user.magicLoginToken);
      console.log(`   Sent setup email to ${user.email}`);
    } catch (error) {
      console.error(`   Failed to send email to ${user.email}:`, error);
      // Continue with other users even if one fails
    }
  }

  // 4. Mark users as ACTIVE (they still need to set password to login)
  await userRepo().update(
    { company: { id: companyId }, status: AdminStatus.PENDING },
    { status: AdminStatus.ACTIVE }
  );

  // 🔔 Notify Company Admins (Saved to DB + Real-time)
  try {
    const { createNotification } = require("./notification.service");
    const { NotificationType } = require("../entities/Notification.entity");

    await createNotification({
      type: NotificationType.COMPANY_APPROVED,
      title: "Company Approved!",
      message: `Your company ${company.name} has been approved. Check your email to set up your password.`,
      data: {
        companyId: company.id,
        companyName: company.name,
        approvedBy: organizer.fullName || organizer.email,
        emailsSent: pendingUsers.length
      },
      companyId: companyId // Target all admins in this company
    });
  } catch (error) {
    console.error("Failed to create company notification:", error);
  }

  // 📜 Log History
  await logRequest(RequestAction.APPROVE_COMPANY, organizerId, companyId, undefined, { approvedBy: organizer.email });

  return {
    message: "Company approved and setup emails sent.",
    emailsSent: pendingUsers.length
  };
};

/**
 * ORGANIZER ONLY: Approve a specific User (Admin)
 */
export const approveUser = async (organizerId: string, userId: string) => {
  const organizer = await userRepo().findOne({ where: { id: organizerId } });
  if (!organizer || organizer.role !== UserRole.ORGANIZER) {
    throw { status: 403, message: "Only Organizers can approve users" };
  }

  const user = await userRepo().findOne({ where: { id: userId }, relations: ["company"] });
  if (!user) throw { status: 404, message: "User not found" };

  if (user.company.status !== CompanyStatus.APPROVED) {
    throw { status: 400, message: "Cannot approve user. Company is not approved yet." };
  }

  user.status = AdminStatus.ACTIVE;
  await userRepo().save(user);

  // 🔔 Notify Company Admins (Saved to DB + Real-time)
  try {
    const { createNotification } = require("./notification.service");
    const { NotificationType } = require("../entities/Notification.entity");

    await createNotification({
      type: NotificationType.ADMIN_APPROVED,
      title: "New Admin Approved",
      message: `${user.fullName || user.email} has been approved as an admin for ${user.company.name}`,
      data: {
        companyId: user.company.id,
        companyName: user.company.name,
        adminId: user.id,
        adminEmail: user.email,
        adminName: user.fullName,
        approvedBy: organizer.fullName || organizer.email
      },
      companyId: user.company.id // Target all admins in this company
    });
  } catch (error) {
    console.error("Failed to create company notification:", error);
  }

  // 📜 Log History
  await logRequest(RequestAction.APPROVE_ADMIN, organizerId, user.company.id, userId, { approvedBy: organizer.email });

  return { message: "User approved successfully." };
};

/**
 * ORGANIZER ONLY: Get all pending requests (Companies & Users)
 */
export const getPendingRequests = async () => {
  const pendingCompanies = await companyRepo().find({
    where: { status: CompanyStatus.PENDING },
    relations: ["users"], // See who applied
  });

  const pendingUsers = await userRepo().find({
    where: { status: AdminStatus.PENDING, role: UserRole.ADMIN },
    relations: ["company"],
  });

  return {
    companies: pendingCompanies,
    users: pendingUsers,
  };
};

/**
 * ORGANIZER ONLY: Assign an Assessment to a Company.
 * This effectively "CLONES" the assessment for that company.
 */
/**
 * ORGANIZER ONLY: Assign an Assessment to a Company.
 * Creates a DIRECT LINK - Both Organizer and Company work on the SAME assessment.
 * NO CLONING.
 */
export const assignAssessmentToCompany = async (
  organizerId: string,
  assessmentId: string,
  companyId: string
) => {
  // 1. Verify Organizer
  const organizer = await userRepo().findOne({ where: { id: organizerId } });
  if (!organizer || organizer.role !== UserRole.ORGANIZER) {
    throw { status: 403, message: "Only Organizers can assign assessments" };
  }

  // 2. Verify Company
  const company = await companyRepo().findOne({ where: { id: companyId } });
  if (!company || company.status !== CompanyStatus.APPROVED) {
    throw { status: 400, message: "Company must be valid and approved" };
  }

  // 3. Get Assessment
  const assessment = await assessmentRepo().findOne({ where: { id: assessmentId } });
  if (!assessment) throw { status: 404, message: "Assessment not found" };

  // 4. Assign Company (Link it)
  // This gives the company access to this specific assessment record
  assessment.company = company;
  assessment.companyId = company.id;
  assessment.organizer = organizer; // Ensure organizer retains ownership tracked

  // Optional: Update status to ACTIVE if it was DRAFT
  // assessment.status = AssessmentStatus.ACTIVE;

  const savedAssessment = await assessmentRepo().save(assessment);

  // 🔔 Notify Company Admins
  try {
    const { createNotification } = require("./notification.service");
    const { NotificationType } = require("../entities/Notification.entity");

    await createNotification({
      type: NotificationType.ASSESSMENT_ASSIGNED,
      title: "New Assessment Assigned",
      message: `The assessment "${assessment.title}" has been assigned to your company by ${organizer.fullName || organizer.email}.`,
      data: {
        assessmentId: assessment.id,
        assessmentTitle: assessment.title,
        assignedBy: organizer.fullName || organizer.email
      },
      companyId: company.id
    });
  } catch (error) {
    console.error("Failed to send notification:", error);
  }

  return {
    message: "Assessment assigned successfully (Direct Link)",
    assessmentId: savedAssessment.id,
    assignedTo: company.name,
    isShared: true
  };
};

/**
 * Get Company By ID
 */
export const getCompanyById = async (companyId: string) => {
  const company = await companyRepo().findOne({
    where: { id: companyId },
    relations: ["users"]
  });
  if (!company) throw { status: 404, message: "Company not found" };
  return company;
};

/**
 * Setup password for approved company admin using magic token
 */
export const setupPassword = async (token: string, password: string) => {
  // Find user by magic login token
  const user = await userRepo().findOne({
    where: { magicLoginToken: token },
    relations: ["company"]
  });

  if (!user) {
    throw { status: 404, message: "Invalid or expired setup link" };
  }

  // Check if token is expired
  if (!user.magicLoginTokenExpiry || user.magicLoginTokenExpiry < new Date()) {
    throw { status: 400, message: "Setup link has expired. Please contact support." };
  }

  // Check if user is ACTIVE (approved)
  if (user.status !== AdminStatus.ACTIVE) {
    throw { status: 403, message: "Your account is not yet approved" };
  }

  // Hash and set password
  const hashedPassword = await hashPassword(password);
  user.password = hashedPassword;
  user.isVerified = true;

  await userRepo().save(user);

  return {
    message: "Password set successfully. You can now login.",
    email: user.email,
    companyName: user.company?.name
  };
};

/**
 * ORGANIZER ONLY: Get ALL Companies with detailed info and admin list
 */
/**
 * ORGANIZER ONLY: Get ALL Companies with detailed info and admin list
 */
export const getAllCompanies = async () => {
  const companies = await companyRepo().find({
    order: { createdAt: "DESC" },
    relations: ["users"] // Includes full user objects for admins
  });

  // Return full company object including:
  // - name, website, description (details), contactEmail, contactPhone
  // - users array (Admins)
  return companies;
};

/**
 * ORGANIZER ONLY: Complete Deletion of Company
 * Deletes company record and all associated users via CASCADE
 */
export const deleteCompany = async (companyId: string) => {
  try {
    const company = await companyRepo().findOne({ where: { id: companyId } });
    if (!company) {
      throw { status: 404, message: "Company not found" };
    }

    // Capture name for response
    const companyName = company.name;

    console.log(`[DEBUG] Attempting to delete company: ${companyName} (${companyId})`);

    // Delete company (Cascade will delete users)
    await companyRepo().delete(companyId);

    console.log(`[DEBUG] Successfully deleted company: ${companyName}`);

    return {
      message: `Company '${companyName}' and all associated admins have been deleted successfully.`
    };
  } catch (error: any) {
    console.error(`[DEBUG] Failed to delete company ${companyId}:`, error);
    // Throw detailed error
    throw {
      status: 500,
      message: `Failed to delete company: ${error.message || error.detail || 'Foreign Key Constraint Violation'}`
    };
  }
};

/**
 * ORGANIZER ONLY: Update Company Permissions
 */
export const updateCompanyPermissions = async (
  organizerId: string,
  companyId: string,
  permissions: { createAssessment?: boolean; deleteAssessment?: boolean; viewAllAssessments?: boolean }
) => {
  // 1. Verify Organizer
  const organizer = await userRepo().findOne({ where: { id: organizerId } });
  if (!organizer || organizer.role !== UserRole.ORGANIZER) {
    throw { status: 403, message: "Only Organizers can update permissions" };
  }

  // 2. Find Company
  const company = await companyRepo().findOne({ where: { id: companyId } });
  if (!company) {
    throw { status: 404, message: "Company not found" };
  }

  // 3. Update Permissions (Merge with existing)
  company.permissions = {
    ...company.permissions,
    ...permissions
  };

  // 4. PERSIST TO DB (CRITICAL FIX)
  await companyRepo().save(company);

  // 🔔 Notify Company Admins
  try {
    const { createNotification } = require("./notification.service");
    const { NotificationType } = require("../entities/Notification.entity");

    await createNotification({
      type: NotificationType.INFO,
      title: "Permissions Updated",
      message: `Your company permissions have been updated by the system organizer.`,
      data: {
        permissions: company.permissions,
        updatedBy: organizer.fullName || organizer.email
      },
      companyId: companyId
    });
  } catch (error) {
    console.error("Failed to send permission update notification:", error);
  }

  // 📜 Log History
  await logRequest(RequestAction.UPDATE_PERMISSIONS, organizerId, companyId, undefined, { permissions, updatedBy: organizer.email });

  return {
    message: "Company permissions updated successfully",
    permissions: company.permissions
  };
};

/**
 * Send Rejection Email
 */
const sendRejectionEmail = async (email: string, subject: string, message: string) => {
  // Simple template
  const html = `
      <p>Hello,</p>
      <p>Regarding your request on SmartHire:</p>
      <blockquote style="background: #f9f9f9; padding: 10px; border-left: 3px solid red;">${message}</blockquote>
      <p>If you believe this is an error, please contact support.</p>
    `;
  await sendEmail({ to: email, subject, html, text: message });
};

/**
 * ORGANIZER ONLY: Reject Company
 */
export const rejectCompany = async (organizerId: string, companyId: string, reason: string) => {
  const company = await companyRepo().findOne({ where: { id: companyId }, relations: ['users'] });
  if (!company) throw { status: 404, message: "Company not found" };

  if (company.status === CompanyStatus.APPROVED) {
    throw { status: 400, message: "Cannot reject an already approved company. Use delete instead." };
  }

  // Notify admins before deleting
  const admins = company.users || [];
  for (const admin of admins) {
    await sendRejectionEmail(admin.email, "SmartHire - Company Registration Rejected", `Your company registration for '${company.name}' was rejected. Reason: ${reason}`);
  }

  // Log before delete (Store just the ID/Name in details since entity is gone)
  await logRequest(RequestAction.REJECT_COMPANY, organizerId, companyId, undefined, {
    companyName: company.name,
    reason,
    deletedAdmins: admins.map(a => a.email)
  });

  // Delete company (cascades users)
  await companyRepo().remove(company);

  return { message: "Company rejected and removed." };
};

/**
 * ORGANIZER ONLY: Reject User
 */
export const rejectUser = async (organizerId: string, userId: string, reason: string) => {
  const user = await userRepo().findOne({ where: { id: userId }, relations: ['company'] });
  if (!user) throw { status: 404, message: "User not found" };

  if (user.status === AdminStatus.ACTIVE) {
    throw { status: 400, message: "User is already active." };
  }

  // Safely get company ID
  const companyId = user.company?.id;

  // Log rejection (independent of email success)
  await logRequest(RequestAction.REJECT_ADMIN, organizerId, companyId, userId, {
    userName: user.fullName,
    userEmail: user.email,
    reason
  });

  try {
    await sendRejectionEmail(user.email, "SmartHire - Admin Request Rejected", `Your request to join '${user.company?.name}' as an admin was rejected. Reason: ${reason}`);
  } catch (err) {
    console.error("[REJECT_USER] Failed to send email:", err);
  }

  await userRepo().remove(user);

  return { message: "User request rejected and removed." };
};

/**
 * Get History Logs for a Company
 */
export const getCompanyHistory = async (companyId: string) => {
  return await getLogsForCompany(companyId);
};
