import { AppDataSource } from "../config/db";
import { AssessmentInvitation, InvitationStatus } from "../entities/AssessmentInvitation.entity";
import { Assessment, AssessmentStatus } from "../entities/Assessment.entity";
import { User } from "../entities/user.entity";
// Using Brevo (Sendinblue) for email delivery
import { sendEmail, generateInvitationEmail, FRONTEND_URL } from "../config/brevo";
import crypto from "crypto";

const repo = () => AppDataSource.getRepository(AssessmentInvitation);
const assessmentRepo = () => AppDataSource.getRepository(Assessment);
const userRepo = () => AppDataSource.getRepository(User);

// Generate unique token
const generateToken = (): string => {
    return crypto.randomBytes(32).toString("hex");
};

// Default expiry: 7 days from now
const getDefaultExpiry = (): Date => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date;
};

/**
 * Check if assessment has ended and update status to COMPLETED
 * This is called on-the-fly when accessing assessment data
 */
export const checkAndUpdateAssessmentStatus = async (assessment: Assessment): Promise<Assessment> => {
    // If assessment has an end date and it's in PUBLISHED or ACTIVE status
    if (
        assessment.endDate &&
        new Date() > new Date(assessment.endDate) &&
        (assessment.status === AssessmentStatus.PUBLISHED || assessment.status === AssessmentStatus.ACTIVE)
    ) {
        assessment.status = AssessmentStatus.COMPLETED;
        await assessmentRepo().save(assessment);
        console.log(`⏰ [ASSESSMENT] Assessment ${assessment.id} auto-marked as COMPLETED (end time passed)`);
    }
    return assessment;
};

/**
 * Create a single invitation
 */
export interface CreateInvitationInput {
    assessmentId: string;
    email: string;
    name?: string;
    expiresAt?: Date;
    sendEmail?: boolean;
}

export const createInvitation = async (
    input: CreateInvitationInput,
    invitedBy: User
): Promise<AssessmentInvitation> => {
    console.log(`📧 [INVITATION] Creating invitation for ${input.email}...`);

    // Find assessment
    const assessment = await assessmentRepo().findOne({
        where: { id: input.assessmentId },
        relations: ["company"]
    });
    if (!assessment) {
        throw { status: 404, message: "Assessment not found" };
    }

    // Check if assessment end time has passed
    if (assessment.endDate && new Date() > new Date(assessment.endDate)) {
        throw { status: 400, message: "Cannot invite to an assessment that has already ended" };
    }

    // Check if invitation already exists
    const existing = await repo().findOne({
        where: { assessment: { id: input.assessmentId }, email: input.email.toLowerCase() },
    });
    if (existing) {
        throw { status: 400, message: "Invitation already exists for this email" };
    }

    // Create invitation
    const invitation = repo().create({
        assessment,
        email: input.email.toLowerCase().trim(),
        name: input.name?.trim(),
        token: generateToken(),
        status: InvitationStatus.PENDING,
        expiresAt: input.expiresAt || getDefaultExpiry(),
        invitedBy,
    });

    await repo().save(invitation);
    console.log(`✅ [INVITATION] Created invitation ${invitation.id}`);

    // Auto-publish assessment if it's still in DRAFT status
    if (assessment.status === AssessmentStatus.DRAFT) {
        assessment.status = AssessmentStatus.PUBLISHED;
        assessment.publishedAt = new Date();
        await assessmentRepo().save(assessment);
        console.log(`📢 [ASSESSMENT] Auto-published assessment ${assessment.id} (first invitation sent)`);
    }

    // Send email if requested (fire-and-forget - don't block response)
    if (input.sendEmail !== false) {
        // Don't await - send email in background for faster API response
        sendInvitationEmail(invitation).catch((err) => {
            console.error(`❌ [INVITATION] Background email failed for ${invitation.email}:`, err.message);
        });
    }

    return invitation;
};

/**
 * Send invitation email
 */
