import { AppDataSource } from "../config/db";
import { Contest } from "../entities/contest.entity";
import { ContestRegistration } from "../entities/contestRegistration.entity";
import { ContestSession } from "../entities/contestSession.entity";
import { ContestViolation } from "../entities/contestViolation.entity";
import { ContestMonitoringPhoto } from "../entities/contestMonitoringPhoto.entity";
import { SecureContestResult } from "../entities/SecureContestResult.entity";
import { ContestInvitation } from "../entities/contestInvitation.entity";
import { ContestProblem } from "../entities/contestProblem.entity";
import { PlagiarismResult } from "../entities/plagiarismResult.entity";
import { validateProctoringSettings, ProctoringSettings } from "../utils/proctoringValidation.util";

const contestRepo = () => AppDataSource.getRepository(Contest);
const registrationRepo = () => AppDataSource.getRepository(ContestRegistration);
const sessionRepo = () => AppDataSource.getRepository(ContestSession);
const violationRepo = () => AppDataSource.getRepository(ContestViolation);
const photoRepo = () => AppDataSource.getRepository(ContestMonitoringPhoto);
const resultRepo = () => AppDataSource.getRepository(SecureContestResult);
const invitationRepo = () => AppDataSource.getRepository(ContestInvitation);
const problemRepo = () => AppDataSource.getRepository(ContestProblem);
const plagiarismRepo = () => AppDataSource.getRepository(PlagiarismResult);

export interface SecureContestUpdatePayload {
    title?: string;
    description?: string;
    startDate?: string | Date;
    endDate?: string | Date;
    durationMinutes?: number;
    proctoringSettings?: ProctoringSettings;
    showSecureLeaderboard?: boolean;
    leaderboardColumns?: any;
}

/**
 * Get secure contest details (with all proctoring info)
 */
export const getSecureContest = async (contestId: string, requesterId: string) => {
    const contest = await contestRepo().findOne({
        where: { id: contestId },
        relations: ["createdBy", "contestProblems", "contestProblems.problem"]
    });

    if (!contest) {
        throw { status: 404, message: "Contest not found" };
    }

    if (!contest.isInviteOnly) {
        throw { status: 400, message: "This endpoint is only for secure (invite-only) contests" };
    }

    // Only organizer/admin can view full secure contest details
    if (contest.createdBy?.id !== requesterId) {
        throw { status: 403, message: "Only the contest organizer can view secure contest management details" };
    }

    // Get stats
    const registrationCount = await registrationRepo().count({ where: { contestId } });
    const sessionCount = await sessionRepo().count({ where: { contestId } });
    const resultCount = await resultRepo().count({ where: { contestId } });
    const violationCount = await violationRepo().count({ where: { contestId } });

    return {
        ...contest,
        stats: {
            registrations: registrationCount,
            sessions: sessionCount,
            results: resultCount,
            violations: violationCount
        },
        proctoringSettings: {
            enableVideoProctoring: contest.enableVideoProctoring,
            enableAudioMonitoring: contest.enableAudioMonitoring,
            enableCopyPasteDetection: contest.enableCopyPasteDetection,
            enableTabSwitchDetection: contest.enableTabSwitchDetection,
            enableScreenshotCapture: contest.enableScreenshotCapture,
            enableFaceRecognition: contest.enableFaceRecognition,
            enableFullscreenMode: contest.enableFullscreenMode,
            requireCameraAccess: contest.requireCameraAccess,
            requireMicrophoneAccess: contest.requireMicrophoneAccess,
            screenshotIntervalSeconds: contest.screenshotIntervalSeconds,
        },
        leaderboardConfig: {
            showSecureLeaderboard: contest.showSecureLeaderboard,
            leaderboardColumns: contest.leaderboardColumns
        }
    };
};

/**
 * Update secure contest
 */
