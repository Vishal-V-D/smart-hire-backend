import { Router } from "express";
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
router.post(
    "/upload/csv",
    authenticate,
    authorize("ORGANIZER"),
    uploadCSV,
    questionUploadCtrl.uploadQuestionsCSV
);

/**
 * @route   POST /api/question-bank/upload/zip
 * @desc    Upload questions via ZIP file (CSV + images)
 * @access  Organizer
 */
router.post(
    "/upload/zip",
    authenticate,
    authorize("ORGANIZER"),
    uploadZIP,
    questionUploadCtrl.uploadQuestionsZIP
);

export default router;
