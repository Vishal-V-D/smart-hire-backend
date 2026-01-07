import { AppDataSource } from "../config/db";
import { Contest } from "../entities/contest.entity";
import { ContestSubmission } from "../entities/contestSubmission.entity";
import { SecureContestResult } from "../entities/SecureContestResult.entity";
import * as sessionService from "./contestSession.service";
import * as monitoringService from "./contestMonitoring.service";
import * as plagiarismService from "./plagiarism.service";
import * as timerUtil from "../utils/contestTimer.util";
import axios from "axios";

const contestRepo = () => AppDataSource.getRepository(Contest);
const submissionRepo = () => AppDataSource.getRepository(ContestSubmission);
const resultRepo = () => AppDataSource.getRepository(SecureContestResult);

const SUBMISSION_SERVICE_URL = process.env.SUBMISSION_SERVICE_URL || "http://localhost:5000";

interface SubmitAllResult {
    message: string;
    results: ProblemResult[];
    scoring: {
        totalBaseScore: number;
        violationPenalty: number;
        finalScore: number;
    };
    session: {
        startedAt: Date;
        finishedAt: Date;
        durationSeconds: number;
    };
    violationReport: any;
    rank?: number;
}

interface ProblemResult {
    problemId: string;
    problemTitle: string;
    difficulty: string;
    baseScore: number;
    testCasesPassed: number;
    testCasesTotal: number;
    status: string;
    submissionId?: string;
}

/**
 * Submit all solutions and finish contest
 */
