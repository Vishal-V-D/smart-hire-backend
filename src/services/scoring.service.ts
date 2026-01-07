/**
 * Scoring Service
 * 
 * Handles:
 * - Fetching submission results from submission-service
 * - Calculating scores based on difficulty (Easy=3, Medium=4, Hard=6)
 * - Populating and saving SecureContestResult
 */

import { AppDataSource } from "../config/db";
import { SecureContestResult } from "../entities/SecureContestResult.entity";
import axios from "axios";

const resultRepo = () => AppDataSource.getRepository(SecureContestResult);

const SUBMISSION_SERVICE_URL = process.env.SUBMISSION_SERVICE_URL || "http://localhost:5000";

// ==================== INTERFACES ====================

/** Submission data fetched from submission-service */
export interface SubmissionData {
    id: string;
    userId: string;
    problemId: string;
    contestId: string;
    code: string;
    language: string;
    verdict: string;         // "ACCEPTED", "WRONG_ANSWER", "TLE", etc.
    passedTests: number;
    totalTests: number;
    score?: number;
    executionTime?: number;
    memoryUsed?: number;
    createdAt?: Date;
}

/** Problem with difficulty information */
export interface ProblemInfo {
    id: string;
    title: string;
    difficulty: "Easy" | "Medium" | "Hard" | string;
}

/** Per-problem scoring result */
export interface ProblemScoreResult {
    problemId: string;
    problemTitle: string;
    difficulty: string;
    baseScore: number;
    testCasesPassed: number;
    testCasesTotal: number;
    status: string;
    submissionId?: string;
    isSolved: boolean;
}

/** Registration details for secure contests */
export interface RegistrationDetails {
    name?: string;
    rollNumber?: string;
    department?: string;
    college?: string;
    email?: string;
    photoUrl?: string;
    startedAt?: Date;
}

/** Violation report structure */
export interface ViolationReport {
    score: number;
    isSuspicious: boolean;
    isDistinct: boolean;
    details?: {
        totalViolations: number;
        tabSwitchCount: number;
        externalPasteCount: number;
        [key: string]: any;
    };
}

/** Plagiarism report per problem */
export interface PlagiarismReportItem {
    score: number;
    verdict: string;
    isAiGenerated: boolean;
    matches?: any[];
    reportPath?: string;
}

/** Complete input for saving SecureContestResult */
export interface SecureContestResultInput {
    contestId: string;
    userId: string;
    problems: ProblemInfo[];
    registrationDetails?: RegistrationDetails | null;
    violationReport: ViolationReport;
    plagiarismResults: Array<{
        problemId: string;
        similarityScore: number;
        verdict: string;
        isAiGenerated: boolean;
        matches?: any[];
        reportPath?: string;
    }>;
    session: {
        startedAt: Date;
        finishedAt: Date;
        durationSeconds: number;
    };
    authHeader: string;
}

/** Result of the scoring process */
export interface ScoringResult {
    totalBaseScore: number;
    violationPenalty: number;
    finalScore: number;
    totalProblemsSolved: number;
    problemResults: ProblemScoreResult[];
    problemStats: Record<string, {
        score: number;
        status: string;
        testCases: string;
        submissionId?: string;
    }>;
}

// ==================== SCORING CONSTANTS ====================

const SCORE_BY_DIFFICULTY: Record<string, number> = {
    easy: 3,
    medium: 4,
    hard: 6
};

const DEFAULT_SCORE = 3;

// ==================== SERVICE FUNCTIONS ====================

/**
 * Fetch submission from submission-service
 */
export async function fetchSubmission(
    userId: string,
    problemId: string,
    contestId: string,
    authHeader: string
): Promise<SubmissionData | null> {
    try {
        console.log(`📡 [Scoring] Fetching submission for user=${userId}, problem=${problemId}, contest=${contestId}`);

        const response = await axios.get(
            `${SUBMISSION_SERVICE_URL}/api/submissions/user/${userId}/problem/${problemId}`,
            {
                params: { contestId },
                headers: { Authorization: authHeader }
            }
        );

        const data = response.data;
        console.log(`✅ [Scoring] Found submission: id=${data.id}, verdict=${data.verdict}, tests=${data.passedTests}/${data.totalTests}`);

        return {
            id: data.id,
            userId: data.userId,
            problemId: data.problemId,
            contestId: data.contestId || contestId,
            code: data.code,
            language: data.language,
            verdict: data.verdict || data.status,
            passedTests: data.passedTests || data.testCasesPassed || 0,
            totalTests: data.totalTests || data.testCasesTotal || 0,
            score: data.score,
            executionTime: data.executionTime,
            memoryUsed: data.memoryUsed,
            createdAt: data.createdAt ? new Date(data.createdAt) : undefined
        };
    } catch (error: any) {
        if (error.response?.status === 404) {
            console.log(`⚠️ [Scoring] No submission found for problem ${problemId}`);
            return null;
        }
        console.error(`❌ [Scoring] API error:`, error.response?.data || error.message);
        return null;
    }
}

