import { Request, Response } from "express";
import * as submissionService from "../services/assessmentSubmission.service";
import * as plagiarismService from "../services/assessmentPlagiarism.service";

// ============================================
// GET OR CREATE SUBMISSION
// ============================================

/**
 * Get or create active submission
 * POST /api/contestant/assessments/:id/submission
 */
export const getOrCreateSubmission = async (req: Request, res: Response) => {
    try {
        const assessmentId = req.params.id;
        const userId = (req as any).user?.id;
        const { sessionId } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
        }

        console.log(`\n📝 [CTRL] getOrCreateSubmission: assessment=${assessmentId}, user=${userId}`);

        const submission = await submissionService.getOrCreateSubmission(
            assessmentId,
            userId,
            sessionId
        );

        res.json({
            success: true,
            data: {
                submissionId: submission.id,
                status: submission.status,
                startedAt: submission.startedAt,
                maxScore: submission.maxScore,
            },
        });
    } catch (error: any) {
        console.error("❌ [CTRL] getOrCreateSubmission error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to create submission",
        });
    }
};

// ============================================
// SAVE ANSWER
// ============================================

/**
 * Save or update an answer during the test
 * POST /api/contestant/assessments/:id/answers
 */
export const saveAnswer = async (req: Request, res: Response) => {
    try {
        const assessmentId = req.params.id;
        const userId = (req as any).user?.id;
        const {
            submissionId,
            sectionId,
            questionId,
            problemId,
            selectedAnswer,
            code,
            language,
            timeSpent,
            markedForReview,
        } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
        }

        if (!submissionId || !sectionId) {
            return res.status(400).json({
                success: false,
                message: "submissionId and sectionId are required",
            });
        }

        if (!questionId && !problemId) {
            return res.status(400).json({
                success: false,
                message: "Either questionId or problemId is required",
            });
        }

        console.log(`\n💾 [CTRL] saveAnswer: submission=${submissionId}, section=${sectionId}`);
        console.log(`   Question: ${questionId}, Problem: ${problemId}`);

        const answer = await submissionService.saveAnswer(
            submissionId,
            sectionId,
            questionId || null,
            problemId || null,
            {
                selectedAnswer,
                code,
                language,
                timeSpent,
                markedForReview,
            }
        );

        res.json({
            success: true,
            data: {
                answerId: answer.id,
                status: answer.status,
                savedAt: answer.updatedAt,
            },
        });
    } catch (error: any) {
        console.error("❌ [CTRL] saveAnswer error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to save answer",
        });
    }
};

// ============================================
// SUBMIT ASSESSMENT
// ============================================

/**
 * Submit assessment and trigger evaluation
 * POST /api/contestant/assessments/:id/submit
 */
export const submitAssessment = async (req: Request, res: Response) => {
    try {
        const assessmentId = req.params.id;
        const userId = (req as any).user?.id;
        const { submissionId: providedSubmissionId, isAutoSubmit, answers } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
        }

        // Auto-fetch submission if not provided (professional approach)
        let submissionId = providedSubmissionId;
        if (!submissionId) {
            console.log(`\n🔍 [CTRL] submitAssessment: No submissionId provided, fetching for user=${userId}, assessment=${assessmentId}`);
            let activeSubmission = await submissionService.getActiveSubmission(assessmentId, userId);

            // If no submission exists, create one automatically
            if (!activeSubmission) {
                console.log(`\n🆕 [CTRL] No submission found, creating one automatically...`);
                activeSubmission = await submissionService.getOrCreateSubmission(assessmentId, userId);
                console.log(`\n✅ [CTRL] Auto-created submission: ${activeSubmission.id}`);
            } else {
                console.log(`\n✅ [CTRL] Found existing submission: ${activeSubmission.id} (status: ${activeSubmission.status})`);
            }

            submissionId = activeSubmission.id;
        }

        console.log(`\n🚀 [CTRL] submitAssessment: submission=${submissionId}, auto=${isAutoSubmit}`);
        if (answers) console.log(`   With ${answers.length} bulk answers`);

        const submission = await submissionService.submitAssessment(
            submissionId,
            isAutoSubmit || false,
            answers || []
        );

        res.json({
            success: true,
            message: "Assessment submitted successfully",
            data: {
                submissionId: submission.id,
                status: submission.status,
                totalScore: submission.totalScore,
                maxScore: submission.maxScore,
                percentage: submission.percentage,
                submittedAt: submission.submittedAt,
                isAutoSubmitted: submission.isAutoSubmitted,
                sectionScores: submission.sectionScores,
                analytics: submission.analytics,
            },
        });
    } catch (error: any) {
        console.error("❌ [CTRL] submitAssessment error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to submit assessment",
        });
    }
};

