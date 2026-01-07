import { AppDataSource } from "../config/db";
import { AssessmentSubmission } from "../entities/AssessmentSubmission.entity";
import { Assessment } from "../entities/Assessment.entity";
import { AssessmentAnswer } from "../entities/AssessmentAnswer.entity";
import { Question } from "../entities/Question.entity";
import axios from "axios";

const submissionRepo = () => AppDataSource.getRepository(AssessmentSubmission);
const assessmentRepo = () => AppDataSource.getRepository(Assessment);
const answerRepo = () => AppDataSource.getRepository(AssessmentAnswer);
const questionRepo = () => AppDataSource.getRepository(Question);

const PLAGIARISM_SERVICE_URL = process.env.PLAGIARISM_SERVICE_URL || "http://localhost:8000/api/v1";

/**
 * 🔌 Check connection to Plagiarism Service
 */
export const checkServiceConnection = async () => {
    try {
        console.log(`\n🔌 [PLAGIARISM] Connecting to service at ${PLAGIARISM_SERVICE_URL}...`);

        // Fix: Health check is at root /, but SERVICE_URL suggests /api/v1
        // We strip /api/v1 to hit the health endpoint correctly
        const baseUrl = PLAGIARISM_SERVICE_URL.replace(/\/api\/v1\/?$/, "");

        await axios.get(`${baseUrl}/health`);
        console.log(`   ✅ [PLAGIARISM] Connected via ${baseUrl}/health`);
        return true;
    } catch (error: any) {
        console.log(`   ❌ [PLAGIARISM] Service unreachable at ${PLAGIARISM_SERVICE_URL} (${error.message})`);
        return false;
    }
};

/**
 * 🏆 Check plagiarism for final assessment submission
 * Only for CODING PROBLEMS in the assessment
 */
export const checkAssessmentPlagiarism = async (submissionId: string) => {
    try {
        const divider = '='.repeat(60);
        console.log(`\n${divider}`);
        console.log(`🏆 [PLAGIARISM] Initiating assessment submission plagiarism check`);
        console.log(`   Submission ID: ${submissionId}`);
        console.log(`${divider}\n`);

        // Check connection first
        const isConnected = await checkServiceConnection();
        if (!isConnected) {
            console.log(`⚠️ [PLAGIARISM] Processing skipped - Service unavailable`);
            return;
        }

        // Get submission with assessment details
        const submission = await submissionRepo().findOne({
            where: { id: submissionId },
            relations: ["user", "assessment"],
        });

        if (!submission) {
            console.log(`⚠️ [PLAGIARISM] Submission not found: ${submissionId}`);
            return;
        }

        // Get assessment with plagiarism config
        const assessment = await assessmentRepo().findOne({
            where: { id: submission.assessmentId },
        });

        if (!assessment || !assessment.plagiarismConfig?.enabled) {
            console.log(`⚠️ [PLAGIARISM] Plagiarism detection disabled for this assessment`);
            return;
        }

        // Get all answers for this submission
        const answers = await answerRepo().find({
            where: { submissionId },
            relations: ["question", "problem"],
        });

        // Filter only coding answers
        const codingAnswers = answers.filter((a) => {
            // Check either explicitly marked coding question OR a problem entity
            const isCodingQuestion = a.question?.type === "coding";
            const isProblem = !!a.problemId;
            return a.code && a.language && (isCodingQuestion || isProblem);
        });

        if (codingAnswers.length === 0) {
            console.log(`⚠️ [PLAGIARISM] No coding submissions found for plagiarism check`);
            return;
        }

        console.log(`\n📝 [PLAGIARISM] Found ${codingAnswers.length} coding problem(s) for plagiarism check`);

        // Process each coding submission
        for (const answer of codingAnswers) {
            await checkCodingSubmissionPlagiarism(
                submissionId,
                submission,
                answer,
                assessment.plagiarismConfig
            );
        }

        console.log(`\n✅ [PLAGIARISM] Assessment plagiarism check completed`);
        console.log(`${divider}\n`);
    } catch (error: any) {
        console.error(`🚨 [PLAGIARISM] Error checking assessment plagiarism:`, error);
    }
};

/**
 * Check individual coding submission for plagiarism
 */
const checkCodingSubmissionPlagiarism = async (
    submissionId: string,
    submission: AssessmentSubmission,
    answer: any,
    config: any
) => {
    try {
        if (!answer.code) {
            console.log(`⚠️ [PLAGIARISM] Skipping - No code provided`);
            return;
        }

        const plagiarismPayload = {
            submission_id: submissionId,
            user_id: submission.userId,
            username: submission.user?.username || submission.user?.email || "Unknown",
            assessment_id: submission.assessmentId,
            assessment_name: "",  // Will be fetched from assessment
            problem_id: answer.questionId || answer.problemId,
            problem_name: answer.question?.text || answer.problem?.title || "Coding Problem",
            code: answer.code,
            language: answer.language,
            // 🎛️ Pass Configuration
            strictness: config.strictness || "Medium",
            similarity_threshold: config.similarityThreshold || 75,
            ai_sensitivity: config.aiSensitivity || "Medium",
            report_config: config.reportConfig || {
                includeSourceCode: true,
                includeMatches: true,
                includeAiAnalysis: true,
                includeVerdict: true
            }
        };

        const problemName = answer.question?.text || answer.problem?.title || "Coding Problem";
        console.log(`\n   🚀 Checking plagiarism for coding problem: ${problemName}`);
        console.log(`      Language: ${answer.language}`);
        console.log(`      Config: ${config.strictness} | Threshold: ${config.similarityThreshold}%`);

        // Log FULL payload for debugging
        console.log(`   📦 [PLAGIARISM] Sending Payload:`, JSON.stringify(plagiarismPayload, null, 2));

        // Send to plagiarism service
        const response = await axios.post(`${PLAGIARISM_SERVICE_URL}/detect-final`, plagiarismPayload, {
            timeout: 30000, // 30 second timeout
        });

        console.log(`   ✅ [PLAGIARISM] Request Accepted: Status ${response.status}`);
        console.log(`   📬 [PLAGIARISM] Response Data:`, JSON.stringify(response.data, null, 2));

        console.log(`   ✅ Plagiarism check initiated for coding problem`);
    } catch (error: any) {
        console.error(`   ⚠️ Error initiating plagiarism check:`, error.message);
        // Don't throw - we don't want to fail the submission if plagiarism service is down
    }
};

