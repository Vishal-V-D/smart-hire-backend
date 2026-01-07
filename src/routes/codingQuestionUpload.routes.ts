import { Router } from "express";
import * as codingQuestionCtrl from "../controllers/codingQuestionUpload.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

// ============================================
// UPLOAD ENDPOINTS (Organizer only)
// ============================================

/**
 * @route   POST /api/coding-questions/upload/json
 * @desc    Upload a single coding question via JSON
 * @access  Organizer
 */
router.post(
    "/upload/json",
    authenticate,
    authorize("ORGANIZER"),
    codingQuestionCtrl.uploadCodingQuestionJSON
);

/**
 * @route   POST /api/coding-questions/upload/json/bulk
 * @desc    Bulk upload coding questions via JSON array
 * @access  Organizer
 */
router.post(
    "/upload/json/bulk",
    authenticate,
    authorize("ORGANIZER"),
    codingQuestionCtrl.uploadCodingQuestionsBulkJSON
);

// ============================================
// READ ENDPOINTS
// ============================================

/**
 * @route   GET /api/coding-questions
 * @desc    List coding questions with filters and pagination
 * @access  Authenticated (public questions for all, private for owner)
 * @query   difficulty, tags, search, skip, take
 */
router.get(
    "/",
    authenticate,
    codingQuestionCtrl.listCodingQuestions
);

/**
 * @route   GET /api/coding-questions/slug/:slug
 * @desc    Get a coding question by slug
 * @access  Authenticated
 */
router.get(
    "/slug/:slug",
    authenticate,
    codingQuestionCtrl.getCodingQuestionBySlug
);

/**
 * @route   GET /api/coding-questions/tags
 * @desc    Get all unique tags
 * @access  Authenticated
 */
router.get(
    "/tags",
    authenticate,
    codingQuestionCtrl.getAllTags
);

/**
 * @route   GET /api/coding-questions/:id
 * @desc    Get a coding question by ID
 * @access  Authenticated
 */
router.get(
    "/:id",
    authenticate,
    codingQuestionCtrl.getCodingQuestionById
);

// ============================================
// UPDATE/DELETE ENDPOINTS (Owner only)
// ============================================

/**
 * @route   PUT /api/coding-questions/:id
 * @desc    Update a coding question
 * @access  Organizer (owner)
 */
router.put(
    "/:id",
    authenticate,
    authorize("ORGANIZER"),
    codingQuestionCtrl.updateCodingQuestion
);

/**
 * @route   DELETE /api/coding-questions/:id
 * @desc    Delete a coding question
 * @access  Organizer (owner)
 */
router.delete(
    "/:id",
    authenticate,
    authorize("ORGANIZER"),
    codingQuestionCtrl.deleteCodingQuestion
);

// ============================================
// SECTION PROBLEM MANAGEMENT
// ============================================

/**
 * @route   GET /api/coding-questions/sections/:sectionId/problems
 * @desc    Get all coding problems in a section
 * @access  Authenticated
 */
router.get(
    "/sections/:sectionId/problems",
    authenticate,
    codingQuestionCtrl.getSectionProblems
);

/**
 * @route   POST /api/coding-questions/sections/:sectionId/problems
 * @desc    Add a coding problem to a section
 * @access  Organizer
 * @body    { problemId: string, marks?: number, order?: number }
 */
router.post(
    "/sections/:sectionId/problems",
    authenticate,
    authorize("ORGANIZER"),
    codingQuestionCtrl.addProblemToSection
);

/**
 * @route   DELETE /api/coding-questions/sections/:sectionId/problems/:problemId
 * @desc    Remove a coding problem from a section
 * @access  Organizer
 */
router.delete(
    "/sections/:sectionId/problems/:problemId",
    authenticate,
    authorize("ORGANIZER"),
    codingQuestionCtrl.removeProblemFromSection
);

export default router;