export const sendInvitationEmail = async (invitation: AssessmentInvitation): Promise<boolean> => {
    console.log(`📤 [INVITATION] Sending email to ${invitation.email}...`);

    const inviteLink = `${FRONTEND_URL}/invitation/${invitation.token}`;
    const { html, text } = generateInvitationEmail({
        name: invitation.name,
        assessmentTitle: invitation.assessment.title,
        organizationName: invitation.assessment?.company?.name || invitation.invitedBy?.organizationName || "SmartHire",
        organizerUsername: invitation.invitedBy?.fullName || invitation.invitedBy?.username || "Organizer",
        inviteLink,
        expiresAt: invitation.expiresAt,
    });

    const success = await sendEmail({
        to: invitation.email,
        subject: `Invitation: ${invitation.assessment.title}`,
        html,
        text,
    });

    if (success) {
        invitation.status = InvitationStatus.SENT;
        invitation.sentAt = new Date();
        await repo().save(invitation);
        console.log(`✅ [INVITATION] Email sent to ${invitation.email}`);
    }

    return success;
};

/**
 * Bulk create invitations
 */
export interface BulkInviteInput {
    assessmentId: string;
    invitations: { email: string; name?: string }[];
    expiresAt?: Date;
    sendEmail?: boolean;
}

export const bulkInvite = async (
    input: BulkInviteInput,
    invitedBy: User
): Promise<{ sent: number; failed: number; errors: string[]; invitations: AssessmentInvitation[] }> => {
    console.log(`📧 [INVITATION] Bulk inviting ${input.invitations.length} users...`);

    const results = {
        sent: 0,
        failed: 0,
        errors: [] as string[],
        invitations: [] as AssessmentInvitation[],
    };

    for (const inv of input.invitations) {
        try {
            const invitation = await createInvitation(
                {
                    assessmentId: input.assessmentId,
                    email: inv.email,
                    name: inv.name,
                    expiresAt: input.expiresAt,
                    sendEmail: input.sendEmail,
                },
                invitedBy
            );
            results.sent++;
            results.invitations.push(invitation);
        } catch (error: any) {
            results.failed++;
            results.errors.push(`${inv.email}: ${error.message}`);
        }
    }

    console.log(`✅ [INVITATION] Bulk invite complete: ${results.sent} sent, ${results.failed} failed`);
    return results;
};

/**
 * List invitations with filters
 */
export interface ListInvitationsInput {
    assessmentId?: string;
    status?: InvitationStatus;
    search?: string;
    page?: number;
    limit?: number;
}