export const updateSecureContest = async (
    contestId: string,
    organizerId: string,
    data: SecureContestUpdatePayload
) => {
    const contest = await contestRepo().findOne({
        where: { id: contestId },
        relations: ["createdBy"]
    });

    if (!contest) {
        throw { status: 404, message: "Contest not found" };
    }

    if (!contest.isInviteOnly) {
        throw { status: 400, message: "This endpoint is only for secure (invite-only) contests" };
    }

    if (contest.createdBy?.id !== organizerId) {
        throw { status: 403, message: "Only the contest organizer can update this contest" };
    }

    // Update basic fields
    if (data.title !== undefined) contest.title = data.title;
    if (data.description !== undefined) contest.description = data.description;
    if (data.startDate !== undefined) contest.startTime = new Date(data.startDate);
    if (data.endDate !== undefined) contest.endTime = new Date(data.endDate);
    if (data.durationMinutes !== undefined) contest.durationMinutes = data.durationMinutes;

    // Update proctoring settings
    if (data.proctoringSettings) {
        const ps = data.proctoringSettings;
        const errors = validateProctoringSettings(ps);
        if (errors.length > 0) {
            throw { status: 400, message: `Invalid proctoring settings: ${errors.join(", ")}` };
        }

        if (ps.enableVideoProctoring !== undefined) contest.enableVideoProctoring = ps.enableVideoProctoring;
        if (ps.enableAudioMonitoring !== undefined) contest.enableAudioMonitoring = ps.enableAudioMonitoring;
        if (ps.enableCopyPasteDetection !== undefined) contest.enableCopyPasteDetection = ps.enableCopyPasteDetection;
        if (ps.enableTabSwitchDetection !== undefined) contest.enableTabSwitchDetection = ps.enableTabSwitchDetection;
        if (ps.enableScreenshotCapture !== undefined) contest.enableScreenshotCapture = ps.enableScreenshotCapture;
        if (ps.enableFaceRecognition !== undefined) contest.enableFaceRecognition = ps.enableFaceRecognition;
        if (ps.enableFullscreenMode !== undefined) contest.enableFullscreenMode = ps.enableFullscreenMode;
        if (ps.requireCameraAccess !== undefined) contest.requireCameraAccess = ps.requireCameraAccess;
        if (ps.requireMicrophoneAccess !== undefined) contest.requireMicrophoneAccess = ps.requireMicrophoneAccess;
        if (ps.screenshotIntervalSeconds !== undefined) contest.screenshotIntervalSeconds = ps.screenshotIntervalSeconds;
    }

    // Update leaderboard settings
    if (data.showSecureLeaderboard !== undefined) contest.showSecureLeaderboard = data.showSecureLeaderboard;
    if (data.leaderboardColumns !== undefined) contest.leaderboardColumns = data.leaderboardColumns;

    const updated = await contestRepo().save(contest);
    console.log(`🔒 [SecureContest] Updated: ${contestId}`);

    return updated;
};

/**
 * Delete secure contest and ALL related data (cascade)
 */
export const deleteSecureContest = async (contestId: string, organizerId: string) => {
    const contest = await contestRepo().findOne({
        where: { id: contestId },
        relations: ["createdBy"]
    });

    if (!contest) {
        throw { status: 404, message: "Contest not found" };
    }

    if (!contest.isInviteOnly) {
        throw { status: 400, message: "This endpoint is only for secure (invite-only) contests" };
    }

    if (contest.createdBy?.id !== organizerId) {
        throw { status: 403, message: "Only the contest organizer can delete this contest" };
    }

    console.log(`🗑️ [SecureContest] Starting cascade delete for: ${contestId}`);

    // Delete all related data in order (respecting foreign keys)
    const deletions: { table: string; count: number }[] = [];

    // 1. Delete plagiarism results
    const plagiarismCount = await plagiarismRepo().delete({ contestId });
    deletions.push({ table: "plagiarism_results", count: plagiarismCount.affected || 0 });

    // 2. Delete secure contest results
    const resultsCount = await resultRepo().delete({ contestId });
    deletions.push({ table: "secure_contest_results", count: resultsCount.affected || 0 });

    // 3. Delete violations
    const violationsCount = await violationRepo().delete({ contestId });
    deletions.push({ table: "contest_violations", count: violationsCount.affected || 0 });

    // 4. Delete monitoring photos
    const photosCount = await photoRepo().delete({ contestId });
    deletions.push({ table: "contest_monitoring_photos", count: photosCount.affected || 0 });

    // 5. Delete sessions
    const sessionsCount = await sessionRepo().delete({ contestId });
    deletions.push({ table: "contest_sessions", count: sessionsCount.affected || 0 });

    // 6. Delete registrations
    const registrationsCount = await registrationRepo().delete({ contestId });
    deletions.push({ table: "contest_registrations", count: registrationsCount.affected || 0 });

    // 7. Delete invitations
    const invitationsCount = await invitationRepo().delete({ contestId });
    deletions.push({ table: "contest_invitations", count: invitationsCount.affected || 0 });

    // 8. Delete contest problems (link table) - uses relation not contestId column
    const problemsCount = await problemRepo().delete({ contest: { id: contestId } });
    deletions.push({ table: "contest_problems", count: problemsCount.affected || 0 });

    // 9. Finally, delete the contest itself
    await contestRepo().delete({ id: contestId });
    deletions.push({ table: "contests", count: 1 });

    console.log(`✅ [SecureContest] Cascade delete complete for: ${contestId}`);
    deletions.forEach(d => console.log(`   - ${d.table}: ${d.count} rows`));

    return {
        message: "Secure contest and all related data deleted successfully",
        contestId,
        deletions
    };
};

/**
 * List all secure contests for an organizer
 */
export const listSecureContests = async (organizerId: string) => {
    const contests = await contestRepo().find({
        where: {
            createdBy: { id: organizerId },
            isInviteOnly: true
        },
        order: { createdAt: "DESC" }
    });

    // Add quick stats for each
    const contestsWithStats = await Promise.all(contests.map(async (c) => {
        const registrations = await registrationRepo().count({ where: { contestId: c.id } });
        const results = await resultRepo().count({ where: { contestId: c.id } });
        return {
            id: c.id,
            title: c.title,
            startTime: c.startTime,
            endTime: c.endTime,
            shareableLink: c.shareableLink,
            showSecureLeaderboard: c.showSecureLeaderboard,
            registrations,
            completedResults: results,
            createdAt: c.createdAt
        };
    }));

    return contestsWithStats;
};
