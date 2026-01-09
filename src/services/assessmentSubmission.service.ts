import { AppDataSource } from "../config/db";
import { AssessmentSubmission, SubmissionStatus, SectionScore, SubmissionAnalytics } from "../entities/AssessmentSubmission.entity";
import { AssessmentAnswer, AnswerStatus, CodingResult } from "../entities/AssessmentAnswer.entity";
import { Assessment } from "../entities/Assessment.entity";
import { AssessmentSection, SectionType } from "../entities/AssessmentSection.entity";
import { AssessmentSession } from "../entities/AssessmentSession.entity";
import { Question, QuestionType } from "../entities/Question.entity";
import { Problem } from "../entities/problem.entity";
import { SectionProblem } from "../entities/SectionProblem.entity";
import * as codeExecutionService from "./codeExecution.service";
import * as plagiarismService from "./assessmentPlagiarism.service";

const submissionRepo = () => AppDataSource.getRepository(AssessmentSubmission);
const answerRepo = () => AppDataSource.getRepository(AssessmentAnswer);
const assessmentRepo = () => AppDataSource.getRepository(Assessment);
const sectionRepo = () => AppDataSource.getRepository(AssessmentSection);
const questionRepo = () => AppDataSource.getRepository(Question);
const problemRepo = () => AppDataSource.getRepository(Problem);
const sectionProblemRepo = () => AppDataSource.getRepository(SectionProblem);
const sessionRepo = () => AppDataSource.getRepository(AssessmentSession);

// ============================================
// GET OR CREATE SUBMISSION
// ============================================

/**
 * Get active submission or create a new one
 */
export const getOrCreateSubmission = async (
    assessmentId: string,
    userId: string,
    sessionId?: string
): Promise<AssessmentSubmission> => {
    console.log(`\n📝 [SUBMISSION] Getting/creating submission for user ${userId}, assessment ${assessmentId}`);
    if (sessionId) console.log(`   Session ID provided: ${sessionId}`);

    // Check for ANY existing submission for this user/assessment
    const existingSubmission = await submissionRepo().findOne({
        where: {
            assessmentId,
            userId,
        },
        order: { createdAt: "DESC" }, // Get the latest one
        relations: ["assessment"],
    });

    if (existingSubmission) {
        // 1. If currently in progress, resume it
        if (existingSubmission.status === SubmissionStatus.IN_PROGRESS) {
            console.log(`   ✅ Found active IN_PROGRESS submission: ${existingSubmission.id}, Resuming...`);
            return existingSubmission;
        }

        // 2. If already submitted or evaluated, BLOCK new attempt (Strict Mode)
        if (existingSubmission.status === SubmissionStatus.SUBMITTED || existingSubmission.status === SubmissionStatus.EVALUATED) {
            console.log(`   🛑 User ${userId} has already completed assessment ${assessmentId}. Blocking retake.`);
            throw {
                status: 403,
                message: "You have already completed this assessment. Retakes are not allowed."
            };
        }
    }

    // Fetch assessment details for maxScore calculation
    const assessment = await assessmentRepo().findOne({
        where: { id: assessmentId },
        relations: ["sections", "sections.questions", "sections.problems"],
    });

    if (!assessment) {
        throw { status: 404, message: "Assessment not found" };
    }

    // Calculate max score from all sections
    let maxScore = 0;
    for (const section of assessment.sections || []) {
        // MCQ questions
        if (section.questions) {
            for (const q of section.questions) {
                maxScore += q.marks || section.marksPerQuestion || 1;
            }
        }
        // Coding problems
        if (section.problems) {
            for (const sp of section.problems as any[]) {
                maxScore += sp.marks || 100; // Default 100 for coding
            }
        }
    }

    // Validate sessionId format - must be UUID (36 chars), not hash
    let validSessionId: string | undefined = undefined;
    if (sessionId) {
        // UUID format: 8-4-4-4-12 = 36 chars total (with hyphens)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(sessionId)) {
            validSessionId = sessionId;
            console.log(`   ✅ Valid session UUID format`);
        } else {
            console.log(`   ⚠️ Invalid session ID format (expected UUID, got: ${sessionId.length} chars), skipping...`);
        }
    }

    // Find first section to auto-start timer (Prevent "peeking" without timer)
    const firstSection = assessment.sections?.sort((a, b) => (a.order || 0) - (b.order || 0))[0];

    // Create new submission
    const newSubmission = submissionRepo().create({
        assessment: { id: assessmentId } as any,
        user: { id: userId } as any,
        session: validSessionId ? { id: validSessionId } as any : null,
        assessmentId,
        userId,
        sessionId: validSessionId || undefined,
        status: SubmissionStatus.IN_PROGRESS,
        startedAt: new Date(),
        totalScore: 0,
        maxScore,
        percentage: 0,
        // ⭐ Auto-start first section if available
        currentSectionId: firstSection?.id,
        sectionStartedAt: firstSection ? new Date() : undefined
    });

    await submissionRepo().save(newSubmission);
    console.log(`   Created new submission: ${newSubmission.id}, maxScore: ${maxScore}`);

    if (firstSection) {
        console.log(`   ⏱️ [AUTO_START] Automatically started timer for first section: ${firstSection.title}`);
    }

    return newSubmission;
};

// ============================================
// GET ACTIVE SUBMISSION
// ============================================

/**
 * Get active (in-progress) submission for a user and assessment
 * Falls back to most recent submission if in-progress not found
 * Used internally to avoid requiring frontend to pass submissionId
 */
