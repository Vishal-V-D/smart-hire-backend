import { AppDataSource } from "../config/db";
import { ContestInvitation } from "../entities/contestInvitation.entity";
import { Contest } from "../entities/contest.entity";
import { User } from "../entities/user.entity";
import * as crypto from "crypto";
import * as emailService from "./email.service";
import * as sessionService from "./contestSession.service";

const inviteRepo = () => AppDataSource.getRepository(ContestInvitation);
const contestRepo = () => AppDataSource.getRepository(Contest);
const userRepo = () => AppDataSource.getRepository(User);

/**
 * Generate unique invite token
 */
const generateInviteToken = (): string => {
    return crypto.randomBytes(32).toString("hex");
};

/**
 * Send invitation to user via email
 */
export const sendInvitation = async (
    contestId: string,
    email: string,
    organizerId: string
) => {
    const contest = await contestRepo().findOne({ where: { id: contestId } });
    if (!contest) {
        throw { status: 404, message: "Contest not found" };
    }

    // Check if already invited
    const existing = await inviteRepo().findOne({
        where: { contestId, email },
    });

    if (existing) {
        throw { status: 400, message: "User already invited to this contest" };
    }

    // Generate invite token
    const inviteToken = generateInviteToken();

    // Create invitation
    const invitation = inviteRepo().create({
        contestId,
        email,
        inviteToken,
        invitedBy: organizerId,
    });

    await inviteRepo().save(invitation);

    // Send email
    const inviteLink = `${process.env.FRONTEND_URL}/contest/invite/${inviteToken}`;
    await emailService.sendContestInvitation(email, contest.title, inviteLink, contest.startTime);

    console.log(`✅ Invitation sent to ${email} for contest ${contest.title}`);
    console.log(`🔗 [DEBUG] Invite Link: ${inviteLink}`);

    return invitation;
};

/**
 * Send bulk invitations
 */
export const sendBulkInvitations = async (
    contestId: string,
    emails: string[],
    organizerId: string
) => {
    const results = {
        success: [] as string[],
        failed: [] as { email: string; reason: string }[],
    };

    for (const email of emails) {
        try {
            await sendInvitation(contestId, email, organizerId);
            results.success.push(email);
        } catch (err: any) {
            results.failed.push({ email, reason: err.message });
        }
    }

    return results;
};

/**
 * Validate invite token
 */
export const validateInviteToken = async (token: string) => {
    console.log(`🔍 [Service] Validating token: ${token}`);
    const invitation = await inviteRepo().findOne({
        where: { inviteToken: token },
        relations: ["contest"],
    });

    if (!invitation) {
        console.log(`❌ [Service] Token not found: ${token}`);
        throw { status: 404, message: "Invalid invitation token" };
    }

    console.log(`✅ [Service] Found invitation for contest: ${invitation.contest?.title}`);

    // Check if contest has ended
    if (invitation.contest && invitation.contest.endTime) {
        const now = new Date();
        const endTime = new Date(invitation.contest.endTime);
        if (now > endTime) {
            console.log(`⚠️ [Service] Contest ended at ${endTime}, token expired.`);
            throw { status: 400, message: "Invitation expired: Contest has ended" };
        }
    }

    // Check if user has already completed the assessment
    if (invitation.acceptedByUserId) {
        const session = await sessionService.getLatestSession(
            invitation.contestId,
            invitation.acceptedByUserId
        );

        if (session?.status === "finished") {
            console.log(`🚫 [Service] User ${invitation.acceptedByUserId} already finished assessment`);
            throw {
                status: 403,
                message: "Assessment already completed. Access denied.",
                code: "ASSESSMENT_COMPLETED"
            };
        }
    }

    return {
        valid: true,
        contestId: invitation.contestId,
        email: invitation.email,
        isAccepted: invitation.isAccepted,
        contest: invitation.contest,
    };
};

/**
 * Accept invitation
 */
export const acceptInvitation = async (token: string, userId: string) => {
    const invitation = await inviteRepo().findOne({
        where: { inviteToken: token },
    });

    if (!invitation) {
        throw { status: 404, message: "Invalid invitation token" };
    }

    // If already accepted, just return the invitation (allow re-entry)
    if (invitation.isAccepted) {
        console.log(`ℹ️ Invitation already accepted by user ${invitation.acceptedByUserId}, allowing access`);
        return invitation;
    }

    // Update invitation
    invitation.isAccepted = true;
    invitation.acceptedAt = new Date();
    invitation.acceptedByUserId = userId;

    await inviteRepo().save(invitation);

    console.log(`✅ Invitation accepted by user ${userId}`);

    return invitation;
};

/**
 * Get all invitations for a contest with detailed status
 */
export const getInvitations = async (contestId: string) => {
    const invitations = await inviteRepo().find({
        where: { contestId },
        relations: ["acceptedByUser"],
        order: { invitedAt: "DESC" },
    });

    // Fetch registration and session data for each invitation
    const regRepo = AppDataSource.getRepository("ContestRegistration");
    const sessionRepo = AppDataSource.getRepository("ContestSession");

    const enrichedInvitations = await Promise.all(
        invitations.map(async (invitation) => {
            let status = "PENDING";
            let statusDetails = {
                isPending: !invitation.isAccepted,
                isAccepted: invitation.isAccepted,
                isRegistered: false,
                isStarted: false,
                isFinished: false,
                registeredAt: null as Date | null,
                startedAt: null as Date | null,
                finishedAt: null as Date | null,
            };

            // If accepted, check registration
            if (invitation.isAccepted && invitation.acceptedByUserId) {
                status = "ACCEPTED";

                const registration = await regRepo.findOne({
                    where: {
                        contestId,
                        userId: invitation.acceptedByUserId,
                    },
                });

                if (registration) {
                    status = "REGISTERED";
                    statusDetails.isRegistered = true;
                    statusDetails.registeredAt = registration.registeredAt;

                    // Check session status
                    const session = await sessionRepo.findOne({
                        where: {
                            contestId,
                            userId: invitation.acceptedByUserId,
                        },
                        order: { startedAt: "DESC" },
                    });

                    if (session) {
                        if (session.finishedAt) {
                            status = "FINISHED";
                            statusDetails.isFinished = true;
                            statusDetails.finishedAt = session.finishedAt;
                        } else {
                            status = "STARTED";
                            statusDetails.isStarted = true;
                        }
                        statusDetails.startedAt = session.startedAt;
                    }
                }
            }

            return {
                ...invitation,
                status,
                statusDetails,
            };
        })
    );

    console.log(`📩 [Invite] Fetched ${enrichedInvitations.length} invitations for contest ${contestId}`);
    return enrichedInvitations;
};

/**
 * Check if user is invited to contest
 */
export const checkUserInvited = async (contestId: string, email: string) => {
    return await inviteRepo().findOne({
        where: { contestId, email },
    });
};

/**
 * Revoke invitation
 */
export const revokeInvitation = async (invitationId: string) => {
    const invitation = await inviteRepo().findOne({
        where: { id: invitationId },
    });

    if (!invitation) {
        throw { status: 404, message: "Invitation not found" };
    }

    // if (invitation.isAccepted) {
    //     throw { status: 400, message: "Cannot revoke accepted invitation" };
    // }

    await inviteRepo().remove(invitation);

    console.log(`✅ Invitation ${invitationId} revoked`);

    return { message: "Invitation revoked successfully" };
};
