import { AppDataSource } from "../config/db";
import { SecureContestResult } from "../entities/SecureContestResult.entity";
import { Contest } from "../entities/contest.entity";

const resultRepo = () => AppDataSource.getRepository(SecureContestResult);
const contestRepo = () => AppDataSource.getRepository(Contest);

// Default column configuration
const DEFAULT_COLUMNS: LeaderboardColumnConfig = {
    showRank: true,
    showName: true,
    showRollNumber: true,
    showCollege: false,
    showDepartment: false,
    showScore: true,
    showProblemsSolved: true,
    showTime: true,
    showViolationPenalty: false,
    showSuspiciousFlag: false,
};

export interface LeaderboardColumnConfig {
    showRank: boolean;
    showName: boolean;
    showRollNumber: boolean;
    showCollege: boolean;
    showDepartment: boolean;
    showScore: boolean;
    showProblemsSolved: boolean;
    showTime: boolean;
    showViolationPenalty: boolean;
    showSuspiciousFlag: boolean;
}

export interface SecureLeaderboardEntry {
    rank?: number;
    userId: string;
    name?: string;
    rollNumber?: string;
    college?: string;
    department?: string;
    finalScore?: number;
    totalProblemsSolved?: number;
    totalProblems?: number;
    durationSeconds?: number;
    finishedAt?: Date | null;
    violationPenalty?: number;
    isSuspicious?: boolean;
}

/**
 * Get secure contest leaderboard with column filtering
 */
export const getSecureLeaderboard = async (
    contestId: string,
    requesterId: string,
    isOrganizer: boolean
): Promise<{
    leaderboard: SecureLeaderboardEntry[];
    isVisible: boolean;
    columns: LeaderboardColumnConfig;
    userRank?: SecureLeaderboardEntry;
    contestTitle?: string;
    message?: string;
}> => {

    const contest = await contestRepo().findOne({
        where: { id: contestId },
        relations: ["createdBy"]
    });

    if (!contest) {
        throw { status: 404, message: "Contest not found" };
    }

    if (!contest.isInviteOnly) {
        throw { status: 400, message: "Secure leaderboard is only for invite-only contests. Use regular leaderboard for public contests." };
    }

    // Check visibility
    const isContestOrganizer = contest.createdBy?.id === requesterId;
    const canView = isContestOrganizer || isOrganizer || contest.showSecureLeaderboard;

    // Get column config (use defaults if not set)
    const columns: LeaderboardColumnConfig = {
        ...DEFAULT_COLUMNS,
        ...(contest.leaderboardColumns || {})
    };

    if (!canView) {
        return {
            leaderboard: [],
            isVisible: false,
            columns,
            contestTitle: contest.title,
            message: "Leaderboard is hidden by the organizer"
        };
    }

    // Fetch results from SecureContestResult
    const results = await resultRepo().find({
        where: { contestId },
        order: {
            finalScore: "DESC",
            totalProblemsSolved: "DESC",
            durationSeconds: "ASC"
        }
    });

    // Build leaderboard with only visible columns
    const leaderboard: SecureLeaderboardEntry[] = results.map((r, index) => {
        const entry: SecureLeaderboardEntry = { userId: r.userId };

        if (columns.showRank) entry.rank = index + 1;
        if (columns.showName) entry.name = r.registrationDetails?.name || "Anonymous";
        if (columns.showRollNumber) entry.rollNumber = r.registrationDetails?.rollNumber;
        if (columns.showCollege) entry.college = r.registrationDetails?.college;
        if (columns.showDepartment) entry.department = r.registrationDetails?.department;
        if (columns.showScore) entry.finalScore = r.finalScore;
        if (columns.showProblemsSolved) {
            entry.totalProblemsSolved = r.totalProblemsSolved;
            entry.totalProblems = r.totalProblems;
        }
        if (columns.showTime) {
            entry.durationSeconds = r.durationSeconds;
            entry.finishedAt = r.finishedAt;
        }
        if (columns.showViolationPenalty) entry.violationPenalty = r.violationPenalty;
        if (columns.showSuspiciousFlag) entry.isSuspicious = r.isSuspicious;

        return entry;
    });

    // Find requester's rank
    const userRankIndex = results.findIndex(r => r.userId === requesterId);
    const userRank = userRankIndex >= 0 ? leaderboard[userRankIndex] : undefined;

    return {
        leaderboard,
        isVisible: true,
        columns,
        contestTitle: contest.title,
        userRank
    };
};

/**
 * Toggle leaderboard visibility
 */
export const toggleVisibility = async (
    contestId: string,
    organizerId: string,
    show: boolean
): Promise<{ showSecureLeaderboard: boolean }> => {

    const contest = await contestRepo().findOne({
        where: { id: contestId },
        relations: ["createdBy"]
    });

    if (!contest) throw { status: 404, message: "Contest not found" };
    if (contest.createdBy?.id !== organizerId) {
        throw { status: 403, message: "Only organizer can toggle visibility" };
    }
    if (!contest.isInviteOnly) {
        throw { status: 400, message: "Only for secure contests" };
    }

    contest.showSecureLeaderboard = show;
    await contestRepo().save(contest);

    console.log(`🏆 [SecureLeaderboard] Contest ${contestId} visibility: ${show ? "SHOWN" : "HIDDEN"}`);

    return { showSecureLeaderboard: show };
};

/**
 * Update column configuration
 */
export const updateColumnConfig = async (
    contestId: string,
    organizerId: string,
    columns: Partial<LeaderboardColumnConfig>
): Promise<{ leaderboardColumns: LeaderboardColumnConfig }> => {

    const contest = await contestRepo().findOne({
        where: { id: contestId },
        relations: ["createdBy"]
    });

    if (!contest) throw { status: 404, message: "Contest not found" };
    if (contest.createdBy?.id !== organizerId) {
        throw { status: 403, message: "Only organizer can update columns" };
    }
    if (!contest.isInviteOnly) {
        throw { status: 400, message: "Only for secure contests" };
    }

    // Merge with existing/defaults
    const newConfig: LeaderboardColumnConfig = {
        ...DEFAULT_COLUMNS,
        ...(contest.leaderboardColumns || {}),
        ...columns
    };

    contest.leaderboardColumns = newConfig;
    await contestRepo().save(contest);

    console.log(`🏆 [SecureLeaderboard] Column config updated for ${contestId}`);

    return { leaderboardColumns: newConfig };
};

/**
 * Get current configuration
 */
export const getConfig = async (contestId: string): Promise<{
    showSecureLeaderboard: boolean;
    leaderboardColumns: LeaderboardColumnConfig;
    isSecure: boolean;
}> => {
    const contest = await contestRepo().findOneBy({ id: contestId });
    if (!contest) throw { status: 404, message: "Contest not found" };

    return {
        showSecureLeaderboard: contest.showSecureLeaderboard || false,
        leaderboardColumns: { ...DEFAULT_COLUMNS, ...(contest.leaderboardColumns || {}) },
        isSecure: contest.isInviteOnly
    };
};