export const getActiveSubmission = async (
    assessmentId: string,
    userId: string
): Promise<AssessmentSubmission | null> => {
    console.log(`\n🔍 [SUBMISSION] Looking for active submission: user=${userId}, assessment=${assessmentId}`);

    // First, try to find IN_PROGRESS submission
    const inProgressSubmission = await submissionRepo().findOne({
        where: {
            assessmentId,
            userId,
            status: SubmissionStatus.IN_PROGRESS,
        },
    });

    if (inProgressSubmission) {
        console.log(`   ✅ Found active IN_PROGRESS submission: ${inProgressSubmission.id}`);
        return inProgressSubmission;
    }

    console.log(`   ⏳ No IN_PROGRESS submission found, looking for most recent submission...`);

    // Fallback: get most recent submission (regardless of status)
    // This allows users to resubmit if needed
    const recentSubmission = await submissionRepo().findOne({
        where: {
            assessmentId,
            userId,
        },
        order: { createdAt: "DESC" },
    });

    if (recentSubmission) {
        console.log(`   ✅ Found recent submission (${recentSubmission.status}): ${recentSubmission.id}`);
        return recentSubmission;
    }

    console.log(`   ❌ No submission found at all`);
    return null;
};

// ============================================
// START SECTION
// ============================================
export const startSection = async (assessmentId: string, userId: string, sectionId: string) => {
    const submission = await getOrCreateSubmission(assessmentId, userId);

    // Validations: Check if assessment is section-timed
    const assessment = submission.assessment;
    // We assume 'assessment' relation is loaded in getOrCreateRequest or similar, 
    // if not, we might need explicitly loading it. 
    // getOrCreateSubmission returns submission with assessment relation.

    // If global time, starting section just updates current pointer (no timer reset)
    // If section time, we set sectionStartedAt IF not set for this section

    // Simple state update
    // Simple state update
    // Check if we are switching to a new section (must check BEFORE updating currentSectionId)
    const isNewSection = submission.currentSectionId !== sectionId;

    // Handle timer for previous section if switching
    if (isNewSection && submission.currentSectionId && submission.sectionStartedAt) {
        const prevSectionId = submission.currentSectionId;
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - submission.sectionStartedAt.getTime()) / 1000);

        submission.sectionUsage = submission.sectionUsage || {};
        submission.sectionUsage[prevSectionId] = (submission.sectionUsage[prevSectionId] || 0) + elapsed;

        console.log(`   ⏸️ [TIMER] Paused section ${prevSectionId}, added ${elapsed}s. Total used: ${submission.sectionUsage[prevSectionId]}s`);
    }

    // Simple state update
    submission.currentSectionId = sectionId;

    // Trigger explicit timer reset/start for the new section
    // If it's a new section, we MUST reset the timer start point to NOW
    if (isNewSection) {
        submission.sectionStartedAt = new Date();
        console.log(`   ⏱️ [TIMER] Started timer for NEW section ${sectionId} at ${submission.sectionStartedAt.toISOString()}`);
    } else if (!submission.sectionStartedAt) {
        // If same section but oddly no timer running (resumed from idle?), start it
        submission.sectionStartedAt = new Date();
        console.log(`   ⏱️ [TIMER] Resumed timer for section ${sectionId} at ${submission.sectionStartedAt.toISOString()}`);
    } else {
        console.log(`   ℹ️ [TIMER] Timer already running for section ${sectionId}`);
    }

    await submissionRepo().save(submission);
    return {
        currentSectionId: sectionId,
        sectionStartedAt: submission.sectionStartedAt
    };
};

