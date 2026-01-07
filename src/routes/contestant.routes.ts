import { Router } from "express";
import * as contestantCtrl from "../controllers/contestant.controller";
import * as submissionCtrl from "../controllers/assessmentSubmission.controller";
import * as verifyCtrl from "../controllers/photoVerification.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// ============================================
// OTP ENDPOINTS (Public)
// ============================================

/**
 * @route   POST /api/contestant/otp/send
 * @desc    Send OTP to email
 * @access  Public
 * @body    { email, assessmentId }
 */
router.post("/otp/send", contestantCtrl.sendOTP);

/**
 * @route   POST /api/contestant/otp/verify
 * @desc    Verify OTP
 * @access  Public
 * @body    { email, otp, assessmentId }
 */
router.post("/otp/verify", contestantCtrl.verifyOTP);

// ============================================
// REGISTRATION ENDPOINTS (Public)
// ============================================

/**
 * @route   POST /api/contestant/register
 * @desc    Submit registration form
 * @access  Public
 * @body    { email, fullName, college, department, registrationNumber, cgpa, resumeUrl, idCardUrl, assessmentId, invitationId }
 */
router.post("/register", contestantCtrl.submitRegistration);

/**
 * @route   POST /api/contestant/upload/resume
 * @desc    Upload resume file
 * @access  Public
 */
router.post("/upload/resume", contestantCtrl.uploadResume);

/**
 * @route   POST /api/contestant/upload/id-card
 * @desc    Upload ID card file
 * @access  Public
 */
router.post("/upload/id-card", contestantCtrl.uploadIdCard);

// ============================================
// SESSION ENDPOINTS (Public - uses session token)
// ============================================

/**
 * @route   GET /api/contestant/session/validate
 * @desc    Validate session token
 * @access  Public
 * @query   sessionToken
 */
router.get("/session/validate", contestantCtrl.validateSession);

/**
 * @route   POST /api/contestant/session/consent
 * @desc    Record proctoring consent
 * @access  Public
 * @body    { sessionToken }
 */
router.post("/session/consent", contestantCtrl.recordProctoringConsent);

/**
 * @route   POST /api/contestant/session/system-check
 * @desc    Record system checks
 * @access  Public
 * @body    { sessionToken, checks: { browser, camera, mic, screenShare } }
 */
router.post("/session/system-check", contestantCtrl.recordSystemChecks);

// ============================================
// ASSESSMENT VIEWING ENDPOINTS (Authenticated)
// ============================================

/**
 * @route   GET /api/contestant/assessments
 * @desc    Get my invited assessments
 * @access  Authenticated (Contestant)
 */
router.get("/assessments", authenticate, contestantCtrl.getMyAssessments);

/**
 * @route   GET /api/contestant/assessments/:id
 * @desc    Get assessment details
 * @access  Authenticated (Contestant)
 */
router.get("/assessments/:id", authenticate, contestantCtrl.getAssessmentDetails);

/**
 * @route   GET /api/contestant/assessments/:id/sections
 * @desc    Get sections for assessment
 * @access  Authenticated (Contestant)
 */
router.get("/assessments/:id/sections", authenticate, contestantCtrl.getSections);

/**
 * @route   GET /api/contestant/assessments/:assessmentId/sections/:sectionId/questions
 * @desc    Get questions for section (without answers)
 * @access  Authenticated (Contestant)
 */
router.get(
    "/assessments/:assessmentId/sections/:sectionId/questions",
    authenticate,
    contestantCtrl.getQuestionsForSection
);

// ============================================
// ASSESSMENT TAKING ENDPOINTS
// ============================================

/**
 * @route   POST /api/contestant/assessments/:id/start
 * @desc    Start assessment
 * @access  Public (uses session token)
 * @body    { sessionToken }
 */
router.post("/assessments/:id/start", contestantCtrl.startAssessment);

// ============================================
// SUBMISSION ENDPOINTS (Authenticated)
// ============================================

/**
 * @route   POST /api/contestant/assessments/:id/sections/:sectionId/start
 * @desc    Start timer for a specific section
 * @access  Authenticated (Contestant)
 */