// ============================================
// START SECTION
// ============================================

/**
 * Start a specific section (for section-timed assessments)
 * POST /api/contestant/assessments/:id/sections/:sectionId/start
 */
export const startSection = async (req: Request, res: Response) => {
    try {
        const assessmentId = req.params.id;
        const { sectionId } = req.params;
        const userId = (req as any).user?.id;

        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const result = await submissionService.startSection(assessmentId, userId, sectionId);

        res.json({
            success: true,
            message: "Section started",
            data: result
        });
    } catch (error: any) {
        console.error("❌ [CTRL] startSection error:", error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

// ============================================
// GET TIMER
// ============================================

/**
 * Get remaining time for the current session/section
 * GET /api/contestant/assessments/:id/timer
 */
export const getTimer = async (req: Request, res: Response) => {
    try {
        const assessmentId = req.params.id;
        const userId = (req as any).user?.id;

        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        // Auto-create/recover submission for timer if missing (resilience)
        try {
            const timer = await submissionService.getTimer(assessmentId, userId);
            return res.json({
                success: true,
                data: timer
            });
        } catch (error: any) {
            if (error.status === 404) {
                console.log(`\n⚠️ [CTRL] getTimer: Active submission not found, checking for existing submission to resume...`);
                // Attempt to "resume" by getting latest or creating new one if genuinely starting
                const submission = await submissionService.getOrCreateSubmission(assessmentId, userId);

                // Retry getting timer now that submission exists
                const timer = await submissionService.getTimer(assessmentId, userId);
                return res.json({
                    success: true,
                    data: timer
                });
            }
            throw error; // Re-throw other errors
        }
    } catch (error: any) {
        console.error("❌ [CTRL] getTimer error:", error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

// ============================================
// GET SUBMISSION RESULT
// ============================================

/**
 * Get latest submission result for an assessment
 * GET /api/contestant/assessments/:id/submission
 */
export const getSubmissionResult = async (req: Request, res: Response) => {
    try {
        const assessmentId = req.params.id;
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
        }

        console.log(`\n📋 [CTRL] getSubmissionResult: assessment=${assessmentId}, user=${userId}`);

        const submission = await submissionService.getLatestSubmission(
            assessmentId,
            userId
        );

        if (!submission) {
            return res.status(404).json({
                success: false,
                message: "No submission found",
            });
        }

        res.json({
            success: true,
            data: {
                submissionId: submission.id,
                status: submission.status,
                totalScore: submission.totalScore,
                maxScore: submission.maxScore,
                percentage: submission.percentage,
                startedAt: submission.startedAt,
                submittedAt: submission.submittedAt,
                isAutoSubmitted: submission.isAutoSubmitted,
                sectionScores: submission.sectionScores,
                analytics: submission.analytics,
            },
        });
    } catch (error: any) {
        console.error("❌ [CTRL] getSubmissionResult error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to get submission result",
        });
    }
};

// ============================================
// GET SUBMISSION WITH ANSWERS
// ============================================

/**
 * Get detailed submission with all answers
 * GET /api/contestant/assessments/:id/submission/:submissionId
 */
export const getSubmissionDetails = async (req: Request, res: Response) => {
    try {
        const { id: assessmentId, submissionId } = req.params;
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
        }

        console.log(`\n📋 [CTRL] getSubmissionDetails: submission=${submissionId}`);

        const { submission, answers } = await submissionService.getSubmissionWithAnswers(submissionId);

        // Verify ownership
        if (submission.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }

        // Format answers for response
        const formattedAnswers = answers.map(a => ({
            id: a.id,
            sectionId: a.sectionId,
            sectionTitle: a.section?.title,
            questionId: a.questionId,
            problemId: a.problemId,
            questionText: a.question?.text || a.problem?.title,
            selectedAnswer: a.selectedAnswer,
            code: a.code,
            language: a.language,
            isCorrect: a.isCorrect,
            marksObtained: a.marksObtained,
            maxMarks: a.maxMarks,
            status: a.status,
            timeSpent: a.timeSpent,
            codingResult: a.codingResult,
        }));

        res.json({
            success: true,
            data: {
                submission: {
                    id: submission.id,
                    status: submission.status,
                    totalScore: submission.totalScore,
                    maxScore: submission.maxScore,
                    percentage: submission.percentage,
                    startedAt: submission.startedAt,
                    submittedAt: submission.submittedAt,
                    isAutoSubmitted: submission.isAutoSubmitted,
                    sectionScores: submission.sectionScores,
                    analytics: submission.analytics,
                },
                answers: formattedAnswers,
            },
        });
    } catch (error: any) {
        console.error("❌ [CTRL] getSubmissionDetails error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to get submission details",
        });
    }
};

// ============================================
// GET SAVED ANSWERS (Resume Test)
// ============================================

/**
 * Get all saved answers for resuming test
 * GET /api/contestant/assessments/:id/answers
 */
export const getSavedAnswers = async (req: Request, res: Response) => {
    try {
        const assessmentId = req.params.id;
        const userId = (req as any).user?.id;
        const { submissionId } = req.query;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
        }

        if (!submissionId) {
            return res.status(400).json({
                success: false,
                message: "submissionId query param is required",
            });
        }

        console.log(`\n📋 [CTRL] getSavedAnswers: submission=${submissionId}`);

        const answers = await submissionService.getAnswersForSubmission(submissionId as string);

        // Format for frontend
        const formattedAnswers = answers.map(a => ({
            questionId: a.questionId,
            problemId: a.problemId,
            sectionId: a.sectionId,
            selectedAnswer: a.selectedAnswer,
            code: a.code,
            language: a.language,
            status: a.status,
            timeSpent: a.timeSpent,
        }));

        res.json({
            success: true,
            data: formattedAnswers,
        });
    } catch (error: any) {
        console.error("❌ [CTRL] getSavedAnswers error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to get saved answers",
        });
    }
};
// ============================================
// 🕵️ PLAGIARISM DETECTION ENDPOINTS
// ============================================

