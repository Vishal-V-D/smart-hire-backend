import { Request, Response } from "express";
import * as sectionService from "../services/assessmentSection.service";
import * as questionService from "../services/question.service";

// ✅ Update Section
export const updateSection = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const section = await sectionService.updateSection(req.params.id, req.body, user.id);
        res.json(section);
    } catch (err: any) {
        console.error("❌ [UPDATE_SECTION] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: err.status === 400 ? "VALIDATION_ERROR" : "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};

// ✅ Delete Section
export const deleteSection = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        await sectionService.deleteSection(req.params.id, user.id);
        res.status(204).send();
    } catch (err: any) {
        console.error("❌ [DELETE_SECTION] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: err.status === 409 ? "CONFLICT" : "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};

// =====================
// QUESTION ENDPOINTS (nested under section)
// =====================

// ✅ Create Question
export const createQuestion = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const question = await questionService.createQuestion(req.params.sectionId, req.body, user.id);
        res.status(201).json(question);
    } catch (err: any) {
        console.error("❌ [CREATE_QUESTION] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: err.status === 400 ? "VALIDATION_ERROR" : "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};

// ✅ Bulk Create Questions
export const bulkCreateQuestions = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { questions } = req.body;

        if (!Array.isArray(questions)) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "questions must be an array"
                }
            });
        }

        const result = await questionService.bulkCreateQuestions(req.params.sectionId, questions, user.id);
        res.status(201).json(result);
    } catch (err: any) {
        console.error("❌ [BULK_CREATE_QUESTIONS] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: err.status === 400 ? "VALIDATION_ERROR" : "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};

// ✅ List Questions
export const listQuestions = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { type, topic, difficulty, tags } = req.query;

        // Parse tags if provided as comma-separated string
        let parsedTags: string[] | undefined;
        if (typeof tags === "string") {
            parsedTags = tags.split(",").map(t => t.trim()).filter(Boolean);
        } else if (Array.isArray(tags)) {
            parsedTags = tags as string[];
        }

        const questions = await questionService.listQuestions(req.params.sectionId, user.id, {
            type: type as any,
            topic: topic as string,
            difficulty: difficulty as any,
            tags: parsedTags,
        });

        res.json(questions);
    } catch (err: any) {
        console.error("❌ [LIST_QUESTIONS] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};

// ✅ Add SQL Questions to Section
export const addSqlQuestions = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { questionIds } = req.body;

        if (!Array.isArray(questionIds)) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "questionIds must be an array"
                }
            });
        }

        const result = await sectionService.addSqlQuestions(req.params.sectionId, questionIds, user.id);
        res.status(200).json(result);
    } catch (err: any) {
        console.error("❌ [ADD_SQL_QUESTIONS] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: err.status === 400 ? "VALIDATION_ERROR" : "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};