router.post("/assessments/:id/sections/:sectionId/start", authenticate, submissionCtrl.startSection);

/**
 * @route   GET /api/contestant/assessments/:id/timer
 * @desc    Get remaining time (Global or Section)
 * @access  Authenticated (Contestant)
 */
router.get("/assessments/:id/timer", authenticate, submissionCtrl.getTimer);

/**
 * @route   POST /api/contestant/assessments/:id/submission
 * @desc    Get or create active submission for assessment
 * @access  Authenticated (Contestant)
 * @body    { sessionId? }
 */
router.post("/assessments/:id/submission", authenticate, submissionCtrl.getOrCreateSubmission);

/**
 * @route   GET /api/contestant/assessments/:id/submission
 * @desc    Get latest submission result for assessment
 * @access  Authenticated (Contestant)
 */
router.get("/assessments/:id/submission", authenticate, submissionCtrl.getSubmissionResult);

/**
 * @route   GET /api/contestant/assessments/:id/submission/:submissionId
 * @desc    Get detailed submission with all answers
 * @access  Authenticated (Contestant)
 */
router.get("/assessments/:id/submission/:submissionId", authenticate, submissionCtrl.getSubmissionDetails);

/**
 * @route   POST /api/contestant/assessments/:id/answers
 * @desc    Save or update an answer during the test
 * @access  Authenticated (Contestant)
 * @body    { submissionId, sectionId, questionId?, problemId?, selectedAnswer?, code?, language?, timeSpent?, markedForReview? }
 */
router.post("/assessments/:id/answers", authenticate, submissionCtrl.saveAnswer);

/**
 * @route   GET /api/contestant/assessments/:id/answers
 * @desc    Get all saved answers for resuming test
 * @access  Authenticated (Contestant)
 * @query   submissionId
 */
router.get("/assessments/:id/answers", authenticate, submissionCtrl.getSavedAnswers);

/**
 * @route   POST /api/contestant/assessments/:id/submit
 * @desc    Submit assessment and trigger evaluation
 * @access  Authenticated (Contestant)
 * @body    { submissionId, isAutoSubmit? }
 */
router.post("/assessments/:id/submit", authenticate, submissionCtrl.submitAssessment);

// ============================================
// 🕵️ PLAGIARISM DETECTION ENDPOINTS
// ============================================

/**
 * @route   POST /api/contestant/assessments/webhook/plagiarism
 * @desc    Webhook endpoint for plagiarism service to post results
 * @access  Public (Service-to-Service)
 * @body    { submission_id, user_id, assessment_id, problem_id, max_similarity, verdict, ai_score, matches, report_path }
 */
router.post("/assessments/webhook/plagiarism", submissionCtrl.plagiarismWebhook);

/**
 * @route   GET /api/contestant/assessments/:id/submissions/:submissionId/plagiarism-status
 * @desc    Get plagiarism detection status for a submission
 * @access  Authenticated (Contestant)
 */
router.get("/assessments/:id/submissions/:submissionId/plagiarism-status", authenticate, submissionCtrl.getPlagiarismStatus);

// ============================================
// PHOTO VERIFICATION ENDPOINTS (Authenticated)
// ============================================

/**
 * @route   POST /api/contestant/verify/photo
 * @desc    Upload live verification photo
 * @access  Authenticated (Contestant)
 * @body    { assessmentId, sessionId, photo (base64) }
 */
router.post("/verify/photo", authenticate, verifyCtrl.uploadVerificationPhoto);

/**
 * @route   GET /api/contestant/verify/stored-photo
 * @desc    Get stored photo for verification
 * @access  Authenticated (Contestant)
 * @query   assessmentId
 */
router.get("/verify/stored-photo", authenticate, verifyCtrl.getStoredPhoto);

/**
 * @route   POST /api/contestant/verify/result
 * @desc    Store face verification result from frontend
 * @access  Authenticated (Contestant)
 * @body    { sessionId, isMatch, confidence, livePhotoUrl }
 */
router.post("/verify/result", authenticate, verifyCtrl.storeVerificationResult);

export default router;