export const listInvitations = async (input: ListInvitationsInput = {}) => {
    const { assessmentId, status, search, page = 1, limit = 50 } = input;

    console.log(`📋 [INVITATION] Listing invitations with filters:`, input);

    const queryBuilder = repo()
        .createQueryBuilder("invitation")
        .leftJoinAndSelect("invitation.assessment", "assessment")
        .leftJoinAndSelect("invitation.user", "user")
        .leftJoinAndSelect("invitation.invitedBy", "invitedBy");

    if (assessmentId) {
        queryBuilder.andWhere("assessment.id = :assessmentId", { assessmentId });
    }

    if (status) {
        queryBuilder.andWhere("invitation.status = :status", { status });
    }

    if (search) {
        queryBuilder.andWhere(
            "(invitation.email ILIKE :search OR invitation.name ILIKE :search)",
            { search: `%${search}%` }
        );
    }

    queryBuilder
        .orderBy("invitation.createdAt", "DESC")
        .skip((page - 1) * limit)
        .take(limit);

    const [invitations, total] = await queryBuilder.getManyAndCount();

    console.log(`✅ [INVITATION] Found ${invitations.length} of ${total} total`);

    return {
        invitations,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

/**
 * Get invitation by ID
 */
export const getInvitationById = async (id: string): Promise<AssessmentInvitation> => {
    const invitation = await repo().findOne({
        where: { id },
        relations: ["assessment", "assessment.company", "user", "invitedBy"],
    });

    if (!invitation) {
        throw { status: 404, message: "Invitation not found" };
    }

    return invitation;
};

/**
 * Update invitation
 */
export const updateInvitation = async (
    id: string,
    data: { name?: string; expiresAt?: Date }
): Promise<AssessmentInvitation> => {
    const invitation = await getInvitationById(id);

    if (invitation.status === InvitationStatus.ACCEPTED) {
        throw { status: 400, message: "Cannot update an accepted invitation" };
    }

    if (data.name !== undefined) {
        invitation.name = data.name;
    }
    if (data.expiresAt !== undefined) {
        invitation.expiresAt = data.expiresAt;
    }

    await repo().save(invitation);
    console.log(`✅ [INVITATION] Updated invitation ${id}`);

    return invitation;
};

/**
 * Cancel invitation
 */
export const cancelInvitation = async (id: string): Promise<AssessmentInvitation> => {
    const invitation = await getInvitationById(id);

    if (invitation.status === InvitationStatus.ACCEPTED) {
        throw { status: 400, message: "Cannot cancel an accepted invitation" };
    }

    invitation.status = InvitationStatus.CANCELLED;
    await repo().save(invitation);

    console.log(`✅ [INVITATION] Cancelled invitation ${id}`);
    return invitation;
};

/**
 * Hard delete invitation
 */
export const deleteInvitation = async (id: string): Promise<void> => {
    const invitation = await getInvitationById(id);

    if (invitation.status === InvitationStatus.ACCEPTED) {
        throw { status: 400, message: "Cannot delete an accepted invitation" };
    }

    await repo().remove(invitation);
    console.log(`🗑️ [INVITATION] Deleted invitation ${id}`);
};

/**
 * Bulk cancel invitations
 */
export const bulkCancel = async (ids: string[]): Promise<{ cancelled: number }> => {
    console.log(`🗑️ [INVITATION] Cancelling ${ids.length} invitations...`);

    const result = await repo()
        .createQueryBuilder()
        .update(AssessmentInvitation)
        .set({ status: InvitationStatus.CANCELLED })
        .where("id IN (:...ids)", { ids })
        .andWhere("status != :accepted", { accepted: InvitationStatus.ACCEPTED })
        .execute();

    console.log(`✅ [INVITATION] Cancelled ${result.affected} invitations`);
    return { cancelled: result.affected || 0 };
};

/**
 * Resend invitation email
 */
export const resendInvitation = async (id: string): Promise<boolean> => {
    const invitation = await getInvitationById(id);

    if (invitation.status === InvitationStatus.ACCEPTED) {
        throw { status: 400, message: "Cannot resend to an accepted invitation" };
    }

    if (invitation.status === InvitationStatus.CANCELLED) {
        throw { status: 400, message: "Cannot resend a cancelled invitation" };
    }

    // Regenerate token and extend expiry
    invitation.token = generateToken();
    invitation.expiresAt = getDefaultExpiry();
    await repo().save(invitation);

    return await sendInvitationEmail(invitation);
};

/**
 * Verify invitation token (for contestants)
 */
export const verifyInvitation = async (token: string) => {
    console.log(`🔍 [INVITATION] Verifying token...`);

    const invitation = await repo().findOne({
        where: { token },
        relations: ["assessment", "user"],
    });

    if (!invitation) {
        throw { status: 404, message: "Invalid invitation token" };
    }

    if (invitation.status === InvitationStatus.CANCELLED) {
        throw { status: 400, message: "This invitation has been cancelled" };
    }

    if (invitation.status === InvitationStatus.ACCEPTED) {
        return { valid: true, alreadyAccepted: true, invitation };
    }

    if (new Date() > invitation.expiresAt) {
        invitation.status = InvitationStatus.EXPIRED;
        await repo().save(invitation);
        throw { status: 400, message: "This invitation has expired" };
    }

    console.log(`✅ [INVITATION] Token verified for ${invitation.email}`);
    return { valid: true, alreadyAccepted: false, invitation };
};

/**
 * Accept invitation (link user to invitation)
 */
export const acceptInvitation = async (token: string, userId: string) => {
    console.log(`✅ [INVITATION] Accepting invitation...`);

    const { invitation, alreadyAccepted } = await verifyInvitation(token);

    if (alreadyAccepted) {
        return { success: true, message: "Already accepted", invitation };
    }

    const user = await userRepo().findOne({ where: { id: userId } });
    if (!user) {
        throw { status: 404, message: "User not found" };
    }

    invitation.status = InvitationStatus.ACCEPTED;
    invitation.acceptedAt = new Date();
    invitation.user = user;
    await repo().save(invitation);

    console.log(`✅ [INVITATION] Accepted by user ${userId}`);
    return { success: true, message: "Invitation accepted", invitation };
};

/**
 * List participants (only registered users who accepted invitations)
 */
export interface ListParticipantsInput {
    assessmentId: string;
    search?: string;
    page?: number;
    limit?: number;
}

export const listParticipants = async (input: ListParticipantsInput, organizerId: string) => {
    console.log(`👥 [PARTICIPANTS] Listing registered participants for assessment ${input.assessmentId}...`);

    const { assessmentId, search, page = 1, limit = 50 } = input;

    // Verify organizer owns this assessment
    const assessment = await assessmentRepo().findOne({
        where: { id: assessmentId, organizer: { id: organizerId } },
    });

    if (!assessment) {
        const error: any = new Error("Assessment not found or access denied");
        error.status = 404;
        throw error;
    }

    const qb = repo()
        .createQueryBuilder("invitation")
        .innerJoinAndSelect("invitation.user", "user")  // INNER JOIN - only with linked user
        .leftJoinAndSelect("invitation.assessment", "assessment")
        .where("invitation.assessmentId = :assessmentId", { assessmentId })
        .andWhere("invitation.status = :status", { status: InvitationStatus.ACCEPTED })
        .andWhere("invitation.userId IS NOT NULL");  // Must have registered user

    // Search by name or email
    if (search) {
        qb.andWhere(
            "(invitation.name ILIKE :search OR invitation.email ILIKE :search OR user.username ILIKE :search OR user.email ILIKE :search)",
            { search: `%${search}%` }
        );
    }

    qb.orderBy("invitation.acceptedAt", "DESC");

    const total = await qb.getCount();
    const participants = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getMany();

    // Format response with participant details
    const formattedParticipants = participants.map((inv) => {
        const user = inv.user!;
        return {
            id: inv.id,
            invitationEmail: inv.email,
            invitationName: inv.name,
            acceptedAt: inv.acceptedAt,
            createdAt: inv.createdAt,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                fullName: user.fullName,
                createdAt: user.createdAt,
            },
        };
    });

    console.log(`✅ [PARTICIPANTS] Found ${participants.length} registered of ${total} total`);

    return {
        participants: formattedParticipants,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

/**
 * Check if user has valid invitation for assessment
 */
export const hasValidInvitation = async (assessmentId: string, userId: string): Promise<boolean> => {
    const user = await userRepo().findOne({ where: { id: userId } });
    if (!user) return false;

    const invitation = await repo().findOne({
        where: {
            assessment: { id: assessmentId },
            user: { id: userId },
            status: InvitationStatus.ACCEPTED,
        },
    });

    return !!invitation;
};

/**
 * Get invitation stats for an assessment
 */
export const getInvitationStats = async (assessmentId: string) => {
    const stats = await repo()
        .createQueryBuilder("invitation")
        .select("invitation.status", "status")
        .addSelect("COUNT(*)", "count")
        .where("invitation.assessmentId = :assessmentId", { assessmentId })
        .groupBy("invitation.status")
        .getRawMany();

    const result: Record<string, number> = {
        pending: 0,
        sent: 0,
        accepted: 0,
        expired: 0,
        cancelled: 0,
        total: 0,
    };

    stats.forEach((s) => {
        result[s.status] = parseInt(s.count);
        result.total += parseInt(s.count);
    });

    return result;
};
