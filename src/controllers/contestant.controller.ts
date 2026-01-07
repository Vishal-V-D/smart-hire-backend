import { Request, Response } from "express";
import * as otpService from "../services/otp.service";
import * as registrationService from "../services/registration.service";
import * as sessionService from "../services/session.service";
import * as contestantService from "../services/contestant.service";
import multer from "multer";

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Send OTP to email
 * POST /api/contestant/otp/send
 */
export const sendOTP = async (req: Request, res: Response) => {
    try {
        const { email, assessmentId } = req.body;

        if (!email || !assessmentId) {
            return res.status(400).json({
                success: false,
                message: "Email and assessmentId are required",
            });
        }

        const result = await otpService.sendOTP(email, assessmentId);

        res.json({
            success: true,
            message: "OTP sent to your email",
        });
    } catch (error: any) {
        console.error("❌ [OTP_SEND] Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to send OTP",
        });
    }
};

/**
 * Verify OTP
 * POST /api/contestant/otp/verify
 */
export const verifyOTP = async (req: Request, res: Response) => {
    try {
        const { email, otp, assessmentId } = req.body;

        if (!email || !otp || !assessmentId) {
            return res.status(400).json({
                success: false,
                message: "Email, OTP, and assessmentId are required",
            });
        }

        const result = await otpService.verifyOTP(email, otp, assessmentId);

        res.json({
            success: true,
            message: result.message,
        });
    } catch (error: any) {
        console.error("❌ [OTP_VERIFY] Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to verify OTP",
        });
    }
};

/**
 * Submit registration form
 * POST /api/contestant/register
 */
export const submitRegistration = async (req: Request, res: Response) => {
    try {
        const {
            email,
            fullName,
            college,
            department,
            registrationNumber,
            cgpa,
            resumeUrl,
            idCardUrl,
            assessmentId,
        } = req.body;

        console.log("📝 [REGISTER] Received payload:", req.body);

        if (!email || !fullName || !assessmentId) {
            return res.status(400).json({
                success: false,
                message: "Email, fullName, and assessmentId are required",
            });
        }

        const { user, profile, token } = await registrationService.submitRegistration({
            email,
            fullName,
            college,
            department,
            registrationNumber,
            cgpa: cgpa ? parseFloat(cgpa) : undefined,
            resumeUrl,
            idCardUrl,
            assessmentId,
        });

        // Create session
        const session = await sessionService.createSession(user.id, assessmentId);

        res.status(201).json({
            success: true,
            message: "Registration successful",
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
            },
            profile,
            sessionToken: session.sessionToken, // Use for session actions
            token, // Use for protected API calls
        });
    } catch (error: any) {
        console.error("❌ [REGISTRATION] Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to complete registration",
        });
    }
};

/**
 * Upload resume
 * POST /api/contestant/upload/resume
 */
export const uploadResume = [
    upload.single("file"),
    async (req: Request, res: Response) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "No file uploaded",
                });
            }

            const url = await registrationService.uploadFile(
                req.file.buffer,
                req.file.originalname,
                "resume"
            );

            res.json({
                success: true,
                url,
            });
        } catch (error: any) {
            console.error("❌ [UPLOAD_RESUME] Error:", error);
            res.status(500).json({
                success: false,
                message: error.message || "Failed to upload resume",
            });
        }
    },
];

/**
 * Upload ID card
 * POST /api/contestant/upload/id-card
 */
export const uploadIdCard = [
    upload.single("file"),
    async (req: Request, res: Response) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "No file uploaded",
                });
            }

            const url = await registrationService.uploadFile(
                req.file.buffer,
                req.file.originalname,
                "id-card"
            );

            res.json({
                success: true,
                url,
            });
        } catch (error: any) {
            console.error("❌ [UPLOAD_ID_CARD] Error:", error);
            res.status(500).json({
                success: false,
                message: error.message || "Failed to upload ID card",
            });
        }
    },
];

/**
 * Validate session
 * GET /api/contestant/session/validate
 */
export const validateSession = async (req: Request, res: Response) => {
    try {
        const { sessionToken } = req.query;

        if (!sessionToken) {
            return res.status(400).json({
                success: false,
                message: "Session token is required",
            });
        }

        const session = await sessionService.validateSession(sessionToken as string);

        res.json({
            success: true,
            session,
        });
    } catch (error: any) {
        console.error("❌ [SESSION_VALIDATE] Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to validate session",
        });
    }
};

