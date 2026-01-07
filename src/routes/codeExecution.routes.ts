import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as codeExecutionController from "../controllers/codeExecution.controller";

const router = Router();

// Run code against sample testcases only (can be used by anyone to test)
router.post("/run", authenticate, codeExecutionController.runCode);

// Submit code for evaluation (sample + hidden testcases)
router.post("/submit", authenticate, codeExecutionController.submitCode);

export default router;
