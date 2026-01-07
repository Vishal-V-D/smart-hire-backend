import { AppDataSource } from "../config/db";
import { ContestSession } from "../entities/contestSession.entity";
import { ContestRegistration } from "../entities/contestRegistration.entity";
import { Contest } from "../entities/contest.entity";
import { User } from "../entities/user.entity";
import { randomUUID } from "crypto";
import * as timerUtil from "../utils/contestTimer.util";
// import { emitContestNotification } from "../utils/socket"; // Uncomment when socket util is available

const sessionRepo = () => AppDataSource.getRepository(ContestSession);
const regRepo = () => AppDataSource.getRepository(ContestRegistration);
const contestRepo = () => AppDataSource.getRepository(Contest);
const userRepo = () => AppDataSource.getRepository(User);

/**
 * Start a new session
 */
export const startSession = async (contestId: string, userId: string, metadata?: any, startedAtString?: string) => {
    // Fetch contest to check time window associated with it
    const contest = await contestRepo().findOneBy({ id: contestId });
    if (!contest) {
        throw { status: 404, message: "Contest not found" };
    }

    const now = new Date();

    // 🕐 Check if contest has started
    if (contest.startTime && now < new Date(contest.startTime)) {
        throw { 
            status: 403, 
            message: "Contest has not started yet",
            startsAt: contest.startTime
        };
    }

    // 🕐 Check if contest window has ended
    if (contest.endTime && now > new Date(contest.endTime)) {
        throw { 
            status: 403, 
            message: "Contest window has closed",
            endedAt: contest.endTime
        };
    }

    // Check if user already has an active session
    const activeSession = await sessionRepo().findOne({
        where: { contestId, userId, status: "active" }
    });

    if (activeSession) {
        // Check if their individual time has expired
        const timerStatus = timerUtil.getTimerStatus(contest, activeSession);
        if (timerStatus.hasExpired) {
            // Auto-mark as expired
            activeSession.status = "expired";
            activeSession.finishedAt = timerStatus.expiresAt!;
            activeSession.durationSeconds = timerStatus.totalDurationSeconds;
            await sessionRepo().save(activeSession);
            throw { status: 403, message: "Your contest time has expired" };
        }
        // Return existing active session (for page refreshes)
        console.log(`ℹ️ [Session] Resuming active session for user ${userId}`);
        return activeSession;
    }

    // Check if user has finished (from ContestRegistration or previous sessions)
    const registration = await regRepo().findOne({ where: { contestId, userId } });
    if (registration?.finishedAt) {
        throw { status: 403, message: "Assessment already completed" };
    }

    // Check for expired session (user's individual time ran out)
    const previousSession = await sessionRepo().findOne({
        where: { contestId, userId },
        order: { startedAt: "DESC" }
    });

    if (previousSession) {
        if (previousSession.status === "finished") {
            throw { status: 403, message: "Assessment already completed" };
        }
        if (previousSession.status === "expired") {
            throw { status: 403, message: "Your contest time has expired. You cannot re-enter." };
        }
        // Check if time would have expired
        const timerStatus = timerUtil.getTimerStatus(contest, previousSession);
        if (timerStatus.hasExpired) {
            previousSession.status = "expired";
            previousSession.finishedAt = timerStatus.expiresAt!;
            previousSession.durationSeconds = timerStatus.totalDurationSeconds;
            await sessionRepo().save(previousSession);
            throw { status: 403, message: "Your contest time has expired. You cannot re-enter." };
        }
    }

    const sessionId = randomUUID();
    const session = sessionRepo().create({
        contestId,
        userId,
        sessionId,
        startedAt: startedAtString ? new Date(startedAtString) : new Date(),
        status: "active",
        metadata
    });

    await sessionRepo().save(session);

    // Update ContestRegistration for backward compatibility
    if (registration) {
        if (!registration.startedAt) {
            registration.startedAt = session.startedAt;
        }
        registration.lastActiveSessionId = sessionId;
        await regRepo().save(registration);
    }

    console.log(`🏁 [Session] Started for user ${userId} in contest ${contestId}`);
    console.log(`   ⏱️ Duration: ${contest.durationMinutes} minutes`);
    console.log(`   📅 Expires at: ${new Date(session.startedAt.getTime() + (contest.durationMinutes || 0) * 60 * 1000)}`);

    return session;
};

/**
 * Finish session
 */
export const finishSession = async (contestId: string, userId: string) => {
    const session = await sessionRepo().findOne({
        where: { contestId, userId, status: "active" }
    });

    if (!session) {
        // Check if already finished
        const finishedSession = await sessionRepo().findOne({
            where: { contestId, userId, status: "finished" }
        });
        if (finishedSession) {
            return finishedSession;
        }
        throw { status: 404, message: "No active session found" };
    }

    const finishedAt = new Date();
    const durationSeconds = Math.floor(
        (finishedAt.getTime() - session.startedAt.getTime()) / 1000
    );

    session.finishedAt = finishedAt;
    session.durationSeconds = durationSeconds;
    session.status = "finished";

    await sessionRepo().save(session);

    // Update ContestRegistration
    const registration = await regRepo().findOne({ where: { contestId, userId } });
    if (registration) {
        registration.finishedAt = finishedAt;
        registration.lastActiveSessionId = null;
        await regRepo().save(registration);
    }

    // Notify organizers
    // emitContestNotification({
    //     type: "participant_finished",
    //     contestId,
    //     userId,
    //     finishedAt: session.finishedAt,
    //     duration: session.durationSeconds,
    //     message: `User finished the assessment`
    // });

    return session;
};

/**
 * Get active participants for a contest
 */
export const getActiveParticipants = async (contestId: string) => {
    return await sessionRepo().find({
        where: { contestId, status: "active" },
        relations: ["user"],
        order: { startedAt: "DESC" }
    });
};

/**
 * Get latest session for a user
 */
export const getLatestSession = async (contestId: string, userId: string) => {
    return await sessionRepo().findOne({
        where: { contestId, userId },
        order: { startedAt: "DESC" }
    });
};

/**
 * Get session statistics
 */
export const getSessionStatistics = async (contestId: string) => {
    const sessions = await sessionRepo().find({ where: { contestId } });

    const totalStarted = sessions.length;
    const currentlyActive = sessions.filter(s => s.status === "active").length;
    const finished = sessions.filter(s => s.status === "finished").length;

    const finishedSessions = sessions.filter(s => s.durationSeconds !== null);
    const totalDuration = finishedSessions.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
    const averageDuration = finishedSessions.length > 0 ? Math.floor(totalDuration / finishedSessions.length) : 0;

    return {
        totalStarted,
        currentlyActive,
        finished,
        averageDuration
    };
};

/**
 * Get active session for a user (status = "active")
 */
export const getActiveSession = async (contestId: string, userId: string) => {
    return await sessionRepo().findOne({
        where: { contestId, userId, status: "active" }
    });
};

/**
 * Get session (any status) for a user
 */
export const getSession = async (contestId: string, userId: string) => {
    return await sessionRepo().findOne({
        where: { contestId, userId },
        order: { startedAt: "DESC" }
    });
};