export const submitAllAndFinish = async (
    contestId: string,
    userId: string,
    authHeader: string
): Promise<SubmitAllResult> => {
    console.log(`🏁 [SubmitAll] Starting submit-all for user ${userId} in contest ${contestId}`);

    // 1. Verify active session exists
    const session = await sessionService.getActiveSession(contestId, userId);
    if (!session) {
        const finishedSession = await sessionService.getSession(contestId, userId);
        if (finishedSession?.status === "finished") {
            throw { status: 403, message: "Contest already submitted" };
        }
        throw { status: 400, message: "No active session. Please start the contest first." };
    }

    // 2. Get all contest problems & user registration
    const contest = await contestRepo().findOne({
        where: { id: contestId },
        relations: ["contestProblems", "contestProblems.problem"],
    });

    if (!contest) {
        throw { status: 404, message: "Contest not found" };
    }

    // Fetch user registration details
    const registrationRepo = AppDataSource.getRepository("ContestRegistration");
    const registration = await registrationRepo.findOne({ where: { contestId, userId } });
    const registrationDetails = registration ? {
        name: registration.name,
        rollNumber: registration.rollNumber,
        department: registration.department,
        college: registration.college,
        email: registration.email || registration.personalEmail,
        photoUrl: registration.photoUrl,
        startedAt: registration['startedAt'] // Ensure we capture start time if available
    } : null;


    const problems = contest.contestProblems;
    console.log(`📋 [SubmitAll] Found ${problems.length} problems to evaluate`);

    // 3. Process each problem
    const results: ProblemResult[] = [];
    let totalBaseScore = 0;
    let totalProblemsSolved = 0;
    const problemStats: any = {};

    for (const contestProblem of problems) {
        const problem = contestProblem.problem;
        console.log(`🔍 [SubmitAll] Checking problem: ${problem.title} (${problem.id})`);

        try {
            // FETCH FROM SUBMISSION-SERVICE API (submissions are NOT stored locally!)
            // We want the LATEST ACCEPTED submission for plagiarism check and final scoring
            console.log(`🛠️ [SubmitAll] Fetching all submissions from submission-service API...`);

            let latestSubmission: any = null;
            try {
                // Get ALL submissions for this user/problem in this contest
                const response = await axios.get(
                    `${SUBMISSION_SERVICE_URL}/api/submissions/user/${userId}/problem/${problem.id}/all`, // Changed to get all history
                    {
                        params: { contestId },
                        headers: { Authorization: authHeader }
                    }
                );
                
                const submissions = response.data || [];
                
                if (submissions.length > 0) {
                     // 1. Filter for Accepted solutions first
                    const accepted = submissions.filter((s:any) => 
                        s.verdict === 'Accepted' || 
                        s.status === 'Accepted' ||
                        (s.passedTests === s.totalTests && s.totalTests > 0)
                    );

                    // 2. Pick the latest one
                    if (accepted.length > 0) {
                         // Sort descending by date
                         accepted.sort((a:any, b:any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
                         latestSubmission = accepted[0];
                    } else {
                        // Fallback: Latest submission regardless of verdict
                         submissions.sort((a:any, b:any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
                         latestSubmission = submissions[0];
                    }
                }
                
                console.log(`📄 [SubmitAll] Selected submission for grading:`, JSON.stringify({
                    id: latestSubmission?.id,
                    verdict: latestSubmission?.verdict,
                    passedTests: latestSubmission?.passedTests,
                    totalTests: latestSubmission?.totalTests
                }));
            } catch (apiErr: any) {
                if (apiErr.response?.status === 404) {
                    console.log(`⚠️ [SubmitAll] No submission found for problem ${problem.id}`);
                } else {
                    console.error(`❌ [SubmitAll] API error:`, apiErr.response?.data || apiErr.message);
                }
            }

            if (!latestSubmission || !latestSubmission.code) {
                console.log(`⚠️ [SubmitAll] No valid submission for ${problem.title}`);
                results.push({
                    problemId: problem.id,
                    problemTitle: problem.title,
                    difficulty: problem.difficulty || "medium",
                    baseScore: 0,
                    testCasesPassed: 0,
                    testCasesTotal: 0,
                    status: "not_attempted",
                });
                problemStats[problem.id] = { score: 0, status: "not_attempted", testCases: "0/0" };
                continue;
            }

            // Extract test case results from API response
            // API returns: passedTests, totalTests, verdict, code, language
            let passed = latestSubmission.passedTests || latestSubmission.testCasesPassed || 0;
            let total = latestSubmission.totalTests || latestSubmission.testCasesTotal || 0;
            let status = latestSubmission.verdict || latestSubmission.status || "pending";

            console.log(`📊 [SubmitAll] Submission Status: ${status}, Cases: ${passed}/${total}`);

            // Trigger Plagiarism Check (Fire & Forget)
            plagiarismService.checkPlagiarism(
                contestId,
                latestSubmission.id,
                userId,
                registration?.name || "User",
                contest.title,
                problem.id,
                problem.title, 
                latestSubmission.code,
                latestSubmission.language,
                registrationDetails?.photoUrl,
                passed, // ✅ Pass Passed Tests
                total   // ✅ Pass Total Tests
            ).catch(err => console.error(`⚠️ [Plagiarism] Failed to check for ${problem.id}`, err));

            // SCORING LOGIC
            const isSolved = passed === total && total > 0;
            let baseScore = 0;

            if (isSolved) {
                totalProblemsSolved++;
                // Custom Scoring: Easy=3, Medium=4, Hard=6
                const difficulty = (problem.difficulty || "").toLowerCase();
                if (difficulty === "easy") baseScore = 3;
                else if (difficulty === "medium") baseScore = 4;
                else if (difficulty === "hard") baseScore = 6;
                else baseScore = 3; // Default

                console.log(`✅ [SubmitAll] Problem Solved! ${problem.title} (${problem.difficulty}) -> +${baseScore} points`);
            } else {
                console.log(`⚠️ [SubmitAll] Problem NOT Solved. ${passed}/${total} passed.`);
            }

            totalBaseScore += baseScore;

            results.push({
                problemId: problem.id,
                problemTitle: problem.title,
                difficulty: problem.difficulty || "medium",
                baseScore,
                testCasesPassed: passed,
                testCasesTotal: total,
                status: status,
                submissionId: latestSubmission.id,
            });

            problemStats[problem.id] = {
                score: baseScore,
                status: status,
                testCases: `${passed}/${total}`,
                submissionId: latestSubmission.id
            };

        } catch (error: any) {
            console.error(`❌ [SubmitAll] Error processing ${problem.title}:`, error.message);
            results.push({
                problemId: problem.id,
                problemTitle: problem.title,
                difficulty: problem.difficulty || "medium",
                baseScore: 0,
                testCasesPassed: 0,
                testCasesTotal: 0,
                status: "error",
            });
            problemStats[problem.id] = { score: 0, status: "error", error: error.message };
        }
    }

    // 4. Calculate violation penalty & monitoring stats
    // Check if proctoring is enabled for this contest
    const isProctoringEnabled = contest.isInviteOnly && (
        contest.enableVideoProctoring ||
        contest.enableAudioMonitoring ||
        contest.enableCopyPasteDetection ||
        contest.enableTabSwitchDetection ||
        contest.enableFaceRecognition
    );

    let violationReport: any;
    let violationPenalty: number;

    if (isProctoringEnabled) {
        violationReport = await monitoringService.getDistinctFlags(contestId, userId);
        violationPenalty = calculateViolationPenalty(violationReport.suspiciousScore);
        console.log(`📊 [SubmitAll] Proctoring enabled - violation penalty: ${violationPenalty}`);
    } else {
        console.log(`📊 [SubmitAll] Proctoring disabled - skipping violation penalty`);
        violationReport = {
            isDistinct: false,
            isSuspicious: false,
            suspiciousScore: 0,
            details: { message: "Proctoring disabled for this contest" }
        };
        violationPenalty = 0;
    }

    // 5. Calculate final score
    // 5. Calculate final score (Ignore penalty initially, user must apply it)
    const finalScore = totalBaseScore;
    // const finalScore = Math.max(0, totalBaseScore - violationPenalty); // OLD Logic

    console.log(`📊 [SubmitAll] Final score: ${finalScore} (base: ${totalBaseScore}, penalty: ${violationPenalty})`);

    // 6. Finish session
    let finishedSession = await sessionService.finishSession(contestId, userId);

    // Check if it was expired using our strict timer util
    const timerStatus = timerUtil.getTimerStatus(contest, finishedSession);
    let actualDuration = finishedSession.durationSeconds || 0;

    // If expired according to our strict timer, enforce it
    if (timerStatus.hasExpired && finishedSession.status !== "expired") {
        console.log(`⏰ [SubmitAll] Session strictly expired - adjusting duration`);

        // Update session to reflect expiry
        finishedSession.status = "expired";
        finishedSession.finishedAt = timerStatus.expiresAt!;
        finishedSession.durationSeconds = timerStatus.totalDurationSeconds;
        actualDuration = timerStatus.totalDurationSeconds;

        // We technically should save this update to sessionRepo for consistency
        const sessionRepo = AppDataSource.getRepository("ContestSession");
        await sessionRepo.save(finishedSession);
    }

    console.log(`🏁 [SubmitAll] Contest finished at: ${finishedSession.finishedAt}`);

    // 7. Get Plagiarism Score & Full Report
    // Wait for async webhook results (poll for up to 5 seconds)
    console.log(`⏳ [SubmitAll] Waiting for plagiarism results...`);
    let plagiarismResults: any[] = [];
    const maxRetries = 5;

    for (let i = 0; i < maxRetries; i++) {
        plagiarismResults = await plagiarismService.getPlagiarismResult(contestId, userId);
        if (plagiarismResults.length > 0) {
            console.log(`✅ [SubmitAll] Plagiarism results found: ${plagiarismResults.length}`);
            break;
        }
        await new Promise(r => setTimeout(r, 1000)); // Wait 1s
    }

    const maxPlagiarismScore = plagiarismResults.reduce((max, r) => Math.max(max, r.similarityScore || 0), 0);
    const maxAiScore = plagiarismResults.reduce((max, r) => Math.max(max, r.aiConfidence || 0), 0);
    const isAiGenerated = plagiarismResults.some(r => r.isAiGenerated);

    // Construct full plagiarism report map (JSON + PDF path)
    const plagiarismReportFull: any = {};
    plagiarismResults.forEach(r => {
        plagiarismReportFull[r.problemId] = {
            score: r.similarityScore,
            verdict: r.verdict,
            isAiGenerated: r.isAiGenerated,
            matches: r.matches, // JSON Data
            reportPath: r.reportPath // PDF Reference
        };
    });

    // 8. STORE FINAL RESULTS to SecureContestResult
    console.log(`💾 [SubmitAll] Saving enriched results to SecureContestResult...`);

    // Use registration start time if available (for Invite Only strictness), else session start
    const officialStartedAt = registration?.['startedAt'] || finishedSession.startedAt;

    const secureResult = resultRepo().create({
        contestId,
        userId,
        totalBaseScore,
        // 💡 Suggested Penalty (Organizer must apply it manually)
        suggestedPenalty: violationPenalty,
        violationPenalty: 0, // Default to 0 initially

        isDistinct: violationReport.isDistinct,
        isSuspicious: violationReport.isSuspicious,

        // Time Fields
        durationSeconds: actualDuration,
        allocatedDurationSeconds: timerStatus.totalDurationSeconds,
        startedAt: officialStartedAt,
        finishedAt: finishedSession.finishedAt!,
        timeMetrics: {
            usedSeconds: actualDuration,
            allocatedSeconds: timerStatus.totalDurationSeconds,
            percentageUsed: Math.min(100, Math.round((actualDuration / timerStatus.totalDurationSeconds) * 100)),
            wasExpired: timerStatus.hasExpired
        },

        // New Enriched Fields
        registrationDetails,
        totalProblems: problems.length,
        totalProblemsSolved,
        problemStats,
        plagiarismReport: plagiarismReportFull,
        violationReport: {
            score: violationReport.suspiciousScore,
            flags: violationReport.details,
            distinctCounts: violationReport.isDistinct
        },

        resultDetails: {
            problemResults: results,
            violationDetails: violationReport.details,
            plagiarismSummary: plagiarismResults.map(p => ({ problemId: p.problemId, score: p.similarityScore, verdict: p.verdict }))
        }
    });

    await resultRepo().save(secureResult);
    console.log(`✅ [SubmitAll] SecureContestResult saved with ID: ${secureResult.id}`);

    // 9. Calculate Rank
    // Rank = 1 + count of users better than me
    // Better = Higher Score OR (Equal Score & More Solved) OR (Equal Score & Equal Solved & Less Time)
    const rankQuery = await resultRepo()
        .createQueryBuilder("result")
        .where("result.contestId = :contestId", { contestId })
        .andWhere(
            `(result.finalScore > :myScore 
            OR (result.finalScore = :myScore AND result.totalProblemsSolved > :mySolved)
            OR (result.finalScore = :myScore AND result.totalProblemsSolved = :mySolved AND result.durationSeconds < :myDuration))`,
            {
                myScore: secureResult.finalScore,
                mySolved: secureResult.totalProblemsSolved,
                myDuration: secureResult.durationSeconds
            }
        )
        .getCount();

    const rank = rankQuery + 1;
    console.log(`🏆 [SubmitAll] Calculated Rank: ${rank}`);

    return {
        message: "Submitted successfully",
        results,
        rank,
        scoring: {
            totalBaseScore,
            violationPenalty,
            finalScore,
        },
        session: {
            startedAt: officialStartedAt,
            finishedAt: finishedSession.finishedAt!,
            durationSeconds: finishedSession.durationSeconds!,
        },
        violationReport,
    };
};

/**
 * Submit to submission-service for evaluation
 */
const submitToSubmissionService = async (
    contestId: string,
    userId: string,
    problemId: string,
    code: string,
    language: string,
    authHeader: string
) => {
    try {
        const response = await axios.post(
            `${SUBMISSION_SERVICE_URL}/api/submissions/create`,
            {
                userId,
                problemId,
                language,
                code,
                contestId,
            },
            {
                headers: {
                    Authorization: authHeader,
                    "Content-Type": "application/json",
                },
            }
        );
        return response.data;
    } catch (error: any) {
        console.error("❌ [SubmitAll] Submission service error:", error.response?.data || error.message);
        throw error;
    }
};

/**
 * Calculate violation penalty based on suspicious score
 */
const calculateViolationPenalty = (suspiciousScore: number): number => {
    return Math.floor(suspiciousScore / 10);
};
