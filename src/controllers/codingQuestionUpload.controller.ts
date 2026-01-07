import { Request, Response } from "express";
import * as codingQuestionService from "../services/codingQuestionUpload.service";

/**
 * Upload a single coding question via JSON
 * POST /api/coding-questions/upload/json
 */
export const uploadCodingQuestionJSON = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        console.log(`\n📤 [CODING_QUESTION_UPLOAD] Single JSON upload`);
        console.log(`   User: ${userId}`);
        console.log(`   Title: ${req.body.QuestionTitle || req.body.title || "N/A"}`);

        const result = await codingQuestionService.uploadCodingQuestion(req.body, userId);

        if (result.success) {
            console.log(`   ✅ Created problem: ${result.problem?.id}`);
            res.status(201).json({
                success: true,
                message: "Coding question uploaded successfully",
                problem: result.problem,
            });
        } else {
            console.log(`   ❌ Validation errors:`, result.errors);
            res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: result.errors,
            });
        }
    } catch (error: any) {
        console.error("❌ [CODING_QUESTION_UPLOAD] Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to upload coding question",
        });
    }
};

/**
 * Bulk upload coding questions via JSON array
 * POST /api/coding-questions/upload/json/bulk
 */
export const uploadCodingQuestionsBulkJSON = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const questions = req.body.questions || req.body;
        if (!Array.isArray(questions)) {
            return res.status(400).json({
                success: false,
                message: "Expected an array of questions in 'questions' field or as body",
            });
        }

        console.log(`\n📤 [CODING_QUESTION_UPLOAD] Bulk JSON upload`);
        console.log(`   User: ${userId}`);
        console.log(`   Questions count: ${questions.length}`);

        const result = await codingQuestionService.uploadCodingQuestionsBulk(questions, userId);

        console.log(`   ✅ Success: ${result.success}, Failed: ${result.failed}`);

        res.status(200).json({
            success: true,
            message: `Uploaded ${result.success} of ${result.total} questions`,
            summary: {
                total: result.total,
                success: result.success,
                failed: result.failed,
            },
            problems: result.problems,
            errors: result.errors,
        });
    } catch (error: any) {
        console.error("❌ [CODING_QUESTION_UPLOAD] Bulk Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to bulk upload coding questions",
        });
    }
};

/**
 * List coding questions with filters
 * GET /api/coding-questions
 */
export const listCodingQuestions = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { difficulty, tags, search, skip, take } = req.query;

        console.log(`\n📋 [CODING_QUESTIONS] List`);
        console.log(`   Filters: difficulty=${difficulty}, tags=${tags}, search=${search}`);

        const result = await codingQuestionService.listCodingQuestions({
            userId,
            difficulty: difficulty as string,
            tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined,
            search: search as string,
            skip: skip ? parseInt(skip as string) : 0,
            take: take ? parseInt(take as string) : 20,
        });

        console.log(`   Found: ${result.problems.length} of ${result.total}`);

        res.json({
            success: true,
            ...result,
        });
    } catch (error: any) {
        console.error("❌ [CODING_QUESTIONS] List Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to list coding questions",
        });
    }
};

/**
 * Get a single coding question by ID
 * GET /api/coding-questions/:id
 */
export const getCodingQuestionById = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { id } = req.params;

        console.log(`\n🔍 [CODING_QUESTIONS] Get by ID: ${id}`);

        const problem = await codingQuestionService.getCodingQuestionById(id, userId);

        res.json({
            success: true,
            problem,
        });
    } catch (error: any) {
        console.error("❌ [CODING_QUESTIONS] Get Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to get coding question",
        });
    }
};

/**
 * Get a coding question by slug
 * GET /api/coding-questions/slug/:slug
 */
export const getCodingQuestionBySlug = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { slug } = req.params;

        console.log(`\n🔍 [CODING_QUESTIONS] Get by slug: ${slug}`);

        const problem = await codingQuestionService.getCodingQuestionBySlug(slug, userId);

        res.json({
            success: true,
            problem,
        });
    } catch (error: any) {
        console.error("❌ [CODING_QUESTIONS] Get by Slug Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to get coding question",
        });
    }
};

/**
 * Update a coding question
 * PUT /api/coding-questions/:id
 */
export const updateCodingQuestion = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { id } = req.params;

        console.log(`\n✏️ [CODING_QUESTIONS] Update: ${id}`);

        const problem = await codingQuestionService.updateCodingQuestion(id, req.body, userId);

        res.json({
            success: true,
            message: "Coding question updated successfully",
            problem,
        });
    } catch (error: any) {
        console.error("❌ [CODING_QUESTIONS] Update Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to update coding question",
        });
    }
};

/**
 * Delete a coding question
 * DELETE /api/coding-questions/:id
 */
export const deleteCodingQuestion = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { id } = req.params;

        console.log(`\n🗑️ [CODING_QUESTIONS] Delete: ${id}`);

        await codingQuestionService.deleteCodingQuestion(id, userId);

        res.json({
            success: true,
            message: "Coding question deleted successfully",
        });
    } catch (error: any) {
        console.error("❌ [CODING_QUESTIONS] Delete Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to delete coding question",
        });
    }
};

/**
 * Add a coding problem to a section
 * POST /api/coding-questions/sections/:sectionId/problems
 */
export const addProblemToSection = async (req: Request, res: Response) => {
    try {
        const { sectionId } = req.params;
        const { problemId, marks, order } = req.body;

        console.log(`\n➕ [CODING_QUESTIONS] Add to section: ${sectionId}`);
        console.log(`   Problem: ${problemId}`);

        const sectionProblem = await codingQuestionService.addProblemToSection(
            sectionId,
            problemId,
            marks,
            order
        );

        res.status(201).json({
            success: true,
            message: "Problem added to section",
            sectionProblem,
        });
    } catch (error: any) {
        console.error("❌ [CODING_QUESTIONS] Add to Section Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to add problem to section",
        });
    }
};

/**
 * Remove a coding problem from a section
 * DELETE /api/coding-questions/sections/:sectionId/problems/:problemId
 */
export const removeProblemFromSection = async (req: Request, res: Response) => {
    try {
        const { sectionId, problemId } = req.params;

        console.log(`\n➖ [CODING_QUESTIONS] Remove from section: ${sectionId}`);
        console.log(`   Problem: ${problemId}`);

        await codingQuestionService.removeProblemFromSection(sectionId, problemId);

        res.json({
            success: true,
            message: "Problem removed from section",
        });
    } catch (error: any) {
        console.error("❌ [CODING_QUESTIONS] Remove from Section Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to remove problem from section",
        });
    }
};

/**
 * Get problems in a section
 * GET /api/coding-questions/sections/:sectionId/problems
 */
export const getSectionProblems = async (req: Request, res: Response) => {
    try {
        const { sectionId } = req.params;

        console.log(`\n📋 [CODING_QUESTIONS] Get section problems: ${sectionId}`);

        const problems = await codingQuestionService.getSectionProblems(sectionId);

        res.json({
            success: true,
            problems,
        });
    } catch (error: any) {
        console.error("❌ [CODING_QUESTIONS] Get Section Problems Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to get section problems",
        });
    }
};

/**
 * Get all unique tags
 * GET /api/coding-questions/tags
 */
export const getAllTags = async (req: Request, res: Response) => {
    try {
        console.log(`\n🏷️ [CODING_QUESTIONS] Get all tags`);

        const tags = await codingQuestionService.getAllTags();

        res.json({
            success: true,
            tags,
        });
    } catch (error: any) {
        console.error("❌ [CODING_QUESTIONS] Get Tags Error:", error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to get tags",
        });
    }
};