// ============================================
// GET TIMER
// ============================================
export const getTimer = async (assessmentId: string, userId: string) => {
    const submission = await submissionRepo().findOne({
        where: { assessmentId, userId, status: SubmissionStatus.IN_PROGRESS }, // Only active ones
        relations: ["assessment", "assessment.sections"]
    });

    if (!submission) {
        throw { status: 404, message: "No active submission found" };
    }

    const now = new Date();
    const assessment = submission.assessment;

    // Sort sections safely
    const sections = assessment.sections?.sort((a, b) => (a.order || 0) - (b.order || 0)) || [];

    // Global Timer Calculation
    const globalLimit = assessment.duration || assessment.globalTime || 0;
    const globalStartedAt = submission.startedAt ? new Date(submission.startedAt) : now;
    const globalElapsed = Math.floor((now.getTime() - globalStartedAt.getTime()) / 1000);
    const globalTotalTime = globalLimit * 60;
    const globalTimeLeft = globalLimit > 0 ? Math.max(0, globalTotalTime - globalElapsed) : -1;

    // Per-Section Timer Calculation
    const sectionTimers = sections.map(section => {
        const limitMinutes = section.timeLimit || 0;
        const totalDuration = limitMinutes * 60;

        // Get accumulated time from sectionUsage
        let accumulated = 0;
        if (submission.sectionUsage && submission.sectionUsage[section.id]) {
            accumulated = submission.sectionUsage[section.id];
        }

        let currentElapsed = 0;
        let isRunning = false;

        // If this is the currently active section, and timer is started, add real-time elapsed
        if (submission.currentSectionId === section.id && submission.sectionStartedAt) {
            const startedAt = new Date(submission.sectionStartedAt);
            currentElapsed = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
            isRunning = true;
        }

        let totalUsed = accumulated + currentElapsed;

        // Cap at limit if not unlimited
        if (limitMinutes > 0 && totalUsed > totalDuration) {
            totalUsed = totalDuration;
        }

        const timeLeft = limitMinutes > 0 ? Math.max(0, totalDuration - totalUsed) : -1;

        // Determine status
        let status = "idle";
        if (limitMinutes > 0 && timeLeft === 0) {
            status = "expired";
        } else if (isRunning) {
            status = "running";
        } else if (totalUsed > 0 && totalUsed < totalDuration) {
            status = "paused";
        } else if (totalUsed === 0) {
            // Explicit idle state: timeLeft should be full duration for UI consistency
            // Logic was already: timeLeft = Total - 0 = Total. Correct.
        }

        return {
            sectionId: section.id,
            sectionTitle: section.title,
            limitMinutes,
            timeLeft: timeLeft >= 0 ? timeLeft : 0,
            timeUsed: totalUsed,
            totalTime: totalDuration,
            status
        };
    });

    // Compatibility return (Root level fields based on mode)
    let mode = assessment.timeMode === "section" ? "section" : "global";
    let mainStatus = "idle"; // Default to idle
    let mainTimeLeft = 0;
    let mainTotalTime = 0;
    let mainTimeUsed = 0;
    let mainExpiresAt = null;
    let mainStartedAt = submission.startedAt ? submission.startedAt.toISOString() : now.toISOString();

    if (mode === "section") {
        const currentTimer = sectionTimers.find(s => s.sectionId === submission.currentSectionId);
        if (currentTimer) {
            mainTimeLeft = currentTimer.timeLeft >= 0 ? currentTimer.timeLeft : 0; // Avoid -1 in main response if unwanted
            mainTimeUsed = currentTimer.timeUsed;
            mainTotalTime = currentTimer.totalTime;
            mainStatus = currentTimer.status;

            // Calculate strictly when it expires based on NOW
            if (mainTimeLeft > 0) {
                // If running, expire = now + left. If paused, expire = now + left (but actually inaccurate if paused)
                // Better: if running, expire = now + left. If paused, expire = null (or arbitrary future)
                mainExpiresAt = new Date(now.getTime() + mainTimeLeft * 1000).toISOString();
            }
            if (submission.sectionStartedAt) {
                mainStartedAt = submission.sectionStartedAt.toISOString();
            }
        } else {
            // IDLE / NO SELECTION STATE
            // Show stats of FIRST section by default to avoid showing "0 0"
            // This is "idle" mode, showing initial capacity
            if (sectionTimers.length > 0) {
                mainTotalTime = sectionTimers[0].totalTime;
                mainTimeLeft = sectionTimers[0].timeLeft > 0 ? sectionTimers[0].timeLeft : mainTotalTime;
                mainStatus = "idle";
                // expiresAt is null because not started
            } else {
                mainStatus = "idle";
                mainTimeLeft = 0;
            }
        }
    } else {
        // Global
        mainTimeLeft = globalTimeLeft >= 0 ? globalTimeLeft : 0;
        mainTimeUsed = globalElapsed;
        mainTotalTime = globalTotalTime;
        mainStatus = mainTimeLeft === 0 && globalLimit > 0 ? "expired" : "running";
        if (mainTimeLeft > 0) {
            mainExpiresAt = new Date(now.getTime() + mainTimeLeft * 1000).toISOString();
        }
    }

    // 🔍 [DEBUG] Log timer status for monitoring validation
    if (mode === "section") {
        const currentTimer = sectionTimers.find(s => s.sectionId === submission.currentSectionId);
        if (currentTimer) {
            console.log(`   ⏱️ [TIMER] Section '${currentTimer.sectionTitle}': Used ${currentTimer.timeUsed}/${currentTimer.totalTime}s | Global: Used ${globalElapsed}/${globalTotalTime}s`);
        }
    } else {
        console.log(`   ⏱️ [TIMER] Global: Used ${globalElapsed}/${globalTotalTime}s`);
    }

    return {
        mode,
        status: mainStatus,
        timeLeft: mainTimeLeft,
        timeUsed: mainTimeUsed,
        totalTime: mainTotalTime,
        startedAt: mainStartedAt,
        expiresAt: mainExpiresAt,
        sectionId: submission.currentSectionId,
        // 👇 New field to easily see both times in API response (Network Tab)
        displayInfo: `Section Used: ${mainTimeUsed}s | Global Used: ${globalElapsed}s`,
        // Detailed breakdown for strict/proper handling
        global: {
            timeLeft: globalTimeLeft,
            timeUsed: globalElapsed,
            totalTime: globalTotalTime,
            status: globalTimeLeft === 0 && globalLimit > 0 ? "expired" : "running"
        },
        sections: sectionTimers
    };
};

// ============================================
// SAVE ANSWER (During Test)
// ============================================

/**
 * Save or update an answer during the test
 * ⭐ Now accepts marks directly from frontend
 */
