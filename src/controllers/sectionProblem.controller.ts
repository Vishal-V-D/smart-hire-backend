import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { configureTestCases, getTestCaseConfig } from "../services/sectionProblem.service";

const router = Router();

/**
 * Configure test cases for a problem in an assessment
 * POST /api/section-problems/:sectionProblemId/testcase-config
 * 
 * Body:
 * {
 *   "exampleRange": { "start": 0, "end": 2 },
 *   "hiddenRange": { "start": 0, "end": 9 }
 * }
 * OR
 * {
 *   "exampleIndices": [0, 2, 5],
 *   "hiddenIndices": [1, 3, 8, 12]
 * }
 * OR
 * null (to use all test cases)
 */
router.post(
    "/:sectionProblemId/testcase-config",
    authenticate,
    async (req: Request, res: Response) => {
        try {
            const { sectionProblemId } = req.params;
            const config = req.body;  // Can be null to use all test cases

            console.log(`\n📥 [API] Received test case config request`);
            console.log(`   Section Problem ID: ${sectionProblemId}`);
            console.log(`   Config:`, JSON.stringify(config, null, 2));

            const result = await configureTestCases(sectionProblemId, config);

            res.json(result);
        } catch (error: any) {
            console.error(`❌ [API] Error:`, error.message);
            res.status(error.status || 500).json({
                message: error.message
            });
        }
    }
);

/**
 * Get current test case configuration
 * GET /api/section-problems/:sectionProblemId/testcase-config
 */
router.get(
    "/:sectionProblemId/testcase-config",
    authenticate,
    async (req: Request, res: Response) => {
        try {
            const { sectionProblemId } = req.params;

            const result = await getTestCaseConfig(sectionProblemId);

            res.json(result);
        } catch (error: any) {
            res.status(error.status || 500).json({
                message: error.message
            });
        }
    }
);

export default router;