/**
 * Process plagiarism webhook results for assessment submission
 */
export const processPlagiarismWebhook = async (data: any) => {
    const {
        submission_id,
        user_id,
        assessment_id,
        problem_id,
        max_similarity,
        verdict,
        ai_score,
        matches,
        report_path
    } = data;

    console.log(`\n📩 [PLAGIARISM_WEBHOOK] Received Payload for submission ${data.submission_id}:`);
    console.log(JSON.stringify(data, null, 2));

    console.log(`   Verdict: ${verdict} | Similarity: ${max_similarity}% | AI Score: ${ai_score}`);

    try {
        // 1. Update the specific Answer with plagiarism details
        const answer = await answerRepo().findOne({
            where: {
                submissionId: submission_id,
                problemId: problem_id
            }
        });

        if (answer) {
            // Initialize codingResult if missing
            if (!answer.codingResult) answer.codingResult = {} as any;

            // Attach plagiarism data to the answer
            const existingResult = answer.codingResult || {} as any;
            answer.codingResult = {
                language: existingResult.language || answer.language || "unknown",
                code: existingResult.code || answer.code || "",
                passedTests: existingResult.passedTests || 0,
                totalTests: existingResult.totalTests || 0,
                status: existingResult.status || "evaluated",
                score: existingResult.score || 0,
                maxScore: existingResult.maxScore || 0,
                sampleResults: existingResult.sampleResults || [],
                hiddenSummary: existingResult.hiddenSummary,
                plagiarism: {
                    similarity: max_similarity,
                    aiScore: ai_score,
                    verdict: verdict,
                    matches: matches,
                    reportUrl: report_path
                }
            };
            await answerRepo().save(answer);
            console.log(`   ✅ Plagiarism data saved to Answer ${answer.id}`);
        } else {
            console.warn(`   ⚠️ Answer not found for submission ${submission_id} / problem ${problem_id}`);
        }

        // 2. Update Submission Analytics (Overall Summary)
        const submission = await submissionRepo().findOne({
            where: { id: submission_id },
        });

        if (submission) {
            const currentAnalytics: any = submission.analytics || {};
            const currentPlagiarism = currentAnalytics.plagiarism || {
                maxSimilarity: 0,
                maxAiScore: 0,
                verdict: 'Clean',
                flaggedCount: 0
            };

            // Update max stats
            currentPlagiarism.maxSimilarity = Math.max(currentPlagiarism.maxSimilarity, max_similarity);
            currentPlagiarism.maxAiScore = Math.max(currentPlagiarism.maxAiScore, ai_score);
            if (verdict !== 'Clean') {
                currentPlagiarism.flaggedCount++;
                // Upgrade verdict severity if needed (Clean -> Suspicious -> Plagiarized)
                if (verdict === 'Plagiarized') currentPlagiarism.verdict = 'Plagiarized';
                else if (verdict === 'Suspicious' && currentPlagiarism.verdict !== 'Plagiarized') currentPlagiarism.verdict = 'Suspicious';
                else if (verdict === 'AI Generated' && currentPlagiarism.verdict === 'Clean') currentPlagiarism.verdict = 'AI Generated';
            }

            currentAnalytics.plagiarism = currentPlagiarism;
            submission.analytics = currentAnalytics;

            await submissionRepo().save(submission);
            console.log(`   ✅ Submission analytics updated with plagiarism stats`);
        }
    } catch (error: any) {
        console.error(`   ❌ Error processing webhook:`, error.message);
    }
};

/**
 * Get plagiarism detection status for a submission
 */
export const getPlagiarismStatus = async (submissionId: string, userId: string) => {
    try {
        const submission = await submissionRepo().findOne({
            where: { id: submissionId },
        });

        if (!submission) {
            const err: any = new Error("Submission not found");
            err.status = 404;
            throw err;
        }

        // Authorization check
        if (submission.userId !== userId) {
            const err: any = new Error("Unauthorized");
            err.status = 403;
            throw err;
        }

        // Get answers with plagiarism status
        const answers = await answerRepo().find({
            where: { submissionId },
            relations: ["question"],
        });

        const codingAnswers = answers.filter((a) => a.code && a.language && a.question?.type === "coding");

        return {
            submissionId,
            totalCodingProblems: codingAnswers.length,
            plagiarismChecked: submission.submittedAt !== null,
            status: submission.status,
            submittedAt: submission.submittedAt,
        };
    } catch (error) {
        throw error;
    }
};
