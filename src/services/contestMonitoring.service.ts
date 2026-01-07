import { AppDataSource } from "../config/db";
import { ContestViolation, ViolationType } from "../entities/contestViolation.entity";
import { ContestMonitoringPhoto } from "../entities/contestMonitoringPhoto.entity";
import { Contest } from "../entities/contest.entity";
import { User } from "../entities/user.entity";
import * as supabaseService from "./supabase.service";
import { emitContestNotification } from "../utils/socket";

const violationRepo = () => AppDataSource.getRepository(ContestViolation);
const photoRepo = () => AppDataSource.getRepository(ContestMonitoringPhoto);
const contestRepo = () => AppDataSource.getRepository(Contest);
const userRepo = () => AppDataSource.getRepository(User);

/**
 * Check if a violation type is allowed by contest proctoring settings
 */
const isViolationAllowed = (contest: Contest, type: ViolationType): boolean => {
    // If not invite-only (general contest), no proctoring at all
    if (!contest.isInviteOnly) return false;

    switch (type) {
        case ViolationType.COPY:
        case ViolationType.PASTE:
        case ViolationType.EXTERNAL_PASTE:
            return contest.enableCopyPasteDetection;

        case ViolationType.TAB_SWITCH_AWAY:
        case ViolationType.TAB_SWITCH_RETURN:
        case ViolationType.WINDOW_BLUR:
            return contest.enableTabSwitchDetection;

        case ViolationType.CAMERA_BLOCKED:
        case ViolationType.NO_FACE_DETECTED:
        case ViolationType.MULTIPLE_FACES:
        case ViolationType.FACE_MISMATCH:
        case ViolationType.FACE_RECOGNITION_FAILED:
            return contest.enableFaceRecognition || contest.enableVideoProctoring;

        case ViolationType.AUDIO_NOISE_DETECTED:
            return contest.enableAudioMonitoring;

        case ViolationType.SUSPICIOUS_ACTIVITY:
            // Always allow suspicious activity reports for invite-only contests
            return true;

        default:
            return false;
    }
};

/**
 * Record a violation (only if proctoring is enabled for that type)
 */
export const recordViolation = async (
    contestId: string,
    userId: string,
    type: ViolationType,
    metadata: any
) => {
    // Fetch contest to check proctoring settings
    const contest = await contestRepo().findOneBy({ id: contestId });
    if (!contest) {
        throw { status: 404, message: "Contest not found" };
    }

    // Check if violation recording is allowed based on proctoring settings
    if (!isViolationAllowed(contest, type)) {
        console.log(`⚠️ [Monitoring] Skipping violation ${type} - proctoring disabled for this type`);
        return {
            skipped: true,
            reason: "Proctoring disabled for this violation type",
            violationType: type,
            proctoringStatus: {
                isInviteOnly: contest.isInviteOnly,
                enableCopyPasteDetection: contest.enableCopyPasteDetection,
                enableTabSwitchDetection: contest.enableTabSwitchDetection,
                enableVideoProctoring: contest.enableVideoProctoring,
                enableAudioMonitoring: contest.enableAudioMonitoring,
                enableFaceRecognition: contest.enableFaceRecognition,
                enableFullscreenMode: contest.enableFullscreenMode,
            }
        };
    }

    // Record the violation
    const violation = violationRepo().create({
        contestId,
        userId,
        violationType: type,
        metadata,
        timestamp: new Date(),
    });

    await violationRepo().save(violation);

    // Emit real-time update
    emitContestNotification({
        type: "violation_reported",
        title: "Violation Detected",
        message: `Violation: ${type}`,
        contestId,
        userId,
        violation,
    });

    return violation;
};

/**
 * Upload monitoring photo
 */
export const uploadMonitoringPhoto = async (
    contestId: string,
    userId: string,
    file: Express.Multer.File,
    timestamp: number
) => {
    const photoUrl = await supabaseService.uploadMonitoringPhoto(
        file,
        userId,
        contestId,
        timestamp
    );

    const photo = photoRepo().create({
        contestId,
        userId,
        photoUrl,
        capturedAt: new Date(timestamp),
    });

    await photoRepo().save(photo);

    // Emit real-time update
    emitContestNotification({
        type: "monitoring_photo_captured",
        title: "Photo Captured",
        message: "New monitoring photo available",
        contestId,
        userId,
        photoUrl,
    });

    return photo;
};

/**
 * Get user violations
 */
export const getUserViolations = async (contestId: string, userId: string) => {
    return await violationRepo().find({
        where: { contestId, userId },
        order: { timestamp: "DESC" },
    });
};

/**
 * Get all contest violations
 */
export const getAllViolations = async (contestId: string) => {
    return await violationRepo().find({
        where: { contestId },
        relations: ["user"],
        order: { timestamp: "DESC" },
    });
};

/**
 * Calculate suspicious score and flags
 */
export const getDistinctFlags = async (contestId: string, userId: string) => {
    const violations = await getUserViolations(contestId, userId);

    const externalPasteCount = violations.filter(v => v.violationType === ViolationType.EXTERNAL_PASTE).length;
    const tabSwitchCount = violations.filter(v =>
        v.violationType === ViolationType.TAB_SWITCH_AWAY ||
        v.violationType === ViolationType.WINDOW_BLUR
    ).length;

    // Simple heuristic for suspicious score (0-100)
    let suspiciousScore = 0;
    suspiciousScore += externalPasteCount * 10;
    suspiciousScore += tabSwitchCount * 2;

    // Cap at 100
    suspiciousScore = Math.min(suspiciousScore, 100);

    const isSuspicious = suspiciousScore > 50;
    const isDistinct = suspiciousScore > 80;

    return {
        isDistinct,
        isSuspicious,
        suspiciousScore,
        details: {
            externalPasteCount,
            tabSwitchCount,
            totalViolations: violations.length
        }
    };
};