export const saveAnswer = async (
    submissionId: string,
    sectionId: string,
    questionId: string | null,
    problemId: string | null,
    answer: {
        selectedAnswer?: string | string[];
        code?: string;
        language?: string;
        timeSpent?: number;
        markedForReview?: boolean;
        marksObtained?: number;  // ⭐ Frontend-provided marks
        maxMarks?: number;        // ⭐ Frontend-provided max marks
    }
): Promise<AssessmentAnswer> => {
    console.log(`\n💾 [SAVE_ANSWER] Saving answer for submission ${submissionId}`);
    console.log(`   Section: ${sectionId}, Question: ${questionId}, Problem: ${problemId}`);

    // Log code submission details specifically
    if (answer.code) {
        console.log(`   💻 [CODE_SUBMISSION] Received code:`);
        console.log(`      Language: ${answer.language}`);
        console.log(`      Length: ${answer.code.length} chars`);
        console.log(`      Snippet: ${answer.code.substring(0, 50).replace(/\n/g, ' ')}...`);
    }

    if (answer.marksObtained !== undefined) {
        console.log(`   ⭐ Frontend marks: ${answer.marksObtained}/${answer.maxMarks}`);
    }

    // 🕒 [STRICT] Verify Time Limit
    const submission = await submissionRepo().findOne({
        where: { id: submissionId },
        relations: ["assessment", "assessment.sections"]
    });

    if (!submission) throw { status: 404, message: "Submission not found" };

    const assessment = submission.assessment;
    const now = new Date();
    const GRACE_PERIOD_SECONDS = 10; // Allow 10s grace for network latency

    if (assessment.timeMode === "section") {
        const section = assessment.sections?.find(s => s.id === sectionId);
        if (section && section.timeLimit && section.timeLimit > 0) {
            const totalLimit = section.timeLimit * 60;
            let accumulated = (submission.sectionUsage && submission.sectionUsage[sectionId]) || 0;

            // If currently active, add elapsed
            if (submission.currentSectionId === sectionId && submission.sectionStartedAt) {
                const elapsed = Math.floor((now.getTime() - submission.sectionStartedAt.getTime()) / 1000);
                accumulated += elapsed;
            }

            if (accumulated > (totalLimit + GRACE_PERIOD_SECONDS)) {
                console.warn(`   ⚠️ [STRICT] Save rejected: Section time expired. Used: ${accumulated}s, Limit: ${totalLimit}s`);
                throw { status: 403, message: "Section time has expired. Answer cannot be saved." };
            }
        }
    } else {
        // Global Check
        const limit = assessment.duration || assessment.globalTime || 0;
        if (limit > 0) {
            const start = submission.startedAt ? new Date(submission.startedAt) : now;
            const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000);
            const totalLimit = limit * 60;

            if (elapsed > (totalLimit + GRACE_PERIOD_SECONDS)) {
                console.warn(`   ⚠️ [STRICT] Save rejected: Assessment time expired. Used: ${elapsed}s, Limit: ${totalLimit}s`);
                throw { status: 403, message: "Assessment time has expired. Answer cannot be saved." };
            }
        }
    }

    // Find existing answer
    let existingAnswer: AssessmentAnswer | null = null;
    if (questionId) {
        existingAnswer = await answerRepo().findOne({
            where: { submissionId, questionId },
        });
    } else if (problemId) {
        existingAnswer = await answerRepo().findOne({
            where: { submissionId, problemId },
        });
    }

    if (existingAnswer) {
        // Update existing
        if (answer.selectedAnswer !== undefined) {
            existingAnswer.selectedAnswer = answer.selectedAnswer;
            existingAnswer.status = answer.markedForReview
                ? AnswerStatus.MARKED_FOR_REVIEW
                : AnswerStatus.ATTEMPTED;
        }
        if (answer.code !== undefined) {
            existingAnswer.code = answer.code;
            existingAnswer.language = answer.language || existingAnswer.language;
            existingAnswer.status = AnswerStatus.ATTEMPTED;
        }
        if (answer.timeSpent !== undefined) {
            existingAnswer.timeSpent += answer.timeSpent;
        }
        // ⭐ Update marks from frontend if provided
        if (answer.marksObtained !== undefined) {
            existingAnswer.marksObtained = answer.marksObtained;
            console.log(`   ⭐ Updated marksObtained to ${answer.marksObtained}`);
        }
        if (answer.maxMarks !== undefined) {
            existingAnswer.maxMarks = answer.maxMarks;
            console.log(`   ⭐ Updated maxMarks to ${answer.maxMarks}`);
        }

        await answerRepo().save(existingAnswer);
        console.log(`   Updated existing answer: ${existingAnswer.id}`);
        return existingAnswer;
    }

    // Get max marks for this question/problem
    // ⭐ Prefer frontend-provided maxMarks, fallback to database
    let maxMarks = answer.maxMarks || 1;
    if (!answer.maxMarks) {
        if (questionId) {
            const question = await questionRepo().findOne({
                where: { id: questionId },
                relations: ["section"],
            });
            maxMarks = question?.marks || question?.section?.marksPerQuestion || 1;
        } else if (problemId) {
            const sectionProblem = await sectionProblemRepo().findOne({
                where: { problem: { id: problemId }, section: { id: sectionId } },
            });
            maxMarks = sectionProblem?.marks || 100;
        }
    }

    // Create new answer
    const newAnswer = answerRepo().create({
        submission: { id: submissionId } as any,
        section: { id: sectionId } as any,
        question: questionId ? { id: questionId } as any : undefined,
        problem: problemId ? { id: problemId } as any : undefined,
        submissionId,
        sectionId,
        questionId: questionId || undefined,
        problemId: problemId || undefined,
        selectedAnswer: answer.selectedAnswer || null,
        code: answer.code || undefined,
        language: answer.language || undefined,
        status: answer.markedForReview
            ? AnswerStatus.MARKED_FOR_REVIEW
            : answer.selectedAnswer || answer.code
                ? AnswerStatus.ATTEMPTED
                : AnswerStatus.UNATTEMPTED,
        maxMarks,
        marksObtained: answer.marksObtained !== undefined ? answer.marksObtained : null,  // ⭐ Use frontend marks if provided, else null
        timeSpent: answer.timeSpent || 0,
    });

    if (answer.marksObtained !== undefined) {
        console.log(`   ⭐ Created answer with frontend marks: ${answer.marksObtained}/${maxMarks}`);
    }

    await answerRepo().save(newAnswer);
    console.log(`   Created new answer: ${newAnswer.id}`);

    return newAnswer;
};

/**
 * Save detailed coding execution result
 */
