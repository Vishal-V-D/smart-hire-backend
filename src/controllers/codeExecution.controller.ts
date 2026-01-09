import { Request, Response } from "express";
import * as codeExecutionService from "../services/codeExecution.service";
import * as submissionService from "../services/assessmentSubmission.service";

/**
 * RUN CODE - Execute against sample testcases only
 * POST /api/code/run
 */
export const runCode = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { problemId, code, language, sectionProblemId } = req.body;

        console.log(`\n🏃 [CODE_RUN] User ${userId} running code for problem ${problemId} (Link: ${sectionProblemId || 'N/A'})`);

        if (!problemId || !code || !language) {
            return res.status(400).json({
                success: false,
                message: "problemId, code, and language are required",
            });
        }

        const result = await codeExecutionService.runCode(problemId, code, language, sectionProblemId);

        res.json(result);
    } catch (error: any) {
        console.error("❌ [CODE_RUN] Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to run code",
        });
    }
};

/**
 * SUBMIT CODE - Execute against sample + hidden testcases
 * POST /api/code/submit
 */
export const submitCode = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { problemId, code, language, assessmentId, sectionId, sectionProblemId } = req.body;

        console.log(`\n📨 [CODE_SUBMIT] User ${userId} submitting code for problem ${problemId}`);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        if (!problemId || !code || !language) {
            return res.status(400).json({
                success: false,
                message: "problemId, code, and language are required",
            });
        }

        const result = await codeExecutionService.submitCode(
            problemId,
            code,
            language,
            userId,
            assessmentId,
            sectionId,
            sectionProblemId // 🎯 Pass the link ID to enable test case filtering
        );

        // ⭐ AUTO-SAVE: If assessmentId is provided, save this result to the active submission
        if (assessmentId) {
            try {
                // Find active submission to get ID
                const submission = await submissionService.getActiveSubmission(assessmentId, userId);
                if (submission) {
                    console.log(`\n💾 [CODE_SUBMIT] Auto-saving result to submission ${submission.id}...`);
                    await submissionService.saveAnswer(
                        submission.id,
                        sectionId, // We need sectionId from body/frontend
                        null,      // questionId
                        problemId,
                        {
                            code,
                            language,
                            marksObtained: (result.score / 100) * (result.maxScore || 100), // Calculate marks based on percentage
                            maxMarks: result.maxScore || 100,
                            markedForReview: false
                            // codingResult is missing here? no, saveAnswer helper doesn't accept codingResult object yet
                            // BUT... we need to save the `codingResult` JSON.
                        }
                    );

                    // ⚠️ `saveAnswer` simplifies and doesn't taking full codingResult object in previous steps.
                    // We must update the answer entity directly or enhance saveAnswer. 
                    // Let's manually update the answer with specific coding details for robustness here.

                    // Actually, let's just use the service to keep it clean, but we might need to update the service to accept `codingResult`.
                    // For now, let's call a specific method or update the entity directly if needed.
                    // OR: Update `submissionService.saveAnswer` to accept `codingResult`.

                    // Let's modify saveAnswer call to pass the result metadata if we can, or do a direct update.
                    // Since I can't modify the service interface in this block easily without risk, 
                    // I will ADD a new dedicated function call to `saveCodingResult` in the service if it existed, 
                    // OR I will simply rely on the fact that `submitAssessment` later will re-evaluate? 
                    // NO, `submitAssessment` re-evaluates. 

                    // PROPER FIX: We should save the coding result NOW so it persists if they leave.
                    // I will add a call to `submissionService.saveCodingAnswer` (we will create/use this).

                    await submissionService.saveCodingResult(
                        submission.id,
                        problemId,
                        {
                            language,
                            code,
                            passedTests: result.summary.passed,
                            totalTests: result.summary.total,
                            status: result.success ? "accepted" : "wrong_answer", // Simplified status
                            score: (result.score / 100) * (result.maxScore || 100),
                            maxScore: result.maxScore || 100,
                            sampleResults: result.sampleResults,
                            hiddenSummary: result.hiddenSummary
                        }
                    );
                    console.log(`   ✅ Result saved to database.`);
                }
            } catch (saveError) {
                console.error(`   ⚠️ Failed to auto-save coding result:`, saveError);
                // Don't fail the execution response, just log warning
            }
        }

        res.json(result);
    } catch (error: any) {
        console.error("❌ [CODE_SUBMIT] Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to submit code",
        });
    }
};
