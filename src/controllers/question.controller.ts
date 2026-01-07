import { Request, Response } from "express";
import * as questionService from "../services/question.service";

// ✅ Update Question
export const updateQuestion = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const question = await questionService.updateQuestion(req.params.id, req.body, user.id);
        res.json(question);
    } catch (err: any) {
        console.error("❌ [UPDATE_QUESTION] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: err.status === 400 ? "VALIDATION_ERROR" : "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};

// ✅ Delete Question
export const deleteQuestion = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        await questionService.deleteQuestion(req.params.id, user.id);
        res.status(204).send();
    } catch (err: any) {
        console.error("❌ [DELETE_QUESTION] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: err.status === 409 ? "CONFLICT" : "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};
