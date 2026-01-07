import { Request, Response } from "express";
import * as submissionService from "../services/contestSubmission.service";
import * as plagiarismService from "../services/plagiarism.service";

/** 🚀 Submit code */
export const submitCode = async (req: Request, res: Response) => {
    try {
        const { contestId } = req.params;
        const user = (req as any).user;
        const { problemId, code, language, isAutoSubmitted } = req.body;

        if (!code || !problemId || !language) {
            res.status(400).json({ message: "Missing required fields" });
            return;
        }

        const submission = await submissionService.submitCode(
            contestId,
            user.id,
            problemId,
            code,
            language,
            isAutoSubmitted
        );

        res.status(201).json({ message: "Submission received", submission });
    } catch (err: any) {
        res.status(err.status || 500).json({ message: err.message || "Submission failed" });
    }
};

/** 📋 Get user submissions */
export const getUserSubmissions = async (req: Request, res: Response) => {
    try {
        const { contestId, userId } = req.params;
        const submissions = await submissionService.getUserSubmissions(contestId, userId);
        res.json(submissions);
    } catch (err: any) {
        res.status(err.status || 500).json({ message: err.message || "Error fetching submissions" });
    }
};

/** 🎣 Plagiarism Webhook */
export const plagiarismWebhook = async (req: Request, res: Response) => {
    try {
        const data = req.body;
        await plagiarismService.processPlagiarismWebhook(data);
        res.status(200).json({ message: "Webhook processed" });
    } catch (err: any) {
        console.error("Webhook error:", err);
        res.status(500).json({ message: "Error processing webhook" });
    }
};

/** 🔍 Get plagiarism results */
export const getPlagiarismResults = async (req: Request, res: Response) => {
    try {
        const { contestId, userId } = req.params;
        const results = await plagiarismService.getPlagiarismResult(contestId, userId);
        res.json(results);
    } catch (err: any) {
        res.status(err.status || 500).json({ message: err.message || "Error fetching plagiarism results" });
    }
};