export const saveCodingResult = async (
    submissionId: string,
    problemId: string,
    resultData: any
): Promise<AssessmentAnswer> => {
    // Check if submission exists
    const submission = await submissionRepo().findOne({
        where: { id: submissionId },
        relations: ["assessment", "assessment.sections"]
    });
    if (!submission) throw { status: 404, message: "Submission not found" };

    // Find or init answer for this problem
    let answer = await answerRepo().findOne({
        where: {
            submissionId: submissionId,
            problemId: problemId
        },
        relations: ["section"]
    });

    // Get the actual marks allocated to this problem from SectionProblem
    let actualMaxMarks = 10; // Default fallback
    if (answer?.sectionId) {
        const sectionProblem = await sectionProblemRepo().findOne({
            where: {
                problem: { id: problemId },
                section: { id: answer.sectionId }
            }
        });
        actualMaxMarks = sectionProblem?.marks || 10;
    }

    if (!answer) {
        // Need to create new if not exists (should already exist if they viewed question, but safety first)
        answer = answerRepo().create({
            submissionId,
            problemId,
            status: AnswerStatus.ATTEMPTED,
            maxMarks: actualMaxMarks
        });
    } else {
        // Update maxMarks to ensure it's correct
        answer.maxMarks = actualMaxMarks;
    }

    // 🎯 CRITICAL FIX: Convert percentage score (0-100) to actual marks
    // resultData.score is always 0-100 (percentage of test cases passed)
    // We need to convert it to actual marks based on the problem's allocated marks
    const percentageScore = resultData.score; // 0-100
    const actualMarksObtained = (percentageScore / 100) * actualMaxMarks;

    console.log(`   🎯 [SCORE_CONVERSION] Problem ${problemId}:`);
    console.log(`      Percentage Score: ${percentageScore}/100`);
    console.log(`      Allocated Marks: ${actualMaxMarks}`);
    console.log(`      Actual Marks Obtained: ${actualMarksObtained.toFixed(2)}`);

    // Update with full coding details
    answer.code = resultData.code;
    answer.language = resultData.language;
    answer.codingResult = {
        code: resultData.code,
        language: resultData.language,
        passedTests: resultData.passedTests,
        totalTests: resultData.totalTests,
        status: resultData.status,
        score: percentageScore, // Keep percentage for reference
        maxScore: 100, // This is always 100 (percentage)
        sampleResults: resultData.sampleResults,
        hiddenSummary: resultData.hiddenSummary
    };
    answer.marksObtained = actualMarksObtained; // ✅ Use converted marks, not percentage
    answer.isCorrect = percentageScore === 100; // 100% means all test cases passed
    answer.status = AnswerStatus.ATTEMPTED; // Mark as attempted so it shows in report

    await answerRepo().save(answer);
    console.log(`   💾 [SAVE_CODING_RESULT] Updated problem ${problemId} with score ${actualMarksObtained.toFixed(2)}/${actualMaxMarks} (${percentageScore}% of test cases)`);

    return answer;
};

// ============================================
// SUBMIT ASSESSMENT (Final Submit)
// ============================================

/**
 * Submit the entire assessment and evaluate all answers
 */
export const submitAssessment = async (
    submissionId: string,
    isAutoSubmit: boolean = false,
    newAnswers: any[] = [] // Optional bulk answers to save before evaluation
): Promise<AssessmentSubmission> => {
    console.log(`\n🚀 [SUBMIT] Submitting assessment ${submissionId}, auto=${isAutoSubmit}`);
    console.log(`   Received ${newAnswers?.length || 0} answers to save before evaluation`);

    const submission = await submissionRepo().findOne({
        where: { id: submissionId },
        relations: ["assessment", "assessment.sections"],
    });

    if (!submission) {
        throw { status: 404, message: "Submission not found" };
    }

    if (submission.status === SubmissionStatus.SUBMITTED || submission.status === SubmissionStatus.EVALUATED) {
        throw { status: 400, message: "Assessment already submitted" };
    }

    // Save provided answers if any
    if (newAnswers && newAnswers.length > 0) {
        console.log(`   💾 [SUBMIT] Saving ${newAnswers.length} final answers...`);
        for (const ans of newAnswers) {
            try {
                await saveAnswer(
                    submissionId,
                    ans.sectionId,
                    ans.questionId || null,
                    ans.problemId || null,
                    {
                        selectedAnswer: ans.selectedAnswer,
                        code: ans.code,
                        language: ans.language,
                        timeSpent: ans.timeSpent,
                        markedForReview: ans.markedForReview,
                        marksObtained: ans.marksObtained,  // ⭐ Frontend marks
                        maxMarks: ans.maxMarks              // ⭐ Frontend max marks
                    }
                );
            } catch (err: any) {
                console.error(`   ⚠️ Failed to save answer for Q=${ans.questionId}/P=${ans.problemId}: ${err.message}`);
                // Continue to ensure we still submit whatever is possible
            }
        }
    }

    // Get all answers for this submission
    const answers = await answerRepo().find({
        where: { submissionId },
        relations: ["question", "problem", "section"],
    });

    console.log(`   Found ${answers.length} answers to evaluate`);

    // ⭐ Check if frontend provided marks for all answers
    const frontendMarksProvided = answers.every(a => a.marksObtained !== null && a.marksObtained !== undefined);

    if (!frontendMarksProvided) {
        // Evaluate MCQ answers only if marks not provided from frontend
        console.log(`   📝 Evaluating MCQ answers (frontend marks not provided)...`);
        await evaluateMCQAnswers(answers);

        // Evaluate coding answers only if marks not provided from frontend
        console.log(`   💻 Evaluating coding answers (frontend marks not provided)...`);
        await evaluateCodingAnswers(answers);
    } else {
        console.log(`   ⭐ Skipping evaluation - using frontend-provided marks`);
    }

    // Calculate section scores
    const sectionScores = await calculateSectionScores(submission.assessmentId, answers);

    // Calculate total score
    let totalScore = 0;
    let totalNegativeMarks = 0;
    for (const ss of sectionScores) {
        totalScore += ss.obtainedMarks;
        totalNegativeMarks += ss.negativeMarks;
    }

    // Generate analytics
    const analytics = generateAnalytics(submission, answers, sectionScores);

    // Update submission
    submission.status = SubmissionStatus.EVALUATED;
    submission.submittedAt = new Date();
    submission.isAutoSubmitted = isAutoSubmit;
    submission.totalScore = Math.max(0, totalScore); // Don't go below 0
    submission.percentage = submission.maxScore > 0 ? (submission.totalScore / submission.maxScore) * 100 : 0;
    submission.sectionScores = sectionScores;
    submission.analytics = analytics;

    await submissionRepo().save(submission);

    console.log(`\n📊 [SUBMIT] FINAL RESULTS:`);
    console.log(`   ╔════════════════════════════════════════════════════════╗`);
    console.log(`   ║              ASSESSMENT SUBMISSION SUMMARY              ║`);
    console.log(`   ╠════════════════════════════════════════════════════════╣`);
    console.log(`   ║ Total Score: ${submission.totalScore.toFixed(2)}/${submission.maxScore.toFixed(2)}`.padEnd(60) + `║`);
    console.log(`   ║ Percentage:  ${submission.percentage.toFixed(2)}%`.padEnd(60) + `║`);
    console.log(`   ║ Sections:    ${sectionScores.length}`.padEnd(60) + `║`);
    console.log(`   ╠════════════════════════════════════════════════════════╣`);

    // Show section breakdown
    sectionScores.forEach(section => {
        const sectionPercentage = section.totalMarks > 0
            ? ((section.obtainedMarks / section.totalMarks) * 100).toFixed(2)
            : '0.00';
        console.log(`   ║ ${section.sectionTitle.padEnd(20).substring(0, 20)} ${section.obtainedMarks.toFixed(2)}/${section.totalMarks.toFixed(2)} (${sectionPercentage}%)`.padEnd(60) + `║`);
    });

    console.log(`   ╚════════════════════════════════════════════════════════╝`);

    // 🕵️ Trigger plagiarism check for coding submissions (async, non-blocking)
    console.log(`\n🕵️ [PLAGIARISM] Initiating plagiarism check for coding problems...`);
    plagiarismService.checkAssessmentPlagiarism(submissionId).catch((err) => {
        console.error(`⚠️ [PLAGIARISM] Background check failed:`, err.message);
        // Non-blocking: don't fail the submission if plagiarism service is down
    });

    return submission;
};

