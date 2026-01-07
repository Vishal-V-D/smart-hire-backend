import { Request, Response } from "express";
import * as verificationService from "../services/photoVerification.service";

// ============================================
// UPLOAD VERIFICATION PHOTO
// ============================================

/**
 * Upload live verification photo
 * POST /api/contestant/verify/photo
 */
export const uploadVerificationPhoto = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { assessmentId, sessionId, photo } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
        }

        if (!assessmentId || !sessionId || !photo) {
            return res.status(400).json({
                success: false,
                message: "assessmentId, sessionId, and photo (base64) are required",
            });
        }

        console.log(`\n📸 [CTRL] uploadVerificationPhoto: user=${userId}, assessment=${assessmentId}`);

        const result = await verificationService.uploadVerificationPhoto(
            userId,
            assessmentId,
            sessionId,
            photo
        );

        res.json({
            success: true,
            data: result,
        });
    } catch (error: any) {
        console.error("❌ [CTRL] uploadVerificationPhoto error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to upload verification photo",
        });
    }
};

// ============================================
// GET STORED PHOTO
// ============================================

/**
 * Get stored photo for verification
 * GET /api/contestant/verify/stored-photo
 */
export const getStoredPhoto = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { assessmentId } = req.query;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
        }

        if (!assessmentId) {
            return res.status(400).json({
                success: false,
                message: "assessmentId query param is required",
            });
        }

        console.log(`\n📷 [CTRL] getStoredPhoto: user=${userId}, assessment=${assessmentId}`);

        const result = await verificationService.getStoredPhoto(
            userId,
            assessmentId as string
        );

        res.json({
            success: true,
            data: {
                photoUrl: result.photoUrl,
                source: result.source,
                hasPhoto: !!result.photoUrl,
            },
        });
    } catch (error: any) {
        console.error("❌ [CTRL] getStoredPhoto error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to get stored photo",
        });
    }
};

// ============================================
// STORE VERIFICATION RESULT
// ============================================

/**
 * Store face verification result from frontend
 * POST /api/contestant/verify/result
 */
export const storeVerificationResult = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { sessionId, isMatch, confidence, livePhotoUrl } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
        }

        if (!sessionId || isMatch === undefined || confidence === undefined) {
            return res.status(400).json({
                success: false,
                message: "sessionId, isMatch, and confidence are required",
            });
        }

        console.log(`\n✅ [CTRL] storeVerificationResult: session=${sessionId}, match=${isMatch}`);

        await verificationService.storeVerificationResult(
            sessionId,
            isMatch,
            confidence,
            livePhotoUrl
        );

        res.json({
            success: true,
            message: "Verification result stored",
        });
    } catch (error: any) {
        console.error("❌ [CTRL] storeVerificationResult error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to store verification result",
        });
    }
};
