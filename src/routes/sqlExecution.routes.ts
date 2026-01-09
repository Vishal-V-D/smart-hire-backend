import { Router } from "express";
import {
    runSql,
    submitSql,
    getSqlQuestionById,
    getSqlQuestions,
} from "../controllers/sqlExecution.controller";

const router = Router();

// Run SQL query (for testing/practice)
router.post("/run", runSql);

// Submit SQL query (for evaluation)
router.post("/submit", submitSql);

// Get SQL question by ID
router.get("/question/:id", getSqlQuestionById);

// Get all SQL questions with filters
router.get("/questions", getSqlQuestions);

export default router;