// ============================================
// EVALUATE MCQ ANSWERS
// ============================================

/**
 * Evaluate all MCQ answers with negative marking support
 */
const evaluateMCQAnswers = async (answers: AssessmentAnswer[]): Promise<void> => {
    console.log(`\n📝 [EVALUATE_MCQ] Evaluating MCQ answers...`);

    const mcqAnswers = answers.filter(a => a.questionId);

    for (const answer of mcqAnswers) {
        if (answer.status === AnswerStatus.UNATTEMPTED || !answer.selectedAnswer) {
            answer.isCorrect = false;
            answer.marksObtained = 0;
            continue;
        }

        // Fetch question with correct answer
        const question = await questionRepo().findOne({
            where: { id: answer.questionId },
            relations: ["section"],
        });

        if (!question) {
            console.warn(`   ⚠️ Question ${answer.questionId} not found`);
            continue;
        }

        const correctAnswer = question.correctAnswer;
        const section = question.section || answer.section;
        const negativeMarkingRate = section?.negativeMarking || 0;
        const maxMarks = question.marks || section?.marksPerQuestion || 1;

        let isCorrect = false;

        // Check answer based on question type
        if (question.type === QuestionType.SINGLE_CHOICE) {
            // Single choice: Compare directly
            isCorrect = answer.selectedAnswer === correctAnswer;
        } else if (question.type === QuestionType.MULTIPLE_CHOICE) {
            // Multiple choice: Parse and compare arrays
            const selected = Array.isArray(answer.selectedAnswer)
                ? answer.selectedAnswer
                : [answer.selectedAnswer];

            // Parse correctAnswer - it might be stored as:
            // - Array: ["1","3"]
            // - Comma-separated string: "1,3"
            // - JSON string: '["1","3"]'
            let correct: string[] = [];

            if (Array.isArray(correctAnswer)) {
                correct = correctAnswer.map(c => String(c).trim());
            } else if (typeof correctAnswer === 'string') {
                const trimmed = correctAnswer.trim();
                // Check if it's a JSON array
                if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                    try {
                        const parsed = JSON.parse(trimmed);
                        correct = Array.isArray(parsed) ? parsed.map(c => String(c).trim()) : [trimmed];
                    } catch {
                        // If JSON parse fails, treat as comma-separated
                        correct = trimmed.split(',').map(c => c.trim()).filter(c => c.length > 0);
                    }
                } else if (trimmed.includes(',')) {
                    // Comma-separated: "1,3" or "A,C"
                    correct = trimmed.split(',').map(c => c.trim()).filter(c => c.length > 0);
                } else {
                    // Single value
                    correct = [trimmed];
                }
            } else {
                correct = [String(correctAnswer).trim()];
            }

            // Normalize both arrays to strings for comparison
            const selectedNormalized = selected.map(s => String(s).trim()).sort();
            const correctNormalized = correct.map(c => String(c).trim()).sort();

            // Compare: same length and all elements match
            isCorrect = selectedNormalized.length === correctNormalized.length &&
                selectedNormalized.every((s, idx) => s === correctNormalized[idx]);

            console.log(`   🎯 Multiple Choice: Selected=[${selectedNormalized.join(',')}], Correct=[${correctNormalized.join(',')}], Match=${isCorrect}`);
        } else if (question.type === QuestionType.FILL_IN_THE_BLANK) {
            // Fill-in-blank: Case-insensitive comparison
            const userAnswer = String(answer.selectedAnswer).toLowerCase().trim();
            const expected = String(correctAnswer).toLowerCase().trim();
            isCorrect = userAnswer === expected;
        }

        // Calculate marks
        if (isCorrect) {
            answer.marksObtained = maxMarks;
        } else {
            // Apply negative marking
            answer.marksObtained = -1 * (maxMarks * negativeMarkingRate);
        }

        answer.isCorrect = isCorrect;
        answer.maxMarks = maxMarks;
        answer.status = AnswerStatus.EVALUATED;

        await answerRepo().save(answer);

        console.log(`   ${isCorrect ? "✅" : "❌"} Q${question.id.slice(0, 8)}: ${isCorrect ? "+" + maxMarks : answer.marksObtained}`);
    }
};

