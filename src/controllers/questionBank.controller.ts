import { Request, Response } from "express";
import * as questionBankService from "../services/questionBank.service";

/**
 * GET /api/question-bank
 * List questions with filters and pagination
 */
export const listQuestions = async (req: Request, res: Response) => {
    try {
        const filters = {
            division: req.query.division as string,
            subdivision: req.query.subdivision as string,
            // Handle multiple subdivisions (comma-separated from frontend)
            subdivisions: req.query.subdivisions
                ? (req.query.subdivisions as string).split(",").map(s => s.trim())
                : undefined,
            topic: req.query.topic as string,
            tags: req.query.tags ? (req.query.tags as string).split(",") : undefined,
            difficulty: req.query.difficulty as any,
            type: req.query.type as any,
            search: req.query.search as string,
            page: req.query.page ? parseInt(req.query.page as string) : 1,
            limit: req.query.limit ? parseInt(req.query.limit as string) : 50
        };

        console.log("📊 [LIST_QUESTIONS] Filters applied:", JSON.stringify(filters, null, 2));

        const result = await questionBankService.listQuestions(filters);

        console.log("✅ [LIST_QUESTIONS] Sending to frontend:", {
            questionCount: result.questions.length,
            pagination: result.pagination,
            firstQuestion: result.questions[0] ? {
                id: result.questions[0].id,
                topic: result.questions[0].topic,
                difficulty: result.questions[0].difficulty,
                division: result.questions[0].division,
                subdivision: result.questions[0].subdivision
            } : null
        });

        res.json(result);
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

/**
 * GET /api/question-bank/filter-options
 * Get unique values for filter dropdowns
 * Pass ?division=Technical to get only Technical subdivisions/topics
 * Pass ?subdivision=SQL to get only topics/tags for that subdivision
 */
export const getFilterOptions = async (req: Request, res: Response) => {
    try {
        // Get division and subdivision from query params for context-aware filtering
        const division = req.query.division as string | undefined;
        const subdivision = req.query.subdivision as string | undefined;

        console.log(`📋 [GET_FILTER_OPTIONS] Request: division=${division || "ALL"}, subdivision=${subdivision || "ALL"}`);

        const options = await questionBankService.getFilterOptions(division, subdivision);

        console.log("✅ [GET_FILTER_OPTIONS] Sending to frontend:", {
            divisionsCount: options.divisions.length,
            subdivisionsCount: options.subdivisions.length,
            topicsCount: options.topics.length,
            tagsCount: options.tags.length,
            divisions: options.divisions,
            subdivisions: options.subdivisions,
            topics: options.topics,
            tags: options.tags
        });

        res.json(options);
    } catch (err: any) {
        console.error("❌ [GET_FILTER_OPTIONS] Error:", err);
        res.status(500).json({
            error: {
                code: "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};

/**
 * GET /api/question-bank/:id
 * Get question by ID
 */
export const getQuestionById = async (req: Request, res: Response) => {
    try {
        const question = await questionBankService.getQuestionById(req.params.id);

        console.log("✅ [GET_QUESTION] Sending to frontend:", {
            id: question.id,
            topic: question.topic,
            difficulty: question.difficulty,
            division: question.division,
            subdivision: question.subdivision,
            optionsCount: question.options?.length || 0
        });

        res.json(question);
    } catch (err: any) {
        console.error("❌ [GET_QUESTION] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: err.status === 404 ? "NOT_FOUND" : "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};

/**
 * PATCH /api/question-bank/:id
 * Update question
 */
export const updateQuestion = async (req: Request, res: Response) => {
    try {
        console.log("📝 [UPDATE_QUESTION] Request:", {
            id: req.params.id,
            updateFields: Object.keys(req.body)
        });

        const question = await questionBankService.updateQuestion(req.params.id, req.body);

        console.log("✅ [UPDATE_QUESTION] Updated successfully:", {
            id: question.id,
            topic: question.topic,
            difficulty: question.difficulty
        });

        res.json(question);
    } catch (err: any) {
        console.error("❌ [UPDATE_QUESTION] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: err.status === 400 ? "VALIDATION_ERROR" : err.status === 404 ? "NOT_FOUND" : "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};

/**
 * DELETE /api/question-bank/:id
 * Delete question
 */
export const deleteQuestion = async (req: Request, res: Response) => {
    try {
        console.log("🗑️  [DELETE_QUESTION] Deleting question:", req.params.id);

        const result = await questionBankService.deleteQuestion(req.params.id);

        console.log("✅ [DELETE_QUESTION] Deleted successfully:", req.params.id);

        res.json(result);
    } catch (err: any) {
        console.error("❌ [DELETE_QUESTION] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: err.status === 404 ? "NOT_FOUND" : "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};

/**
 * GET /api/question-bank/stats
 * Get question statistics
 */
export const getStats = async (req: Request, res: Response) => {
    try {
        console.log("📊 [GET_STATS] Fetching question statistics...");

        const stats = await questionBankService.getStats();

        console.log("✅ [GET_STATS] Sending to frontend:", {
            total: stats.total,
            divisions: Object.keys(stats.byDivision),
            difficulties: Object.keys(stats.byDifficulty)
        });

        res.json(stats);
    } catch (err: any) {
        console.error("❌ [GET_STATS] Error:", err);
        res.status(500).json({
            error: {
                code: "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};

/**
 * DELETE /api/question-bank/bulk
 * Bulk delete questions by IDs or filter
 */
export const bulkDelete = async (req: Request, res: Response) => {
    try {
        const { ids, filter } = req.body;

        console.log("🗑️  [BULK_DELETE] Request:", {
            idsCount: ids?.length || 0,
            filter: filter || "none"
        });

        if (!ids && !filter) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Either 'ids' array or 'filter' object is required"
                }
            });
        }

        const result = await questionBankService.bulkDelete(ids, filter);

        console.log("✅ [BULK_DELETE] Result:", result);

        res.json(result);
    } catch (err: any) {
        console.error("❌ [BULK_DELETE] Error:", err);
        res.status(err.status || 500).json({
            error: {
                code: err.status === 400 ? "VALIDATION_ERROR" : "SERVER_ERROR",
                message: err.message || "Server error"
            }
        });
    }
};