/**
 * Calculate score for a problem based on difficulty
 */
export function calculateProblemScore(
    submission: SubmissionData | null,
    problem: ProblemInfo
): ProblemScoreResult {
    console.log(`\n╔════════════════════════════════════════════════════════════`);
    console.log(`║ 🎯 SCORING PROBLEM: ${problem.title}`);
    console.log(`║ 📊 Difficulty: ${problem.difficulty || 'Unknown'}`);
    console.log(`╠════════════════════════════════════════════════════════════`);

    // No submission
    if (!submission || !submission.code) {
        console.log(`║ ❌ STATUS: NOT ATTEMPTED (No submission found)`);
        console.log(`║ 📝 Test Cases: 0/0`);
        console.log(`║ 🏆 Score Awarded: 0 points`);
        console.log(`╚════════════════════════════════════════════════════════════\n`);
        return {
            problemId: problem.id,
            problemTitle: problem.title,
            difficulty: problem.difficulty || "Medium",
            baseScore: 0,
            testCasesPassed: 0,
            testCasesTotal: 0,
            status: "not_attempted",
            isSolved: false
        };
    }

    const passed = submission.passedTests || 0;
    const total = submission.totalTests || 0;
    const isSolved = (passed === total) && (total > 0);

    console.log(`║ 📋 Submission ID: ${submission.id}`);
    console.log(`║ 📝 Test Cases: ${passed}/${total} ${isSolved ? '✅ ALL PASSED!' : '⚠️ PARTIAL'}`);
    console.log(`║ 🔖 Verdict: ${submission.verdict || 'pending'}`);

    let baseScore = 0;
    if (isSolved) {
        const difficultyKey = (problem.difficulty || "").toLowerCase();
        baseScore = SCORE_BY_DIFFICULTY[difficultyKey] || DEFAULT_SCORE;
        console.log(`║ ✅ STATUS: SOLVED!`);
        console.log(`║ 🧮 Scoring System: ${problem.difficulty} = ${baseScore} points`);
        console.log(`║ 🏆 Score Awarded: +${baseScore} points`);
    } else {
        console.log(`║ ❌ STATUS: FAILED (${passed}/${total} passed)`);
        console.log(`║ 🏆 Score Awarded: 0 points (Not fully solved)`);
    }
    console.log(`╚════════════════════════════════════════════════════════════\n`);

    return {
        problemId: problem.id,
        problemTitle: problem.title,
        difficulty: problem.difficulty || "Medium",
        baseScore,
        testCasesPassed: passed,
        testCasesTotal: total,
        status: submission.verdict || "pending",
        submissionId: submission.id,
        isSolved
    };
}

/**
 * Calculate violation penalty
 */
export function calculateViolationPenalty(suspiciousScore: number): number {
    // 10% of suspicious score as penalty, floored
    return Math.floor(suspiciousScore / 10);
}

/**
 * Process all problems and calculate total scores
 */
export async function processAllProblems(
    problems: ProblemInfo[],
    userId: string,
    contestId: string,
    authHeader: string
): Promise<ScoringResult> {
    console.log(`\n╔══════════════════════════════════════════════════════════════════════`);
    console.log(`║ 🧮 SCORING SYSTEM - Processing ${problems.length} problems`);
    console.log(`║ 👤 User: ${userId}`);
    console.log(`║ 🏆 Contest: ${contestId}`);
    console.log(`╚══════════════════════════════════════════════════════════════════════\n`);

    const problemResults: ProblemScoreResult[] = [];
    const problemStats: Record<string, any> = {};
    let totalBaseScore = 0;
    let totalProblemsSolved = 0;

    for (let i = 0; i < problems.length; i++) {
        const problem = problems[i];
        console.log(`📌 Processing Problem ${i + 1}/${problems.length}: ${problem.title}`);

        const submission = await fetchSubmission(userId, problem.id, contestId, authHeader);
        const scoreResult = calculateProblemScore(submission, problem);

        problemResults.push(scoreResult);
        totalBaseScore += scoreResult.baseScore;

        if (scoreResult.isSolved) {
            totalProblemsSolved++;
        }

        problemStats[problem.id] = {
            score: scoreResult.baseScore,
            status: scoreResult.status,
            testCases: `${scoreResult.testCasesPassed}/${scoreResult.testCasesTotal}`,
            submissionId: scoreResult.submissionId
        };

        console.log(`   → Cumulative Score: ${totalBaseScore} | Problems Solved: ${totalProblemsSolved}/${i + 1}`);
    }

    console.log(`\n╔══════════════════════════════════════════════════════════════════════`);
    console.log(`║ 📊 SCORING SUMMARY`);
    console.log(`║ ────────────────────────────────────────────────────────────────────`);
    console.log(`║ 🎯 Total Problems: ${problems.length}`);
    console.log(`║ ✅ Problems Solved: ${totalProblemsSolved}`);
    console.log(`║ 🏆 Total Base Score: ${totalBaseScore}`);
    console.log(`╚══════════════════════════════════════════════════════════════════════\n`);

    return {
        totalBaseScore,
        violationPenalty: 0, // Will be calculated later
        finalScore: totalBaseScore,
        totalProblemsSolved,
        problemResults,
        problemStats
    };
}