/**
 * Record proctoring consent
 * POST /api/contestant/session/consent
 */
export const recordProctoringConsent = async (req: Request, res: Response) => {
    try {
        const { sessionToken } = req.body;

        if (!sessionToken) {
            return res.status(400).json({
                success: false,
                message: "Session token is required",
            });
        }

        const session = await sessionService.recordProctoringConsent(sessionToken);

        res.json({
            success: true,
            message: "Proctoring consent recorded",
            session,
        });
    } catch (error: any) {
        console.error("❌ [SESSION_CONSENT] Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to record consent",
        });
    }
};

/**
 * Record system checks
 * POST /api/contestant/session/system-check
 */
export const recordSystemChecks = async (req: Request, res: Response) => {
    try {
        const { sessionToken, checks } = req.body;

        if (!sessionToken || !checks) {
            return res.status(400).json({
                success: false,
                message: "Session token and checks are required",
            });
        }

        const session = await sessionService.recordSystemChecks(sessionToken, checks);

        res.json({
            success: true,
            message: "System checks recorded",
            session,
        });
    } catch (error: any) {
        console.error("❌ [SESSION_SYSTEM_CHECK] Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to record system checks",
        });
    }
};

/**
 * Get my assessments
 * GET /api/contestant/assessments
 */
export const getMyAssessments = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const assessments = await contestantService.getMyAssessments(userId);

        res.json({
            success: true,
            assessments,
        });
    } catch (error: any) {
        console.error("❌ [GET_MY_ASSESSMENTS] Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to get assessments",
        });
    }
};

/**
 * Get assessment details
 * GET /api/contestant/assessments/:id
 */
export const getAssessmentDetails = async (req: Request, res: Response) => {
    try {
        console.log("\n📋 [GET_ASSESSMENT_DETAILS] Request received");
        console.log("   Assessment ID:", req.params.id);
        console.log("   User object from auth:", JSON.stringify((req as any).user, null, 2));

        const userId = (req as any).user?.id;
        const { id } = req.params;

        if (!userId) {
            console.error("❌ [GET_ASSESSMENT_DETAILS] No userId in request");
            console.error("   req.user:", (req as any).user);
            return res.status(401).json({
                success: false,
                message: "Unauthorized - No user ID found in token",
            });
        }

        console.log("✅ [GET_ASSESSMENT_DETAILS] Fetching assessment for userId:", userId);

        const assessment = await contestantService.getAssessmentForContestant(id, userId);

        console.log("✅ [GET_ASSESSMENT_DETAILS] Assessment fetched successfully");

        res.json({
            success: true,
            assessment,
        });
    } catch (error: any) {
        console.error("❌ [GET_ASSESSMENT_DETAILS] Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to get assessment details",
        });
    }
};

/**
 * Get sections for assessment
 * GET /api/contestant/assessments/:id/sections
 */
export const getSections = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const sections = await contestantService.getSectionsForContestant(id, userId);

        res.json({
            success: true,
            sections,
        });
    } catch (error: any) {
        console.error("❌ [GET_SECTIONS] Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to get sections",
        });
    }
};

/**
 * Get questions for section
 * GET /api/contestant/assessments/:assessmentId/sections/:sectionId/questions
 */
export const getQuestionsForSection = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { assessmentId, sectionId } = req.params;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const result = await contestantService.getQuestionsForSection(sectionId, assessmentId, userId);

        res.json({
            success: true,
            ...result,
        });
    } catch (error: any) {
        console.error("❌ [GET_QUESTIONS] Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to get questions",
        });
    }
};

/**
 * Start assessment
 * POST /api/contestant/assessments/:id/start
 */
export const startAssessment = async (req: Request, res: Response) => {
    try {
        const { sessionToken } = req.body;

        if (!sessionToken) {
            return res.status(400).json({
                success: false,
                message: "Session token is required",
            });
        }

        const session = await sessionService.startAssessment(sessionToken);

        res.json({
            success: true,
            message: "Assessment started",
            session,
        });
    } catch (error: any) {
        console.error("❌ [START_ASSESSMENT] Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to start assessment",
        });
    }
};
