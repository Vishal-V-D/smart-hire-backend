import { Contest } from "../entities/contest.entity";
import { ContestSession } from "../entities/contestSession.entity";

export interface TimerStatus {
    hasStarted: boolean;
    hasExpired: boolean;
    remainingSeconds: number;
    elapsedSeconds: number;
    totalDurationSeconds: number;
    expiresAt: Date | null;
    startedAt: Date | null;
}

/**
 * Calculate timer status for a user session
 */
export const getTimerStatus = (contest: Contest, session: ContestSession | null): TimerStatus => {
    const totalDurationSeconds = (contest.durationMinutes || 0) * 60;

    if (!session || !session.startedAt) {
        return {
            hasStarted: false,
            hasExpired: false,
            remainingSeconds: totalDurationSeconds,
            elapsedSeconds: 0,
            totalDurationSeconds,
            expiresAt: null,
            startedAt: null
        };
    }

    // If session already finished, return those values
    if (session.status === "finished" || session.status === "expired") {
        return {
            hasStarted: true,
            hasExpired: true,
            remainingSeconds: 0,
            elapsedSeconds: session.durationSeconds || totalDurationSeconds,
            totalDurationSeconds,
            expiresAt: session.finishedAt || null,
            startedAt: session.startedAt
        };
    }

    const startedAt = new Date(session.startedAt);
    const now = new Date();
    const elapsedSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
    const remainingSeconds = Math.max(0, totalDurationSeconds - elapsedSeconds);
    const hasExpired = remainingSeconds <= 0;
    const expiresAt = new Date(startedAt.getTime() + totalDurationSeconds * 1000);

    return {
        hasStarted: true,
        hasExpired,
        remainingSeconds,
        elapsedSeconds: Math.min(elapsedSeconds, totalDurationSeconds),
        totalDurationSeconds,
        expiresAt,
        startedAt
    };
};

/**
 * Check if user's contest time has expired
 */
export const isSessionExpired = (contest: Contest, session: ContestSession | null): boolean => {
    if (!session) return false;
    if (session.status === "finished" || session.status === "expired") return true;

    const status = getTimerStatus(contest, session);
    return status.hasExpired;
};

/**
 * Format seconds into readable duration (HH:MM:SS)
 */
export const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

/**
 * Get the actual duration used (capped at allocated time)
 */
export const getActualDuration = (contest: Contest, session: ContestSession): number => {
    const totalDurationSeconds = (contest.durationMinutes || 0) * 60;
    const status = getTimerStatus(contest, session);

    if (status.hasExpired) {
        // If expired, they used all their time
        return totalDurationSeconds;
    }

    // Otherwise, return elapsed time
    return status.elapsedSeconds;
};
