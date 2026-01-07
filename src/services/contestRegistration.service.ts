import { AppDataSource } from "../config/db";
import { ContestRegistration } from "../entities/contestRegistration.entity";
import { Contest } from "../entities/contest.entity";
import { User } from "../entities/user.entity";
import * as inviteService from "./contestInvite.service";
import * as supabaseService from "./supabase.service";
import * as sessionService from "./contestSession.service";
import { randomUUID } from "crypto";

const regRepo = () => AppDataSource.getRepository(ContestRegistration);
const contestRepo = () => AppDataSource.getRepository(Contest);
const userRepo = () => AppDataSource.getRepository(User);

export const registerUserForContest = async (
    contestId: string,
    userId: string,
    data: any
) => {
    console.log(`🚀 [Registration] Starting registration for user ${userId} in contest ${contestId}`);

    const contest = await contestRepo().findOne({
        where: { id: contestId },
        relations: ["contestProblems"]
    });
    if (!contest) {
        console.log(`❌ [Registration] Contest ${contestId} not found`);
        throw { status: 404, message: "Contest not found" };
    }
    console.log(`✅ [Registration] Contest found: ${contest.title} (Invite-only: ${contest.isInviteOnly})`);
    console.log(`🧩 [Registration] Contest has ${contest.contestProblems?.length || 0} problems associated.`);
    if (contest.contestProblems?.length === 0) {
        console.warn(`⚠️ [Registration] WARNING: This contest has NO problems linked!`);
    }

    // Check if already registered
    const existing = await regRepo().findOne({
        where: { contestId, userId },
    });

    if (existing) {
        console.log(`⚠️ [Registration] User ${userId} already registered for contest ${contestId}`);

        // STRICT ENTRY LOGIC:
        // 1. If user has already finished (finishedAt is set), BLOCK THEM.
        if (existing.finishedAt) {
            console.log(`⛔ [Registration] User ${userId} has already finished the contest at ${existing.finishedAt}`);
            throw { status: 403, message: "Link Expired: You have already finished this contest." };
        }

        // 2. If contest has ended globally, BLOCK THEM.
        if (contest.endTime) {
            const now = new Date();
            const endTime = new Date(contest.endTime);
            if (now > endTime) {
                console.log(`⛔ [Registration] Contest ${contestId} has ended at ${endTime}`);
                throw { status: 403, message: "Contest has ended." };
            }
        }

        console.log(`✅ [Registration] User registered but not finished. Allowing re-entry.`);
        // Return existing registration (effectively logging them back in)
        return existing;
    }
    console.log(`✅ [Registration] User not previously registered`);

    // For PUBLIC contests: Simple registration without detailed info
    if (!contest.isInviteOnly) {
        console.log(`🌐 [Registration] Public contest - Simple registration`);

        // Just add user to contest contestants (no detailed registration needed)
        if (!contest.contestant) contest.contestant = [];
        const user = await userRepo().findOneBy({ id: userId });
        if (user) {
            contest.contestant.push(user);
            await contestRepo().save(contest);
            console.log(`✅ [Registration] User added to public contest contestants`);
        }

        return {
            message: "Successfully registered for public contest",
            contestId,
            userId,
            isPublic: true
        };
    }

    // For INVITE-ONLY contests: Full registration with photo and details
    console.log(`🔒 [Registration] Invite-only contest - Full registration required`);

    // Validate required fields for invite-only contests
    const requiredFields = ['name', 'rollNumber', 'department', 'currentYear', 'college', 'photoBase64'];
    const missingFields = requiredFields.filter(field => !data[field]);

    if (missingFields.length > 0) {
        console.log(`❌ [Registration] Missing required fields: ${missingFields.join(', ')}`);
        throw {
            status: 400,
            message: `Missing required fields for invite-only contest: ${missingFields.join(', ')}`
        };
    }

    // Check invite if required
    console.log(`🔒 [Registration] Checking invitation`);
    const invitation = await inviteService.checkUserInvited(contestId, data.email);
    if (!invitation || !invitation.isAccepted || invitation.acceptedByUserId !== userId) {
        console.log(`❌ [Registration] User ${userId} not invited or invitation not accepted`);
        throw { status: 403, message: "You must be invited to register for this contest" };
    }
    console.log(`✅ [Registration] Invitation verified for user ${userId}`);

    // Handle photo upload (base64)
    console.log(`📸 [Registration] Processing photo upload...`);
    const photoUrl = await supabaseService.uploadBase64Photo(
        data.photoBase64,
        userId,
        contestId,
        'registration-photo'
    );
    console.log(`✅ [Registration] Photo uploaded successfully: ${photoUrl}`);

    // Handle resume upload (optional, base64 PDF)
    let resumeUrl: string | null = null;
    if (data.resumeBase64) {
        console.log(`📄 [Registration] Resume PDF provided, uploading to Supabase...`);
        resumeUrl = await supabaseService.uploadBase64PDF(
            data.resumeBase64,
            userId,
            contestId,
            'resume'
        );
        console.log(`✅ [Registration] Resume uploaded successfully: ${resumeUrl}`);
    } else {
        console.log(`ℹ️ [Registration] No resume provided (optional)`);
    }

    // Create registration
    console.log(`💾 [Registration] Creating registration record...`);
    const registration = regRepo().create({
        contestId,
        userId,
        name: data.name,
        email: data.email || undefined,
        personalEmail: data.personalEmail || undefined,
        phone: data.phone || undefined,
        college: data.college,
        rollNumber: data.rollNumber,
        department: data.department,
        currentYear: data.currentYear,
        photoUrl,
        resumeUrl: resumeUrl || undefined,
    });

    await regRepo().save(registration);
    console.log(`✅ [Registration] Registration record saved with ID: ${registration.id}`);

    // Also add to contest.contestant (legacy support)
    console.log(`🔗 [Registration] Adding user to contest contestants...`);
    if (!contest.contestant) contest.contestant = [];
    const user = await userRepo().findOneBy({ id: userId });
    if (user) {
        contest.contestant.push(user);
        await contestRepo().save(contest);
        console.log(`✅ [Registration] User added to contest contestants`);
    }

    console.log(`🎉 [Registration] Registration completed successfully for user ${userId}`);
    console.log(`
    📋 --- REGISTRATION DETAILS ---
    ID: ${registration.id}
    User ID: ${registration.userId}
    Contest ID: ${registration.contestId}
    Name: ${registration.name}
    Email: ${registration.email || "N/A"}
    Personal Email: ${registration.personalEmail || "N/A"}
    Phone: ${registration.phone || "N/A"}
    College: ${registration.college}
    Roll Number: ${registration.rollNumber}
    Department: ${registration.department}
    Year: ${registration.currentYear}
    Photo URL: ${registration.photoUrl}
    Resume URL: ${registration.resumeUrl || "N/A"}
    -------------------------------
    `);
    // If invite-only contest significantly, and startTime is provided, start the session immediately
    if (contest.isInviteOnly && data.startTime) {
        console.log(`🚀 [Registration] Start time provided (${data.startTime}), starting session for user ${userId}`);
        const session = await sessionService.startSession(contestId, userId, undefined, data.startTime);

        // Update the registration object with session details to return
        (registration as any).sessionId = session.sessionId;
        (registration as any).startedAt = session.startedAt;

        console.log(`✅ [Registration] Session started immediately: ${session.sessionId}`);
    }

    return registration;
};