/**
 * Plagiarism Detection Webhook
 * Called by plagiarism service when plagiarism check is complete
 * POST /api/contestant/assessments/webhook/plagiarism
 */
export const plagiarismWebhook = async (req: Request, res: Response) => {
    try {
        const data = req.body;
        console.log(`\n🪝 [WEBHOOK] Received plagiarism results for submission ${data.submission_id}`);

        await plagiarismService.processPlagiarismWebhook(data);

        res.json({
            success: true,
            message: "Plagiarism results processed successfully",
        });
    } catch (error: any) {
        console.error("❌ [WEBHOOK] Error processing plagiarism webhook:", error);
        res.status(500).json({
            success: false,
            message: "Error processing plagiarism webhook",
        });
    }
};

/**
 * Get plagiarism status for a submission
 * GET /api/contestant/assessments/:id/submissions/:submissionId/plagiarism-status
 */
export const getPlagiarismStatus = async (req: Request, res: Response) => {
    try {
        const { submissionId } = req.params;
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
        }

        const status = await plagiarismService.getPlagiarismStatus(submissionId, userId);

        res.json({
            success: true,
            data: status,
        });
    } catch (error: any) {
        console.error("❌ [CTRL] getPlagiarismStatus error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to get plagiarism status",
        });
    }
};