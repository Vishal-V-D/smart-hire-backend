import { AppDataSource } from "../config/db";
import { ContestRegistration } from "../entities/contestRegistration.entity";
import { ContestViolation } from "../entities/contestViolation.entity";
import { ContestSubmission } from "../entities/contestSubmission.entity";
import { ContestInvitation } from "../entities/contestInvitation.entity";
import { Contest } from "../entities/contest.entity";
import { ContestSession } from "../entities/contestSession.entity";
import { ContestReport } from "../entities/contestReport.entity";
import { SecureContestResult } from "../entities/SecureContestResult.entity";

const regRepo = () => AppDataSource.getRepository(ContestRegistration);
const violationRepo = () => AppDataSource.getRepository(ContestViolation);
const submissionRepo = () => AppDataSource.getRepository(ContestSubmission);
const inviteRepo = () => AppDataSource.getRepository(ContestInvitation);
const contestRepo = () => AppDataSource.getRepository(Contest);
const sessionRepo = () => AppDataSource.getRepository(ContestSession);
const reportRepo = () => AppDataSource.getRepository(ContestReport);
const secureResultRepo = () => AppDataSource.getRepository(SecureContestResult);

/**
 * Get live participants with status
 */
export const getLiveParticipants = async (contestId: string) => {
    const registrations = await regRepo().find({
        where: { contestId },
        relations: ["user"],
        order: { registeredAt: "DESC" }
    });

    // In a real app with Redis, we'd check online status here.
    // For now, we'll return all registered users.
    return registrations.map(reg => ({
        userId: reg.userId,
        name: reg.name,
        email: reg.email,
        photoUrl: reg.photoUrl,
        status: "offline", // Default
        lastActive: reg.registeredAt
    }));
};

/**
 * Get real-time violation feed
 */
export const getViolationFeed = async (contestId: string, limit: number = 50) => {
    return await violationRepo().find({
        where: { contestId },
        relations: ["user"],
        order: { timestamp: "DESC" },
        take: limit
    });
};

/**
 * Get contest statistics
 */
export const getContestStatistics = async (contestId: string) => {
    const totalParticipants = await regRepo().count({ where: { contestId } });
    const totalViolations = await violationRepo().count({ where: { contestId } });
    const totalSubmissions = await submissionRepo().count({ where: { contestId } });

    // Violation breakdown
    const violations = await violationRepo().find({ where: { contestId } });
    const violationBreakdown = violations.reduce((acc: any, v) => {
        acc[v.violationType] = (acc[v.violationType] || 0) + 1;
        return acc;
    }, {});

    return {
        totalParticipants,
        totalViolations,
        totalSubmissions,
        violationBreakdown
    };
};

/**
 * Get invited users list
 */
export const getInvitedUsers = async (contestId: string) => {
    return await inviteRepo().find({
        where: { contestId },
        relations: ["acceptedByUser"],
        order: { invitedAt: "DESC" }
    });
};

/**
 * Get monitoring dashboard data (aggregated)
 */
export const getDashboardData = async (contestId: string) => {
    const contest = await contestRepo().findOne({ where: { id: contestId } });
    if (!contest) throw { status: 404, message: "Contest not found" };

    const stats = await getContestStatistics(contestId);
    const recentViolations = await getViolationFeed(contestId, 10);

    return {
        contest: {
            id: contest.id,
            title: contest.title,
            startTime: contest.startTime,
            endTime: contest.endTime,
            isInviteOnly: contest.isInviteOnly
        },
        stats,
        recentViolations
    };
};

/**
 * Get unified participant view for a contest
 */
export const getContestParticipants = async (contestId: string) => {
    // 1. Get all invitations
    const invitations = await inviteRepo().find({
        where: { contestId },
        relations: ['acceptedByUser']
    });

    // 2. Get all sessions
    const sessions = await sessionRepo().find({ where: { contestId } });

    // 3. Get all reports
    const reports = await reportRepo().find({ where: { contestId } });

    // 4. Merge data
    return invitations.map(invite => {
        const user = invite.acceptedByUser;
        const session = user ? sessions.find(s => s.userId === user.id) : null;
        const report = user ? reports.find(r => r.userId === user.id) : null;

        return {
            invitationId: invite.id,
            email: invite.email,
            userId: user?.id || null,
            username: user?.username || null,
            status: calculateStatus(invite, session), // "invited", "registered", "started", "finished"
            invitedAt: invite.invitedAt,
            acceptedAt: invite.acceptedAt,
            startedAt: session?.startedAt || null,
            finishedAt: session?.finishedAt || null,
            duration: session?.durationSeconds || null,
            score: report?.totalScore || null,
            problemsSolved: report?.problemsSolved || null,
            reportId: report?.id || null,
            isBlocked: !!session?.finishedAt // Invite link is blocked if finished
        };
    });
};

/**
 * Helper to calculate status
 */
const calculateStatus = (invite: ContestInvitation, session: ContestSession | undefined | null) => {
    if (session?.status === "finished") return "finished";
    if (session?.status === "active") return "started";
    if (invite.isAccepted) return "registered";
    return "invited";
};

/**
 * Get all SecureContestResults for a contest (for Organizer dashboard)
 */
export const getAllSecureContestResults = async (contestId: string) => {
    return await secureResultRepo().find({
        where: { contestId },
        order: { finalScore: "DESC" }
    });
};
