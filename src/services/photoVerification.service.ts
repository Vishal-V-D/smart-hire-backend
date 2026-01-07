import { AppDataSource } from "../config/db";
import { AssessmentSession } from "../entities/AssessmentSession.entity";
import { ContestantProfile } from "../entities/ContestantProfile.entity";
import { User } from "../entities/user.entity";
import * as supabaseService from "./supabase.service";

const sessionRepo = () => AppDataSource.getRepository(AssessmentSession);
const profileRepo = () => AppDataSource.getRepository(ContestantProfile);
const userRepo = () => AppDataSource.getRepository(User);

export interface VerificationResult {
    success: boolean;
    message: string;
    storedPhotoUrl: string | null;
    livePhotoUrl: string;
    sessionId: string;
    timestamp: Date;
}

// ============================================
// UPLOAD VERIFICATION PHOTO
// ============================================

/**
 * Upload live verification photo during assessment
 * Stores the photo and returns URLs for frontend face comparison
 */
export const uploadVerificationPhoto = async (
    userId: string,
    assessmentId: string,
    sessionId: string,
    photoBase64: string
): Promise<VerificationResult> => {
    console.log(`\n📸 [VERIFY_PHOTO] Processing verification photo for user ${userId}`);
    console.log(`   Session: ${sessionId}, Assessment: ${assessmentId}`);

    // Check if sessionId is a UUID or a token
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId);

    // Validate session
    const session = await sessionRepo().findOne({
        where: isUuid ? { id: sessionId } : { sessionToken: sessionId },
        relations: ["user", "assessment"],
    });

    if (!session) {
        throw { status: 404, message: "Session not found" };
    }

    if (session.status !== "active") {
        throw { status: 400, message: "Session is not active" };
    }

    // Get contestant profile to find stored photo
    const profile = await profileRepo().findOne({
        where: {
            user: { id: userId },
            assessment: { id: assessmentId },
        },
    });

    // Also check user's photo from user entity
    const user = await userRepo().findOne({
        where: { id: userId },
    });

    // Get the stored photo URL (could be from profile or user)
    let storedPhotoUrl: string | null = null;
    if (profile?.idCardUrl) {
        storedPhotoUrl = profile.idCardUrl;
        console.log(`   📷 Found stored photo from profile: ${storedPhotoUrl}`);
    } else if ((user as any)?.photoUrl) {
        storedPhotoUrl = (user as any).photoUrl;
        console.log(`   📷 Found stored photo from user: ${storedPhotoUrl}`);
    } else {
        console.log(`   ⚠️ No stored photo found for user`);
    }

    // Upload the live verification photo
    console.log(`   📤 Uploading live verification photo...`);
    const livePhotoUrl = await supabaseService.uploadBase64Photo(
        photoBase64,
        userId,
        assessmentId,
        "verification-photo"
    );

    console.log(`   ✅ Live photo uploaded: ${livePhotoUrl}`);

    // Persist the photo URL to the User entity if it's missing
    // This ensures it appears in the Participant Report later
    if (!(user as any)?.photoUrl) {
        await userRepo().update(userId, { photoUrl: livePhotoUrl });
        console.log(`   💾 Saved live photo as primary User photoUrl`);
        storedPhotoUrl = livePhotoUrl; // Update local var so response reflects it
    }

    return {
        success: true,
        message: storedPhotoUrl
            ? "Verification photo uploaded. Compare with stored photo."
            : "Verification photo uploaded. No stored photo found for comparison.",
        storedPhotoUrl,
        livePhotoUrl,
        sessionId,
        timestamp: new Date(),
    };
};

// ============================================
// GET STORED PHOTO FOR VERIFICATION
// ============================================

/**
 * Get the stored registration photo for a user
 * Used before starting verification to fetch the reference photo
 */
export const getStoredPhoto = async (
    userId: string,
    assessmentId: string
): Promise<{ photoUrl: string | null; source: string }> => {
    console.log(`\n📷 [GET_STORED_PHOTO] Fetching photo for user ${userId}`);

    // Check contestant profile first
    const profile = await profileRepo().findOne({
        where: {
            user: { id: userId },
            assessment: { id: assessmentId },
        },
    });

    if (profile?.idCardUrl) {
        console.log(`   ✅ Found photo from ContestantProfile`);
        return { photoUrl: profile.idCardUrl, source: "contestant_profile" };
    }

    // Check user entity
    const user = await userRepo().findOne({
        where: { id: userId },
    });

    if ((user as any)?.photoUrl) {
        console.log(`   ✅ Found photo from User entity`);
        return { photoUrl: (user as any).photoUrl, source: "user_profile" };
    }

    console.log(`   ⚠️ No stored photo found`);
    return { photoUrl: null, source: "none" };
};

// ============================================
// STORE VERIFICATION RESULT
// ============================================

/**
 * Store the result of face verification (after frontend comparison)
 * Updates session with verification status
 */
export const storeVerificationResult = async (
    sessionId: string,
    isMatch: boolean,
    confidence: number,
    livePhotoUrl: string
): Promise<void> => {
    console.log(`\n✅ [STORE_VERIFICATION] Storing result for session ${sessionId}`);
    console.log(`   Match: ${isMatch}, Confidence: ${confidence}%`);

    // Check if sessionId is a UUID or a token
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId);

    const session = await sessionRepo().findOne({
        where: isUuid ? { id: sessionId } : { sessionToken: sessionId },
    });

    if (!session) {
        throw { status: 404, message: "Session not found" };
    }

    // Update session with verification data
    (session as any).faceVerificationResult = {
        verified: isMatch,
        confidence,
        livePhotoUrl,
        verifiedAt: new Date(),
    };

    await sessionRepo().save(session);

    console.log(`   ✅ Verification result saved to session`);
};
