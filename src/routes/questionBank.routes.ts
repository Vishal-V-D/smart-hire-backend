import { Router } from "express";
import * as questionBankCtrl from "../controllers/questionBank.controller";
import * as questionUploadCtrl from "../controllers/questionUpload.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { uploadCSV, uploadZIP } from "../middleware/upload.middleware";

const router = Router();

/**
 * @route   POST /api/question-bank/upload/csv
 * @desc    Upload questions via CSV file
 * @access  Organizer
 */
router.post("/upload/csv", authenticate, authorize("ORGANIZER"), uploadCSV, questionUploadCtrl.uploadQuestionsCSV);

/**
 * @route   POST /api/question-bank/upload/zip
 * @desc    Upload questions via ZIP file (CSV + images)
 * @access  Organizer
 */
router.post("/upload/zip", authenticate, authorize("ORGANIZER"), uploadZIP, questionUploadCtrl.uploadQuestionsZIP);

/**
 * @route   GET /api/question-bank/filter-options
 * @desc    Get unique filter values for dropdowns
 * @access  Organizer
 */
router.get("/filter-options", authenticate, authorize("ORGANIZER"), questionBankCtrl.getFilterOptions);

/**
 * @route   GET /api/question-bank/stats
 * @desc    Get question statistics (counts by division, difficulty, etc.)
 * @access  Organizer
 */
router.get("/stats", authenticate, authorize("ORGANIZER"), questionBankCtrl.getStats);

/**
 * @route   DELETE /api/question-bank/bulk
 * @desc    Bulk delete questions by IDs or filter criteria
 * @access  Organizer
 * @body    { ids: string[] } OR { filter: { division?, subdivision?, difficulty?, topic? } }
 */
router.delete("/bulk", authenticate, authorize("ORGANIZER"), questionBankCtrl.bulkDelete);

/**
 * @route   GET /api/question-bank
 * @desc    List questions with filters and pagination
 * @access  Organizer
 * @query   division, subdivision, subdivisions, topic, tags (comma-separated), difficulty, type, search, page, limit
 */
router.get("/", authenticate, authorize("ORGANIZER"), questionBankCtrl.listQuestions);

/**
 * @route   GET /api/question-bank/:id
 * @desc    Get question by ID
 * @access  Organizer
 */
router.get("/:id", authenticate, authorize("ORGANIZER"), questionBankCtrl.getQuestionById);

/**
 * @route   PATCH /api/question-bank/:id
 * @desc    Update question
 * @access  Organizer
 */
router.patch("/:id", authenticate, authorize("ORGANIZER"), questionBankCtrl.updateQuestion);

/**
 * @route   DELETE /api/question-bank/:id
 * @desc    Delete question
 * @access  Organizer
 */
router.delete("/:id", authenticate, authorize("ORGANIZER"), questionBankCtrl.deleteQuestion);

export default router;
