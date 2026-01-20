import { Request, Response } from "express";
import {
    runSqlQuery,
    submitSqlQuery,
    getSqlQuestion,
    getAllSqlQuestions,
    getSqlFilterOptions,
    updateSqlQuestion,
    deleteSqlQuestion,
} from "../services/sqlExecution.service";
import { SqlDialect } from "../entities/SqlQuestion.entity";

/**
 * @swagger
 * /api/sql/run:
 *   post:
 *     summary: Run SQL query for testing
 *     tags: [SQL]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - questionId
 *               - query
 *             properties:
 *               questionId:
 *                 type: string
 *               query:
 *                 type: string
 *     responses:
 *       200:
 *         description: Query executed successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
export const runSql = async (req: Request, res: Response) => {
    try {
        const { questionId, query } = req.body;

        if (!questionId || !query) {
            return res.status(400).json({
                success: false,
                message: "Question ID and query are required",
            });
        }

        console.log(`\n🔍 Running SQL Query for Question: ${questionId}`);
        console.log(`📝 Query: ${query.substring(0, 100)}...`);

        const result = await runSqlQuery(questionId, query);

        if (!result.success) {
            console.log(`❌ Query execution failed: ${result.error}`);
            return res.status(400).json(result);
        }

        console.log(`✅ Query executed successfully`);
        console.log(`⏱️  Execution time: ${result.executionTime}ms`);
        console.log(`📊 Rows returned: ${result.output?.length || 0}`);

        return res.status(200).json(result);
    } catch (error: any) {
        console.error(`❌ SQL Run Error: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to execute SQL query",
            error: error.message,
        });
    }
};

/**
 * @swagger
 * /api/sql/submit:
 *   post:
 *     summary: Submit SQL query for evaluation
 *     tags: [SQL]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - questionId
 *               - query
 *             properties:
 *               questionId:
 *                 type: string
 *               query:
 *                 type: string
 *     responses:
 *       200:
 *         description: Query submitted and evaluated
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
export const submitSql = async (req: Request, res: Response) => {
    try {
        const { questionId, query } = req.body;

        if (!questionId || !query) {
            return res.status(400).json({
                success: false,
                message: "Question ID and query are required",
            });
        }

        console.log(`\n📤 Submitting SQL Query for Question: ${questionId}`);
        console.log(`📝 Query: ${query.substring(0, 100)}...`);

        const result = await submitSqlQuery(questionId, query);

        if (!result.success) {
            console.log(`❌ Query submission failed: ${result.error}`);
            return res.status(400).json(result);
        }

        console.log(`✅ Query submitted successfully`);
        console.log(`⏱️  Execution time: ${result.executionTime}ms`);
        console.log(`📊 Rows returned: ${result.output?.length || 0}`);
        console.log(`${result.isCorrect ? '✅' : '❌'} Result: ${result.isCorrect ? 'CORRECT' : 'INCORRECT'}`);

        return res.status(200).json(result);
    } catch (error: any) {
        console.error(`❌ SQL Submit Error: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to submit SQL query",
            error: error.message,
        });
    }
};

/**
 * @swagger
 * /api/sql/question/{id}:
 *   get:
 *     summary: Get SQL question by ID
 *     tags: [SQL]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: SQL question retrieved
 *       404:
 *         description: Question not found
 *       500:
 *         description: Server error
 */
export const getSqlQuestionById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const question = await getSqlQuestion(id);

        if (!question) {
            return res.status(404).json({
                success: false,
                message: "SQL question not found",
            });
        }

        // Don't send expected query and result to client
        const { expectedQuery, expectedResult, ...questionData } = question;

        return res.status(200).json({
            success: true,
            question: questionData,
        });
    } catch (error: any) {
        console.error(`❌ Get SQL Question Error: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve SQL question",
            error: error.message,
        });
    }
};

/**
 * @swagger
 * /api/sql/questions:
 *   get:
 *     summary: Get all SQL questions with optional filters
 *     tags: [SQL]
 *     parameters:
 *       - in: query
 *         name: dialect
 *         schema:
 *           type: string
 *           enum: [mysql, postgresql]
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [Easy, Medium, Hard]
 *       - in: query
 *         name: topic
 *         schema:
 *           type: string
 *       - in: query
 *         name: subdivision
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: SQL questions retrieved
 *       500:
 *         description: Server error
 */
export const getSqlQuestions = async (req: Request, res: Response) => {
    try {
        const { dialect, difficulty, topic, subdivision, division } = req.query;

        const filters: any = {};
        if (dialect) filters.dialect = dialect as SqlDialect;
        if (difficulty) filters.difficulty = difficulty as string;
        if (topic) filters.topic = topic as string;
        if (subdivision) filters.subdivision = subdivision as string;
        if (division) filters.division = division as string;

        console.log(`🔍 [GET_SQL_QUESTIONS] Received filters:`, filters);

        const questions = await getAllSqlQuestions(filters);

        // Remove expected query and result from response
        const sanitizedQuestions = questions.map((q) => {
            const { expectedQuery, expectedResult, ...rest } = q;
            return rest;
        });

        console.log(`✅ [GET_SQL_QUESTIONS] Returning ${sanitizedQuestions.length} questions`);

        return res.status(200).json({
            success: true,
            count: sanitizedQuestions.length,
            questions: sanitizedQuestions,
        });
    } catch (error: any) {
        console.error(`❌ Get SQL Questions Error: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve SQL questions",
            error: error.message,
        });
    }
};

/**
 * @swagger
 * /api/sql/filters:
 *   get:
 *     summary: Get filter options for SQL questions
 *     tags: [SQL]
 *     responses:
 *       200:
 *         description: Filter options retrieved
 *       500:
 *         description: Server error
 */
export const getSqlFilters = async (req: Request, res: Response) => {
    try {
        const filters = await getSqlFilterOptions();
        return res.status(200).json({
            success: true,
            filters,
        });
    } catch (error: any) {
        console.error(`❌ Get SQL Filters Error: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve SQL filters",
            error: error.message,
        });
    }
};

/**
 * @swagger
 * /api/sql/question/{id}:
 *   put:
 *     summary: Update SQL question
 *     tags: [SQL]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Question updated successfully
 *       404:
 *         description: Question not found
 *       500:
 *         description: Server error
 */
export const updateSqlQuestionController = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const updatedQuestion = await updateSqlQuestion(id, updateData);

        return res.status(200).json({
            success: true,
            message: "SQL question updated successfully",
            question: updatedQuestion,
        });
    } catch (error: any) {
        console.error(`❌ Update SQL Question Error: ${error.message}`);
        return res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to update SQL question",
        });
    }
};

/**
 * @swagger
 * /api/sql/question/{id}:
 *   delete:
 *     summary: Delete SQL question
 *     tags: [SQL]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Question deleted successfully
 *       404:
 *         description: Question not found
 *       500:
 *         description: Server error
 */
export const deleteSqlQuestionController = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await deleteSqlQuestion(id);

        return res.status(200).json(result);
    } catch (error: any) {
        console.error(`❌ Delete SQL Question Error: ${error.message}`);
        return res.status(error.status || 500).json({
            success: false,
            message: error.message || "Failed to delete SQL question",
        });
    }
};