// ============================================
// EVALUATE CODING ANSWERS
// ============================================

/**
 * Evaluate all coding answers using the code execution service
 */
const evaluateCodingAnswers = async (answers: AssessmentAnswer[]): Promise<void> => {
    console.log(`\n💻 [EVALUATE_CODING] Checking coding answers (Verification Only)...`);

    const codingAnswers = answers.filter(a =>
        (a.problemId || (a.question && a.question.type === "coding")) &&
        a.code
    );

    for (const answer of codingAnswers) {
        if (!answer.code || !answer.language) {
            answer.isCorrect = false;
            answer.marksObtained = 0;
            continue;
        }

        // 🎯 FIX: Do NOT re-execute code here.
        // We rely on the fact that the user MUST have clicked "Submit" on the coding problem
        // during the test. That action saves the result (codingResult) and marksObtained.

        // If the answer has a codingResult OR marksObtained, we trust it.
        // If it accepts "raw code" without submission, we can either:
        // A) Treat it as 0 (User didn't submit) -> PREFERRED for "professional" behavior
        // B) Try to run it now (Risky, might timeout or use wrong config)

        const hasResult = answer.codingResult && answer.codingResult.totalTests !== undefined;
        const hasMarks = answer.marksObtained !== null && answer.marksObtained !== undefined;

        if (hasResult || hasMarks) {
            console.log(`   ✅ [CACHED] Problem ${answer.problemId?.slice(0, 8)} already evaluated.`);
            console.log(`      Score: ${answer.marksObtained}/${answer.maxMarks}, Tests: ${answer.codingResult?.passedTests}/${answer.codingResult?.totalTests}`);
            // Ensure status is correct
            answer.status = AnswerStatus.EVALUATED;
            await answerRepo().save(answer);
            continue;
        }

        // Fallback for "Raw Code" that was typed but never submitted
        console.warn(`   ⚠️ [UNSUBMITTED] Problem ${answer.problemId?.slice(0, 8)} has code but was NOT submitted by user.`);
        console.warn(`      Marking as 0. Users must explicitly 'Submit' coding solutions.`);

        answer.marksObtained = 0;
        answer.isCorrect = false;
        answer.status = AnswerStatus.EVALUATED;
        answer.codingResult = {
            language: answer.language,
            code: answer.code,
            passedTests: 0,
            totalTests: 0,
            status: "not_submitted",
            score: 0,
            maxScore: answer.maxMarks || 100,
            sampleResults: [],
        };

        await answerRepo().save(answer);
    }
};

// ============================================
// CALCULATE SECTION SCORES
// ============================================

/**
 * Calculate score breakdown for each section
 */
const calculateSectionScores = async (
    assessmentId: string,
    answers: AssessmentAnswer[]
): Promise<SectionScore[]> => {
    console.log(`\n📊 [SECTION_SCORES] Calculating section-wise scores...`);

    const sections = await sectionRepo().find({
        where: { assessment: { id: assessmentId } },
        relations: ["questions", "problems"],
        order: { order: "ASC" },
    });

    const sectionScores: SectionScore[] = [];

    for (const section of sections) {
        const sectionAnswers = answers.filter(a => a.sectionId === section.id);

        let totalQuestions = 0;
        let totalMarks = 0;

        // ⭐ Calculate totalMarks from frontend-provided maxMarks (prefer frontend)
        // This ensures marks match what frontend evaluated
        let frontendTotalMarks = 0;
        for (const answer of sectionAnswers) {
            frontendTotalMarks += answer.maxMarks || 0;
        }

        // Fallback to database configuration if no frontend marks
        if (frontendTotalMarks === 0) {
            // Count MCQ questions
            if (section.questions) {
                totalQuestions += section.questions.length;
                for (const q of section.questions) {
                    totalMarks += q.marks || section.marksPerQuestion || 1;
                }
            }

            // Count coding problems
            if (section.problems) {
                totalQuestions += section.problems.length;
                for (const sp of section.problems as any[]) {
                    totalMarks += sp.marks || 100;
                }
            }
        } else {
            totalMarks = frontendTotalMarks;
            console.log(`   ⭐ Using frontend-provided totalMarks: ${totalMarks}`);
        }

        // Calculate obtained marks and stats
        let obtainedMarks = 0;
        let negativeMarks = 0;
        let correctAnswers = 0;
        let wrongAnswers = 0;
        let unattempted = 0;
        // Fetch submission to get usage stats
        const submission = await submissionRepo().findOne({ where: { assessmentId: assessmentId } });

        let timeTaken = 0; // ✅ Added to track section time

        // Priority 1: Use server-side tracked timer usage (most accurate)
        if (submission?.sectionUsage && submission.sectionUsage[section.id]) {
            timeTaken = submission.sectionUsage[section.id];
            console.log(`   ⏱️ Using server-tracked time for section ${section.title}: ${timeTaken}s`);
        } else {
            // Priority 2: Fallback to sum of timeSpent from answers (if legacy or no timer)
            for (const answer of sectionAnswers) {
                // Aggregate time spent
                if (answer.timeSpent) {
                    timeTaken += answer.timeSpent;
                }
            }
        }

        // Calculate score stats by iterating answers
        for (const answer of sectionAnswers) {
            if (answer.status === AnswerStatus.UNATTEMPTED || (!answer.selectedAnswer && !answer.code)) {
                unattempted++;
            } else if (answer.isCorrect) {
                correctAnswers++;
                obtainedMarks += (answer.marksObtained || 0);
            } else {
                wrongAnswers++;
                const marks = answer.marksObtained || 0;
                if (marks < 0) {
                    negativeMarks += Math.abs(marks);
                }
                obtainedMarks += marks; // Will be negative for wrong MCQs
            }
        }

        // Account for truly unattempted (no answer record at all)
        const answeredCount = sectionAnswers.length;
        unattempted = Math.max(0, totalQuestions - answeredCount);

        sectionScores.push({
            sectionId: section.id,
            sectionTitle: section.title,
            sectionType: section.type,
            totalMarks,
            obtainedMarks: Math.max(0, obtainedMarks), // Don't show negative section score
            correctAnswers,
            wrongAnswers,
            unattempted,
            totalQuestions,
            percentage: totalMarks > 0 ? (Math.max(0, obtainedMarks) / totalMarks) * 100 : 0,
            negativeMarks,
            timeTaken, // ✅ Added
        });

        console.log(`   📑 ${section.title}: ${Math.max(0, obtainedMarks).toFixed(1)}/${totalMarks} (${correctAnswers}✓ ${wrongAnswers}✗ ${unattempted}○), Time: ${timeTaken}s`);
    }

    return sectionScores;
};