/**
 * Check registration status
 */
export const checkRegistration = async (contestId: string, userId: string) => {
    const registration = await regRepo().findOne({
        where: { contestId, userId },
    });

    return {
        isRegistered: !!registration,
        registration,
        // Session details
        startedAt: registration?.startedAt,
        finishedAt: registration?.finishedAt,
        sessionId: registration?.lastActiveSessionId
    };
};

/**
 * Get registration details
 */
export const getRegistrationDetails = async (contestId: string, userId: string) => {
    const registration = await regRepo().findOne({
        where: { contestId, userId },
        relations: ["user"],
    });

    if (!registration) {
        throw { status: 404, message: "Registration not found" };
    }

    return registration;
};

/**
 * Get all registrations for a contest
 */
export const getAllRegistrations = async (contestId: string) => {
    return await regRepo().find({
        where: { contestId },
        relations: ["user"],
        order: { registeredAt: "DESC" },
    });
};

/**
 * Generate shareable link
 */
export const generateShareableLink = async (contestId: string) => {
    const contest = await contestRepo().findOne({ where: { id: contestId } });
    if (!contest) throw { status: 404, message: "Contest not found" };

    if (!contest.shareableLink) {
        // Generate simple unique ID if not exists
        const uniqueId = Math.random().toString(36).substring(2, 10);
        contest.shareableLink = uniqueId;
        await contestRepo().save(contest);
    }

    return {
        link: `${process.env.FRONTEND_URL}/contest/join/${contest.shareableLink}`,
        code: contest.shareableLink
    };
};