/**
 * Build plagiarism report map from results
 */
export function buildPlagiarismReportMap(
    plagiarismResults: SecureContestResultInput['plagiarismResults']
): Record<string, PlagiarismReportItem> {
    const reportMap: Record<string, PlagiarismReportItem> = {};

    for (const result of plagiarismResults) {
        reportMap[result.problemId] = {
            score: result.similarityScore,
            verdict: result.verdict,
            isAiGenerated: result.isAiGenerated,
            matches: result.matches,
            reportPath: result.reportPath
        };
    }

    return reportMap;
}

/**
 * Save SecureContestResult to database
 */
export async function saveSecureContestResult(
    input: SecureContestResultInput
): Promise<SecureContestResult> {
    console.log(`\n╔══════════════════════════════════════════════════════════════════════`);
    console.log(`║ 🏁 STARTING SECURE CONTEST RESULT GENERATION`);
    console.log(`║ 👤 User: ${input.userId}`);
    console.log(`║ 🏆 Contest: ${input.contestId}`);
    console.log(`╚══════════════════════════════════════════════════════════════════════\n`);

    // 1. Process all problems and calculate scores
    const scoring = await processAllProblems(
        input.problems,
        input.userId,
        input.contestId,
        input.authHeader
    );

    // 2. Calculate violation penalty
    const violationPenalty = calculateViolationPenalty(input.violationReport.score);
    scoring.violationPenalty = violationPenalty;
    scoring.finalScore = Math.max(0, scoring.totalBaseScore - violationPenalty);

    console.log(`╔══════════════════════════════════════════════════════════════════════`);
    console.log(`║ 📊 FINAL SCORE CALCULATION`);
    console.log(`║ ────────────────────────────────────────────────────────────────────`);
    console.log(`║ 🎯 Base Score: ${scoring.totalBaseScore}`);
    console.log(`║ ⚠️ Violation Penalty: -${violationPenalty} (from suspicious score: ${input.violationReport.score})`);
    console.log(`║ 🏆 FINAL SCORE: ${scoring.finalScore}`);
    console.log(`╚══════════════════════════════════════════════════════════════════════\n`);

    // 3. Build plagiarism report
    const plagiarismReportMap = buildPlagiarismReportMap(input.plagiarismResults);
    const maxPlagiarismScore = input.plagiarismResults.reduce(
        (max, r) => Math.max(max, r.similarityScore || 0),
        0
    );

    // Determine overall plagiarism verdict
    const plagiarizedProblems = input.plagiarismResults.filter(r =>
        r.verdict === 'Plagiarized' || r.similarityScore >= 70
    );
    const overallPlagiarismVerdict = plagiarizedProblems.length > 0 ? 'PLAGIARIZED' : 'CLEAN';

    console.log(`╔══════════════════════════════════════════════════════════════════════`);
    console.log(`║ 🔍 PLAGIARISM ANALYSIS`);
    console.log(`║ ────────────────────────────────────────────────────────────────────`);
    console.log(`║ 📊 Max Similarity: ${maxPlagiarismScore}%`);
    console.log(`║ 🏷️ Overall Verdict: ${overallPlagiarismVerdict}`);
    if (input.plagiarismResults.length > 0) {
        console.log(`║ 📋 Per-Problem Results:`);
        for (const result of input.plagiarismResults) {
            const icon = result.verdict === 'Plagiarized' || result.similarityScore >= 70 ? '🚨' : '✅';
            console.log(`║    ${icon} Problem ${result.problemId}: ${result.similarityScore}% - ${result.verdict}`);
            if (result.matches && result.matches.length > 0) {
                console.log(`║       ↳ Matched with ${result.matches.length} other submission(s)`);
            }
        }
    } else {
        console.log(`║ ⚠️ No plagiarism results available (not yet processed)`);
    }
    console.log(`╚══════════════════════════════════════════════════════════════════════\n`);

    // 4. Determine official start time
    const officialStartedAt = input.registrationDetails?.startedAt || input.session.startedAt;
    console.log(`⏱️ [Scoring] Timing: started=${officialStartedAt}, finished=${input.session.finishedAt}, duration=${input.session.durationSeconds}s`);

    // 5. Create and save result
    console.log(`\n💾 [Scoring] ATTACHING TO ENTITY FIELDS:`);
    console.log(`   → contestId: ${input.contestId}`);
    console.log(`   → userId: ${input.userId}`);
    console.log(`   → totalBaseScore: ${scoring.totalBaseScore}`);
    console.log(`   → violationPenalty: ${scoring.violationPenalty}`);
    console.log(`   → finalScore: ${scoring.finalScore}`);
    console.log(`   → plagiarismScore: ${maxPlagiarismScore}`);
    console.log(`   → suspiciousScore: ${input.violationReport.score}`);
    console.log(`   → isDistinct: ${input.violationReport.isDistinct}`);
    console.log(`   → isSuspicious: ${input.violationReport.isSuspicious}`);
    console.log(`   → durationSeconds: ${input.session.durationSeconds}`);
    console.log(`   → startedAt: ${officialStartedAt}`);
    console.log(`   → finishedAt: ${input.session.finishedAt}`);
    console.log(`   → totalProblems: ${input.problems.length}`);
    console.log(`   → totalProblemsSolved: ${scoring.totalProblemsSolved}`);
    console.log(`   → problemStats: ${JSON.stringify(scoring.problemStats)}`);
    console.log(`   → registrationDetails: ${input.registrationDetails ? 'Present' : 'null'}`);
    console.log(`   → plagiarismReport: ${Object.keys(plagiarismReportMap).length} entries`);
    console.log(`   → violationReport: score=${input.violationReport.score}`);

    const secureResult = resultRepo().create({
        // Core IDs
        contestId: input.contestId,
        userId: input.userId,

        // Scores
        totalBaseScore: scoring.totalBaseScore,
        violationPenalty: scoring.violationPenalty,
        finalScore: scoring.finalScore,
        plagiarismScore: maxPlagiarismScore,
        suspiciousScore: input.violationReport.score,

        // Flags
        isDistinct: input.violationReport.isDistinct,
        isSuspicious: input.violationReport.isSuspicious,

        // Timing
        durationSeconds: input.session.durationSeconds,
        startedAt: officialStartedAt,
        finishedAt: input.session.finishedAt,

        // Problem Stats
        totalProblems: input.problems.length,
        totalProblemsSolved: scoring.totalProblemsSolved,
        problemStats: scoring.problemStats,

        // Detailed Reports (JSONB)
        registrationDetails: input.registrationDetails,
        plagiarismReport: plagiarismReportMap,
        violationReport: {
            score: input.violationReport.score,
            flags: input.violationReport.details,
            distinctCounts: input.violationReport.isDistinct
        },
        resultDetails: {
            problemResults: scoring.problemResults,
            violationDetails: input.violationReport.details,
            plagiarismSummary: input.plagiarismResults.map(p => ({
                problemId: p.problemId,
                score: p.similarityScore,
                verdict: p.verdict
            }))
        }
    });

    await resultRepo().save(secureResult);

    console.log(`\n╔══════════════════════════════════════════════════════════════════════`);
    console.log(`║ ✅ SECURE CONTEST RESULT SAVED SUCCESSFULLY!`);
    console.log(`║ 🆔 Result ID: ${secureResult.id}`);
    console.log(`║ 🏆 Final Score: ${secureResult.finalScore}`);
    console.log(`║ ✅ Problems Solved: ${secureResult.totalProblemsSolved}/${secureResult.totalProblems}`);
    console.log(`╚══════════════════════════════════════════════════════════════════════\n`);

    return secureResult;
}

/**
 * Get SecureContestResult by contestId and userId
 */
export async function getSecureContestResult(
    contestId: string,
    userId: string
): Promise<SecureContestResult | null> {
    return await resultRepo().findOne({
        where: { contestId, userId }
    });
}

/**
 * Get all SecureContestResults for a contest
 */
export async function getAllSecureContestResultsByContest(
    contestId: string
): Promise<SecureContestResult[]> {
    return await resultRepo().find({
        where: { contestId },
        order: { finalScore: "DESC" }
    });
}
