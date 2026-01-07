import { AppDataSource } from "../config/db";
import { AssessmentSession } from "../entities/AssessmentSession.entity";
import { User } from "../entities/user.entity";
import { Assessment } from "../entities/Assessment.entity";
import { AssessmentInvitation, InvitationStatus } from "../entities/AssessmentInvitation.entity";
import crypto from "crypto";

const sessionRepo = () => AppDataSource.getRepository(AssessmentSession);
const invitationRepo = () => AppDataSource.getRepository(AssessmentInvitation);

/**
 * Create session after registration
 */
export const createSession = async (
    userId: string,
    assessmentId: string,
    invitationId?: string
): Promise<AssessmentSession> => {
    console.log(`\n🔐 [SESSION] Creating session...`);
    console.log(`   User: ${userId}`);
    console.log(`   Assessment: ${assessmentId}`);

    // If invitationId is missing, look it up
    let invitation: any = null;
    if (!invitationId) {
        console.log(`   Looking up invitation for user...`);
        const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId } });
        if (!user) throw { status: 404, message: "User not found" };

        invitation = await invitationRepo().findOne({
            where: {
                assessment: { id: assessmentId },
                email: user.email, // Invite matches email
            },
        });

        if (!invitation) {
            throw { status: 403, message: "No valid invitation found for this user" };
        }
        invitationId = invitation.id;
        console.log(`   Found invitation: ${invitationId}`);
    } else {
        // Load invitation if we have the ID but not the object
        invitation = await invitationRepo().findOne({ where: { id: invitationId } });
    }

    // ✅ Mark invitation as ACCEPTED if it's found and not already accepted
    if (invitation && invitation.status !== InvitationStatus.ACCEPTED) {
        console.log(`   📝 Updating invitation status to ACCEPTED...`);
        invitation.status = InvitationStatus.ACCEPTED;
        invitation.acceptedAt = new Date();
        invitation.user = { id: userId } as User; // Link user to invitation
        await invitationRepo().save(invitation);
        console.log(`   ✅ Invitation marked as ACCEPTED`);
    }

    // Generate unique session token
    const sessionToken = crypto.randomBytes(32).toString("hex");

    // Check if session already exists
    let session = await sessionRepo().findOne({
        where: {
            user: { id: userId },
            assessment: { id: assessmentId },
        },
    });

    if (session) {
        console.log(`   ✅ Session already exists: ${session.id}`);
        return session;
    }

    // Create new session
    session = sessionRepo().create({
        user: { id: userId } as User,
        assessment: { id: assessmentId } as Assessment,
        invitation: { id: invitationId } as AssessmentInvitation,
        sessionToken,
        status: "active",
    });

    await sessionRepo().save(session);
    console.log(`   ✅ Session created: ${session.id}`);

    return session;
};

/**
 * Validate session token
 */
export const validateSession = async (sessionToken: string): Promise<AssessmentSession> => {
    console.log(`\n🔍 [SESSION] Validating session token...`);

    const session = await sessionRepo().findOne({
        where: { sessionToken, status: "active" },
        relations: ["user", "assessment", "invitation"],
    });

    if (!session) {
        console.log(`   ❌ Invalid or expired session`);
        throw { status: 401, message: "Invalid or expired session" };
    }

    console.log(`   ✅ Session valid: ${session.id}`);
    return session;
};

/**
 * Record proctoring consent
 */
export const recordProctoringConsent = async (sessionToken: string): Promise<AssessmentSession> => {
    console.log(`\n✅ [SESSION] Recording proctoring consent...`);

    const session = await validateSession(sessionToken);

    session.proctoringConsent = true;
    await sessionRepo().save(session);

    console.log(`   ✅ Consent recorded`);
    return session;
};

/**
 * Record system checks
 */
export const recordSystemChecks = async (
    sessionToken: string,
    checks: {
        browser: boolean;
        camera: boolean;
        mic: boolean;
        screenShare: boolean;
    }
): Promise<AssessmentSession> => {
    console.log(`\n🖥️ [SESSION] Recording system checks...`);
    console.log(`   Checks:`, checks);

    const session = await validateSession(sessionToken);

    session.systemChecks = checks;
    await sessionRepo().save(session);

    console.log(`   ✅ System checks recorded`);
    return session;
};

/**
 * Start assessment
 */
export const startAssessment = async (sessionToken: string): Promise<AssessmentSession> => {
    console.log(`\n▶️ [SESSION] Starting assessment...`);

    const session = await validateSession(sessionToken);

    if (session.startedAt) {
        console.log(`   ⚠️ Assessment already started`);
        return session;
    }

    session.startedAt = new Date();
    await sessionRepo().save(session);

    console.log(`   ✅ Assessment started at: ${session.startedAt.toISOString()}`);
    return session;
};