// ============================================
// GENERATE ANALYTICS
// ============================================

/**
 * Generate detailed analytics for the submission
 */
const generateAnalytics = (
    submission: AssessmentSubmission,
    answers: AssessmentAnswer[],
    sectionScores: SectionScore[]
): SubmissionAnalytics => {
    console.log(`\n📈 [ANALYTICS] Generating detailed analytics...`);

    // Total stats
    let totalQuestions = 0;
    let totalMarks = 0;
    let totalTimeTaken = 0; // ✅ Added

    for (const ss of sectionScores) {
        totalQuestions += ss.totalQuestions;
        totalMarks += ss.totalMarks;
        totalTimeTaken += ss.timeTaken; // ✅ Sum section times
    }

    const attemptedAnswers = answers.filter(a => a.selectedAnswer || a.code);
    const correctAnswers = answers.filter(a => a.isCorrect).length;
    const wrongAnswers = attemptedAnswers.length - correctAnswers;

    let obtainedMarks = 0;
    let negativeMarks = 0;
    for (const a of answers) {
        const marks = a.marksObtained || 0;
        if (marks >= 0) {
            obtainedMarks += marks;
        } else {
            negativeMarks += Math.abs(marks);
        }
    }

    // Time calculation (Prefer section sum if available)
    const timestampsDiff = submission.submittedAt && submission.startedAt
        ? Math.floor((submission.submittedAt.getTime() - submission.startedAt.getTime()) / 1000)
        : 0;

    // Use sum of sections if it's significant (sometimes sections overlap or gaps exist, usually section sum is safer for active time)
    const timeTaken = totalTimeTaken > 0 ? totalTimeTaken : timestampsDiff;

    // Coding specific stats
    const codingAnswers = answers.filter(a => a.problemId);
    let codingStats = undefined;
    if (codingAnswers.length > 0) {
        const fullySolved = codingAnswers.filter(a => a.isCorrect).length;
        const partiallySolved = codingAnswers.filter(a => !a.isCorrect && (a.marksObtained || 0) > 0).length;
        const codingTotalScore = codingAnswers.reduce((sum, a) => sum + (a.marksObtained || 0), 0);
        const codingMaxScore = codingAnswers.reduce((sum, a) => sum + a.maxMarks, 0);

        codingStats = {
            total: codingAnswers.length,
            attempted: codingAnswers.filter(a => a.code).length,
            fullySolved,
            partiallySolved,
            totalScore: codingTotalScore,
            maxScore: codingMaxScore,
        };
    }

    return {
        totalQuestions,
        attemptedQuestions: attemptedAnswers.length,
        correctAnswers,
        wrongAnswers,
        unattempted: totalQuestions - attemptedAnswers.length,
        totalMarks,
        obtainedMarks: Math.max(0, obtainedMarks - negativeMarks),
        negativeMarks,
        percentage: totalMarks > 0 ? (Math.max(0, obtainedMarks - negativeMarks) / totalMarks) * 100 : 0,
        timeTaken,
        sectionScores,
        codingProblems: codingStats,
    };
};

// ============================================
// GET SUBMISSION RESULT
// ============================================

/**
 * Get the latest submission for an assessment
 */
export const getLatestSubmission = async (
    assessmentId: string,
    userId: string
): Promise<AssessmentSubmission | null> => {
    console.log(`\n📋 [GET_SUBMISSION] Getting latest submission for user ${userId}, assessment ${assessmentId}`);

    const submission = await submissionRepo().findOne({
        where: { assessmentId, userId },
        relations: ["assessment"],
        order: { createdAt: "DESC" },
    });

    return submission;
};

/**
 * Get full submission with all answers
 */
export const getSubmissionWithAnswers = async (
    submissionId: string
): Promise<{ submission: AssessmentSubmission; answers: AssessmentAnswer[] }> => {
    console.log(`\n📋 [GET_SUBMISSION_DETAILS] Getting submission ${submissionId} with answers`);

    const submission = await submissionRepo().findOne({
        where: { id: submissionId },
        relations: ["assessment", "assessment.sections"],
    });

    if (!submission) {
        throw { status: 404, message: "Submission not found" };
    }

    const answers = await answerRepo().find({
        where: { submissionId },
        relations: ["question", "problem", "section"],
        order: { createdAt: "ASC" },
    });

    return { submission, answers };
};

// ============================================
// GET ALL ANSWERS FOR A SUBMISSION
// ============================================

/**
 * Get all saved answers for a submission (for resume/review)
 */
export const getAnswersForSubmission = async (
    submissionId: string
): Promise<AssessmentAnswer[]> => {
    return await answerRepo().find({
        where: { submissionId },
        order: { createdAt: "ASC" },
    });
};
