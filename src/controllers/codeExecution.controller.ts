import { Request, Response } from "express";
import * as codeExecutionService from "../services/codeExecution.service";

/**
 * RUN CODE - Execute against sample testcases only
 * POST /api/code/run
 */
export const runCode = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { problemId, code, language } = req.body;

        console.log(`\n🏃 [CODE_RUN] User ${userId} running code for problem ${problemId}`);

        if (!problemId || !code || !language) {
            return res.status(400).json({
                success: false,
                message: "problemId, code, and language are required",
            });
        }

        const result = await codeExecutionService.runCode(problemId, code, language);

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
        const { problemId, code, language, assessmentId, sectionId } = req.body;

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
            sectionId
        );

        res.json(result);
    } catch (error: any) {
        console.error("❌ [CODE_SUBMIT] Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to submit code",
        });
    }
};