/**
 * Get contest by shareable link (with time window validation)
 */
export const getContestByLink = async (linkCode: string) => {
    const contest = await contestRepo().findOne({
        where: { shareableLink: linkCode },
        relations: ["createdBy"]
    });

    if (!contest) throw { status: 404, message: "Invalid contest link" };

    // 🕐 Calculate time window status
    const now = new Date();
    const startTime = contest.startTime ? new Date(contest.startTime) : null;
    const endTime = contest.endTime ? new Date(contest.endTime) : null;

    const isBeforeStart = startTime ? now < startTime : false;
    const isAfterEnd = endTime ? now > endTime : false;
    const isWithinWindow = !isBeforeStart && !isAfterEnd;

    // Generate user-friendly message
    let timeStatus: string;
    let timeMessage: string;

    if (isBeforeStart) {
        timeStatus = "NOT_STARTED";
        // Format: "December 18, 2025 at 01:26 PM IST"
        const formattedStart = startTime ? startTime.toLocaleString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true,
            timeZone: 'Asia/Kolkata'
        }) + ' IST' : 'TBD';
        timeMessage = `Contest starts at ${formattedStart}. Please come back later.`;
    } else if (isAfterEnd) {
        timeStatus = "ENDED";
        const formattedEnd = endTime ? endTime.toLocaleString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true,
            timeZone: 'Asia/Kolkata'
        }) + ' IST' : 'TBD';
        timeMessage = `Contest ended at ${formattedEnd}. This link is no longer valid.`;
    } else {
        timeStatus = "ACTIVE";
        const formattedActiveEnd = endTime ? endTime.toLocaleString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true,
            timeZone: 'Asia/Kolkata'
        }) + ' IST' : null;
        timeMessage = formattedActiveEnd
            ? `Contest is active until ${formattedActiveEnd}`
            : "Contest is currently active";
    }

    return {
        ...contest,
        timeWindow: {
            startTime,
            endTime,
            isBeforeStart,
            isAfterEnd,
            isWithinWindow,
            timeStatus,
            timeMessage,
            durationMinutes: contest.durationMinutes
        }
    };
};

/**
 * Start contest session (Timer Persistence & Single Device)
 */
export const startContest = async (contestId: string, userId: string) => {
    // Delegate to session service
    const session = await sessionService.startSession(contestId, userId);

    console.log(`🚀 [Session] User ${userId} started contest ${contestId}. Session: ${session.sessionId}`);

    return {
        message: "Contest started",
        sessionId: session.sessionId,
        startedAt: session.startedAt
    };
};

/**
 * Finish contest (One-Time Entry)
 */
export const finishContest = async (contestId: string, userId: string) => {
    // Delegate to session service
    const session = await sessionService.finishSession(contestId, userId);

    console.log(`🏁 [Session] User ${userId} finished contest ${contestId}`);

    return {
        message: "Contest finished successfully",
        finishedAt: session.finishedAt
    };
};
