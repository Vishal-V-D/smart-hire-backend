import { AppDataSource } from "../config/db";
import { Not, IsNull } from "typeorm";
import { AssessmentSubmission, SubmissionStatus } from "../entities/AssessmentSubmission.entity";
import { AssessmentAnswer } from "../entities/AssessmentAnswer.entity";
import { AssessmentSession } from "../entities/AssessmentSession.entity";
import { AssessmentViolation, ViolationType } from "../entities/AssessmentViolation.entity";
import { ContestantProfile } from "../entities/ContestantProfile.entity";
import { Assessment } from "../entities/Assessment.entity";
import { User } from "../entities/user.entity";
import { AssessmentInvitation } from "../entities/AssessmentInvitation.entity";
import { AssessmentSection } from "../entities/AssessmentSection.entity";

const submissionRepo = () => AppDataSource.getRepository(AssessmentSubmission);
const answerRepo = () => AppDataSource.getRepository(AssessmentAnswer);
const sessionRepo = () => AppDataSource.getRepository(AssessmentSession);
const violationRepo = () => AppDataSource.getRepository(AssessmentViolation);
const profileRepo = () => AppDataSource.getRepository(ContestantProfile);
const assessmentRepo = () => AppDataSource.getRepository(Assessment);
const userRepo = () => AppDataSource.getRepository(User);
const invitationRepo = () => AppDataSource.getRepository(AssessmentInvitation);
const sectionRepo = () => AppDataSource.getRepository(AssessmentSection);

// ============================================
// INTERFACES
// ============================================

export interface ParticipantReport {
    // Basic Info
    id: string;
    participantId: string;

    // Registration Details
    registration: {
        fullName: string;
        email: string;
        college: string | null;
        department: string | null;
        registrationNumber: string | null;
        cgpa: number | null;
        resumeUrl: string | null;
        idCardUrl: string | null;
        registeredAt: Date;
    };

    // Verification Images
    verification: {
        photoUrl: string | null; // Uploaded live photo during proctoring
        photoOptimizedUrl: string | null; // Optimized version from Supabase
        photoThumbnailUrl: string | null;
        faceDescriptor: any;
    };

    // Session Info
    session: {
        id: string;
        startedAt: Date | null;
        submittedAt: Date | null;
        totalTimeTaken: number; // in seconds
        status: string;
        proctoringConsent: boolean;
        systemChecks: any;
    };

    // Scores
    scores: {
        totalScore: number;
        maxScore: number;
        percentage: number;
        rank?: number;

        // Section-wise breakdown
        sectionScores: {
            sectionId: string;
            sectionTitle: string;
            sectionType: string;
            obtainedMarks: number;
            totalMarks: number;
            percentage: number;
            correctAnswers: number;
            wrongAnswers: number;
            unattempted: number;
            negativeMarks: number;
            timeTaken?: number; // Section-specific time if tracked
        }[];

        // Type-specific scores
        mcqScore: number;
        mcqMaxScore: number;
        codingScore: number;
        codingMaxScore: number;
        testCases?: {
            passed: number;
            total: number;
        };
    };

    // Coding Details (per problem)
    codingProblems: {
        problemId: string;
        problemTitle: string;
        language: string | null;
        code: string | null;
        passedTests: number;
        totalTests: number;
        testCasesSummary: string; // e.g., "3/50" or "50/50"
        score: number;
        maxScore: number;
        status: string;
        executionTime?: string;
        memoryUsed?: number;
        plagiarism?: {
            similarityPercentage: number;
            aiPercentage: number;
            verdict: string;
            matches: any[];
            reportPath: string | null;
        } | null;
    }[];

    // Violations Summary
    violations: {
        totalCount: number;
        byType: Record<string, number>;
        details: {
            id: string;
            type: string;
            detectedAt: Date;
            metadata: any;
        }[];
        riskLevel: "low" | "medium" | "high";
    };

    // Plagiarism (if available)
    plagiarism: {
        overallScore: number;
        isAiGenerated: boolean;
        aiConfidence: number;
        riskLevel: string;
        verdict: string;
    } | null;

    // Final Verdict
    verdict: {
        status: string; // "passed", "failed", "disqualified", "pending"
        finalScore: number;
        adjustedScore: number; // After violation penalty
        violationPenalty: number;
        notes: string | null;
        evaluatedBy: string | null;
        evaluatedAt: Date | null;
    };

    // Timestamps
    timestamps: {
        invitedAt: Date | null;
        acceptedAt: Date | null;
        startedAt: Date | null;
        submittedAt: Date | null;
        evaluatedAt: Date | null;
    };

    // Is auto-submitted?
    isAutoSubmitted: boolean;
}

export interface AssessmentReportSummary {
    assessmentId: string;
    assessmentTitle: string;

    // Overall Stats
    stats: {
        totalParticipants: number;
        completed: number;
        inProgress: number;
        notStarted: number;
        averageScore: number;
        highestScore: number;
        lowestScore: number;
        averageTimeTaken: number;
        passRate: number; // % of participants who passed
    };

    // Violation Stats
    violationStats: {
        totalViolations: number;
        participantsWithViolations: number;
        byType: Record<string, number>;
        highRiskCount: number;
    };

    participants: ParticipantReport[];
}

// ============================================
// GET COMPREHENSIVE REPORT FOR ASSESSMENT
// ============================================

export const getAssessmentReport = async (
    assessmentId: string,
    options: {
        page?: number;
        limit?: number;
        status?: string;
        sortBy?: string;
        sortOrder?: "ASC" | "DESC";
        search?: string;
    } = {}
): Promise<AssessmentReportSummary> => {
    console.log(`\n📊 [REPORT] Generating report for assessment ${assessmentId}`);

    const { page = 1, limit = 50, status, sortBy = "totalScore", sortOrder = "DESC", search } = options;
    const skip = (page - 1) * limit;

    // Fetch assessment
    const assessment = await assessmentRepo().findOne({
        where: { id: assessmentId },
        relations: ["sections"]
    });

    if (!assessment) {
        throw { status: 404, message: "Assessment not found" };
    }

    // Fetch all submissions for this assessment
    let queryBuilder = submissionRepo()
        .createQueryBuilder("submission")
        .leftJoinAndSelect("submission.user", "user")
        .leftJoinAndSelect("submission.session", "session")
        .where("submission.assessmentId = :assessmentId", { assessmentId })
        // Filter: Get the BEST submission for each user (Max Score, duplicate tie-break by latest date)
        .andWhere((qb) => {
            const subQuery = qb
                .subQuery()
                .select("s.id")
                .from(AssessmentSubmission, "s")
                .where("s.userId = submission.userId")
                .andWhere("s.assessmentId = :assessmentId")
                .orderBy("s.totalScore", "DESC")
                .addOrderBy("s.createdAt", "DESC")
                .limit(1)
                .getQuery();
            return "submission.id = " + subQuery;
        });

    if (status) {
        queryBuilder = queryBuilder.andWhere("submission.status = :status", { status });
    }

    if (search) {
        queryBuilder = queryBuilder.andWhere(
            "(user.email ILIKE :search OR user.username ILIKE :search)",
            { search: `%${search}%` }
        );
    }

    // Sorting
    if (sortBy === "totalScore") {
        queryBuilder = queryBuilder.orderBy("submission.totalScore", sortOrder);
    } else if (sortBy === "submittedAt") {
        queryBuilder = queryBuilder.orderBy("submission.submittedAt", sortOrder);
    } else if (sortBy === "percentage") {
        queryBuilder = queryBuilder.orderBy("submission.percentage", sortOrder);
    }

    const [submissions, totalCount] = await queryBuilder
        .skip(skip)
        .take(limit)
        .getManyAndCount();

    console.log(`   Found ${submissions.length} submissions (total: ${totalCount})`);

    // Build participant reports
    const participantReports: ParticipantReport[] = [];

    for (const submission of submissions) {
        const report = await buildParticipantReport(assessmentId, submission);
        participantReports.push(report);
    }

    // Calculate rankings
    participantReports.sort((a, b) => b.scores.totalScore - a.scores.totalScore);
    participantReports.forEach((p, idx) => {
        p.scores.rank = idx + 1;
    });

    // Calculate summary stats
    const stats = calculateAssessmentStats(participantReports);
    const violationStats = calculateViolationStats(participantReports);

    // ============================================
    // 📊 COMPREHENSIVE REPORT TABLE
    // ============================================
    try {
        console.log(`\n╔════════════════════════════════════════════════════════════════════════════╗`);
        console.log(`║                    📊 ASSESSMENT FINAL REPORT                              ║`);
        console.log(`╚════════════════════════════════════════════════════════════════════════════╝`);
        console.log(`\n📋 Assessment: ${assessment?.title || "Unknown"}`);
        console.log(`👥 Total Participants: ${participantReports.length}`);
        console.log(`📊 Average Score: ${(stats.averageScore || 0).toFixed(2)}%`);
        console.log(`🏆 Highest Score: ${stats.highestScore || 0}`);
        console.log(`📉 Lowest Score: ${stats.lowestScore || 0}`);

        // Show each participant's report
        participantReports.forEach((report, index) => {
            console.log(`\n${'='.repeat(80)}`);
            console.log(`🏅 RANK #${report.scores?.rank || index + 1} - ${report.registration?.fullName || "Unknown"}`);
            console.log(`${'='.repeat(80)}`);
            console.log(`📧 Email: ${report.registration?.email || "N/A"}`);
            console.log(`🏫 College: ${report.registration?.college || "N/A"} | Dept: ${report.registration?.department || "N/A"}`);
            const timeTaken = report.session?.totalTimeTaken ? Math.floor(report.session.totalTimeTaken / 60) : 0;
            console.log(`⏱️  Time: ${timeTaken} min | Status: ${report.verdict?.status || "Unknown"}`);

            console.log(`\n┌────────────────────────────────────────────────────────────────────────┐`);
            console.log(`│                          📝 SECTION SCORES                              │`);
            console.log(`├─────────────────────┬─────────┬─────────┬──────────┬──────────────────┤`);
            console.log(`│ Section Name        │ Scored  │   Max   │   Type   │   Test Cases     │`);
            console.log(`├─────────────────────┼─────────┼─────────┼──────────┼──────────────────┤`);

            (report.scores?.sectionScores || []).forEach(section => {
                const name = (section.sectionTitle || "Unknown").padEnd(19).substring(0, 19);
                const scored = String((section.obtainedMarks || 0).toFixed(1)).padStart(7);
                const max = String((section.totalMarks || 0).toFixed(1)).padStart(7);
                const type = (section.sectionType || "").padEnd(8).substring(0, 8);

                let testCases = "N/A";
                if (section.sectionType === "coding" && report.codingProblems?.length > 0) {
                    const sectionProblems = report.codingProblems.filter(cp =>
                        cp.problemId // Filter by section if needed
                    );
                    if (sectionProblems.length > 0) {
                        const totalPassed = sectionProblems.reduce((sum, cp) => sum + (cp.passedTests || 0), 0);
                        const totalTests = sectionProblems.reduce((sum, cp) => sum + (cp.totalTests || 0), 0);
                        testCases = `${totalPassed}/${totalTests}`;
                    }
                }
                testCases = testCases.padStart(16);

                console.log(`│ ${name} │ ${scored} │ ${max} │ ${type} │ ${testCases} │`);
            });

            console.log(`├─────────────────────┴─────────┴─────────┴──────────┴──────────────────┤`);
            const total = (report.scores?.totalScore || 0).toFixed(2);
            const max = (report.scores?.maxScore || 0).toFixed(2);
            const pct = (report.scores?.percentage || 0).toFixed(2);
            console.log(`│ 🎯 TOTAL: ${total}/${max} (${pct}%)`.padEnd(76) + `│`);
            console.log(`└────────────────────────────────────────────────────────────────────────┘`);

            // Coding Problems
            if (report.codingProblems?.length > 0) {
                console.log(`\n┌────────────────────────────────────────────────────────────────────────┐`);
                console.log(`│                        💻 CODING PROBLEMS                               │`);
                console.log(`├──────────────────────┬─────────┬─────────┬───────────────────────────┤`);
                console.log(`│ Problem              │  Score  │   Max   │      Test Cases           │`);
                console.log(`├──────────────────────┼─────────┼─────────┼───────────────────────────┤`);

                report.codingProblems.forEach(cp => {
                    const title = (cp.problemTitle || "Unknown").padEnd(20).substring(0, 20);
                    const score = String((cp.score || 0).toFixed(1)).padStart(7);
                    const max = String((cp.maxScore || 0).toFixed(1)).padStart(7);
                    const testCases = (cp.testCasesSummary || "N/A").padStart(25);
                    console.log(`│ ${title} │ ${score} │ ${max} │ ${testCases} │`);
                });

                console.log(`└──────────────────────┴─────────┴─────────┴───────────────────────────┘`);
            }

            // Plagiarism
            if (report.codingProblems?.length > 0) {
                console.log(`\n┌────────────────────────────────────────────────────────────────────────┐`);
                console.log(`│                        🔍 PLAGIARISM ANALYSIS                           │`);
                console.log(`├──────────────────────┬─────────┬─────────┬───────────────────────────┤`);
                console.log(`│ Problem              │  Sim %  │  AI %   │        Verdict            │`);
                console.log(`├──────────────────────┼─────────┼─────────┼───────────────────────────┤`);

                report.codingProblems.forEach(cp => {
                    const title = (cp.problemTitle || "Unknown").padEnd(20).substring(0, 20);
                    const sim = cp.plagiarism ? String(cp.plagiarism.similarityPercentage).padStart(7) : "N/A".padStart(7);
                    const ai = cp.plagiarism ? String(cp.plagiarism.aiPercentage).padStart(7) : "N/A".padStart(7);
                    const verdict = (cp.plagiarism?.verdict || "N/A").padEnd(25).substring(0, 25);
                    console.log(`│ ${title} │ ${sim} │ ${ai} │ ${verdict} │`);
                });

                console.log(`└──────────────────────┴─────────┴─────────┴───────────────────────────┘`);
            }

            // Violations
            const vCount = report.violations?.totalCount || 0;
            const risk = (report.violations?.riskLevel || "LOW").toUpperCase();
            console.log(`\n⚠️  Violations: ${vCount} | Risk: ${risk}`);
        });

        console.log(`\n${'='.repeat(80)}`);
        console.log(`✅ Assessment report generated successfully for ${participantReports.length} participants\n`);
    } catch (err) {
        console.error("❌ [REPORT] Error generating console report table:", err);
        // Continue - don't fail request just because logs failed
    }

    return {
        assessmentId,
        assessmentTitle: assessment.title,
        stats,
        violationStats,
        participants: participantReports
    };
};

// ============================================
// GET SINGLE PARTICIPANT REPORT
// ============================================

export const getParticipantReport = async (
    assessmentId: string,
    participantId: string
): Promise<ParticipantReport> => {
    console.log(`\n📊 [REPORT] Getting report for participant ${participantId}`);

    const submission = await submissionRepo().findOne({
        where: { assessmentId, userId: participantId },
        relations: ["user", "session"],
        order: { createdAt: "DESC" }
    });

    if (!submission) {
        throw { status: 404, message: "Submission not found for this participant" };
    }

    return await buildParticipantReport(assessmentId, submission);
};

// ============================================
// UPDATE PARTICIPANT VERDICT
// ============================================

export const updateParticipantVerdict = async (
    assessmentId: string,
    participantId: string,
    updates: {
        status?: string;
        adjustedScore?: number;
        violationPenalty?: number;
        notes?: string;
        evaluatedBy?: string;
    }
): Promise<ParticipantReport> => {
    console.log(`\n✏️ [REPORT] Updating verdict for participant ${participantId}`);

    const submission = await submissionRepo().findOne({
        where: { assessmentId, userId: participantId },
        order: { createdAt: "DESC" }
    });

    if (!submission) {
        throw { status: 404, message: "Submission not found" };
    }

    // Store verdict in analytics JSON (extend the analytics object)
    const currentAnalytics: any = submission.analytics || {};
    const existingVerdict = currentAnalytics.verdict || {};

    currentAnalytics.verdict = {
        status: updates.status || existingVerdict.status || "pending",
        adjustedScore: updates.adjustedScore ?? submission.totalScore,
        violationPenalty: updates.violationPenalty ?? 0,
        notes: updates.notes || null,
        evaluatedBy: updates.evaluatedBy || null,
        evaluatedAt: new Date()
    };

    submission.analytics = currentAnalytics;
    await submissionRepo().save(submission);

    return await getParticipantReport(assessmentId, participantId);
};

// ============================================
// HELPER: BUILD PARTICIPANT REPORT
// ============================================

const buildParticipantReport = async (
    assessmentId: string,
    submission: AssessmentSubmission
): Promise<ParticipantReport> => {
    const userId = submission.userId;

    // Fetch contestant profile
    const profile = await profileRepo().findOne({
        where: {
            user: { id: userId },
            assessment: { id: assessmentId }
        }
    });

    // Fetch user details - FRESH from database to get latest photo URLs
    const user = await userRepo().findOne({
        where: { id: userId }
    });

    // Fetch session
    const session = submission.session || await sessionRepo().findOne({
        where: {
            user: { id: userId },
            assessment: { id: assessmentId }
        },
        order: { createdAt: "DESC" }
    });

    // Fetch invitation
    const invitation = await invitationRepo().findOne({
        where: {
            email: user?.email || "",
            assessment: { id: assessmentId }
        }
    });

    // Fetch violations
    const violations = session ? await violationRepo().find({
        where: { session: { id: session.id } },
        order: { detectedAt: "DESC" }
    }) : [];

    // Fetch ALL answers with necessary relations
    const allAnswers = await answerRepo().find({
        where: { submissionId: submission.id },
        relations: ["problem", "question", "section"]
    });

    // Filter coding answers: distinct from MCQs
    // Includes: 1. Answers linked to a Problem entity
    //           2. Answers linked to a Question entity with type='coding'
    const codingAnswers = allAnswers.filter(a =>
        (a.problemId) ||
        (a.question && a.question.type === "coding")
    );

    // Separate MCQ and coding scores
    let mcqScore = 0, mcqMaxScore = 0, codingScore = 0, codingMaxScore = 0;
    for (const answer of allAnswers) {
        if (answer.questionId && answer.question?.type !== "coding") {
            mcqScore += answer.marksObtained || 0;
            mcqMaxScore += answer.maxMarks || 0;
        } else if (answer.problemId || (answer.question && answer.question.type === "coding")) {
            codingScore += answer.marksObtained || 0;
            codingMaxScore += answer.maxMarks || 0;
        }
    }

    // Build violation summary
    const violationsByType: Record<string, number> = {};
    Object.values(ViolationType).forEach(type => {
        violationsByType[type] = violations.filter(v => v.type === type).length;
    });

    const violationRiskLevel = violations.length >= 10 ? "high" :
        violations.length >= 5 ? "medium" : "low";

    // Calculate time taken
    const timeTaken = session?.startedAt && session?.submittedAt
        ? Math.floor((session.submittedAt.getTime() - session.startedAt.getTime()) / 1000)
        : submission.startedAt && submission.submittedAt
            ? Math.floor((submission.submittedAt.getTime() - submission.startedAt.getTime()) / 1000)
            : 0;

    // Build coding problems details with comprehensive plagiarism data
    const codingProblems = codingAnswers.map(answer => {
        const plagiarismData = answer.codingResult?.plagiarism || null;

        return {
            problemId: answer.problemId!,
            problemTitle: answer.problem?.title || "Unknown",
            language: answer.language,
            code: answer.code,
            passedTests: answer.codingResult?.passedTests || 0,
            totalTests: answer.codingResult?.totalTests || 0,
            testCasesSummary: `${answer.codingResult?.passedTests || 0}/${answer.codingResult?.totalTests || 0}`, // e.g., "3/50" or "50/50"
            score: answer.marksObtained || 0,
            maxScore: answer.maxMarks || 0,
            status: answer.codingResult?.status || "not_attempted",
            executionTime: answer.codingResult?.executionTime,
            memoryUsed: answer.codingResult?.memoryUsed,
            plagiarism: plagiarismData ? {
                similarityPercentage: plagiarismData.similarity || 0,
                aiPercentage: plagiarismData.aiScore || 0,
                verdict: plagiarismData.verdict || "Clean",
                matches: plagiarismData.matches || [],
                reportPath: plagiarismData.reportUrl || null
            } : null
        };
    });

    // Calculate Dynamic Section Scores
    const sections = await sectionRepo().find({
        where: { assessment: { id: assessmentId } },
        order: { order: "ASC" }
    });

    const calculatedSectionScores = sections.map(section => {
        const sectionAnswers = allAnswers.filter(a => a.sectionId === section.id);

        const obtainedMarks = sectionAnswers.reduce((sum, a) => sum + (Number(a.marksObtained) || 0), 0);

        // Accurate Total Marks Calculation
        // Priority: 1. Explicit Section Total -> 2. Count * Marks/Q -> 3. Sum of answers (fallback)
        let totalMarks = section.totalMarks || 0;

        if (totalMarks === 0 && section.questionCount > 0) {
            totalMarks = section.questionCount * (section.marksPerQuestion || 1);
        }

        if (totalMarks === 0) {
            // Fallback: sum of maxMarks from answers (only works if all questions were attempted/initialized)
            totalMarks = sectionAnswers.reduce((sum, a) => sum + (Number(a.maxMarks) || 0), 0);
        }

        const correctAnswers = sectionAnswers.filter(a => a.isCorrect).length;
        // Wrong answers are those ATTEMPTED but not correct
        const wrongAnswers = sectionAnswers.filter(a => !a.isCorrect && a.status === 'attempted').length;

        // Unattempted: Total Questions - (Correct + Wrong) OR explicitly marked unattempted
        // If we trust section.questionCount, use it to find how many we missed completely
        // NOTE: sectionAnswers only contains rows that exist. If user didn't touch a question, no row exists.
        const totalQuestions = section.questionCount > 0 ? section.questionCount : sectionAnswers.length;
        const attemptedCount = correctAnswers + wrongAnswers; // purely from answers that exist
        const unattempted = Math.max(0, totalQuestions - attemptedCount);

        let percentage = 0;
        if (totalMarks > 0) {
            percentage = (obtainedMarks / totalMarks) * 100;
        }

        return {
            sectionId: section.id,
            sectionTitle: section.title,
            sectionType: section.type,
            obtainedMarks: Number(obtainedMarks.toFixed(2)),
            totalMarks: Number(totalMarks.toFixed(2)),
            percentage: Number(percentage.toFixed(2)),
            correctAnswers,
            wrongAnswers,
            unattempted,
            negativeMarks: 0,
            timeTaken: 0
        };
    });

    // Build verdict from analytics
    const verdictData = (submission.analytics as any)?.verdict || {};

    return {
        id: submission.id,
        participantId: userId,

        registration: {
            fullName: profile?.fullName || user?.username || "Unknown",
            email: profile?.email || user?.email || "",
            college: profile?.college || null,
            department: profile?.department || null,
            registrationNumber: profile?.registrationNumber || null,
            cgpa: profile?.cgpa || null,
            resumeUrl: profile?.resumeUrl || null,
            idCardUrl: profile?.idCardUrl || null,
            registeredAt: profile?.createdAt || submission.createdAt
        },

        verification: {
            // ✅ PRIORITY: Use assessment-specific photo from session
            // Fallback to user photo if session photo not available
            photoUrl: session?.photoUrl || user?.photoUrl || null,
            photoOptimizedUrl: session?.photoOptimizedUrl || user?.photoOptimizedUrl || null,
            photoThumbnailUrl: session?.photoThumbnailUrl || user?.photoThumbnailUrl || null,
            faceDescriptor: session?.faceDescriptor || user?.faceDescriptor || null
        },

        session: {
            id: session?.id || "",
            startedAt: session?.startedAt || submission.startedAt,
            submittedAt: session?.submittedAt || submission.submittedAt,
            totalTimeTaken: timeTaken,
            status: session?.status || (submission.status === SubmissionStatus.EVALUATED ? "completed" : "unknown"),
            proctoringConsent: session?.proctoringConsent || false,
            systemChecks: session?.systemChecks || null
        },

        scores: {
            totalScore: parseFloat(submission.totalScore as any) || 0,
            maxScore: parseFloat(submission.maxScore as any) || 0,
            percentage: parseFloat(submission.percentage as any) || 0,
            sectionScores: calculatedSectionScores.length > 0 ? calculatedSectionScores : (submission.sectionScores || []),
            mcqScore,
            mcqMaxScore,
            codingScore,
            codingMaxScore,
            testCases: {
                passed: codingProblems.reduce((sum, cp) => sum + (cp.passedTests || 0), 0),
                total: codingProblems.reduce((sum, cp) => sum + (cp.totalTests || 0), 0)
            }
        },

        codingProblems,

        violations: {
            totalCount: violations.length,
            byType: violationsByType,
            details: violations.map(v => ({
                id: v.id,
                type: v.type,
                detectedAt: v.detectedAt,
                metadata: v.metadata
            })),
            riskLevel: violationRiskLevel
        },

        plagiarism: (submission.analytics as any)?.plagiarism ? {
            overallScore: (submission.analytics as any).plagiarism.maxSimilarity || 0,
            isAiGenerated: (submission.analytics as any).plagiarism.verdict === 'AI Generated',
            aiConfidence: (submission.analytics as any).plagiarism.maxAiScore || 0,
            riskLevel: (submission.analytics as any).plagiarism.verdict === 'Plagiarized' ? 'High' :
                (submission.analytics as any).plagiarism.verdict === 'Suspicious' ? 'Medium' : 'Low',
            verdict: (submission.analytics as any).plagiarism.verdict || 'Clean'
        } : null,

        verdict: {
            status: verdictData.status || (submission.status === SubmissionStatus.EVALUATED ? "passed" : "pending"),
            finalScore: submission.totalScore || 0,
            adjustedScore: verdictData.adjustedScore ?? submission.totalScore ?? 0,
            violationPenalty: verdictData.violationPenalty ?? 0,
            notes: verdictData.notes || null,
            evaluatedBy: verdictData.evaluatedBy || null,
            evaluatedAt: verdictData.evaluatedAt || submission.submittedAt
        },

        timestamps: {
            invitedAt: invitation?.createdAt || null,
            acceptedAt: invitation?.acceptedAt || null,
            startedAt: session?.startedAt || submission.startedAt,
            submittedAt: session?.submittedAt || submission.submittedAt,
            evaluatedAt: submission.updatedAt
        },

        isAutoSubmitted: submission.isAutoSubmitted || false
    };
};

// ============================================
// HELPER: CALCULATE ASSESSMENT STATS
// ============================================

const calculateAssessmentStats = (reports: ParticipantReport[]) => {
    if (reports.length === 0) {
        return {
            totalParticipants: 0,
            completed: 0,
            inProgress: 0,
            notStarted: 0,
            averageScore: 0,
            highestScore: 0,
            lowestScore: 0,
            averageTimeTaken: 0,
            passRate: 0
        };
    }

    const completed = reports.filter(r => r.session.status === "completed").length;
    const inProgress = reports.filter(r => r.session.status === "active").length;

    const scores = reports.map(r => r.scores.totalScore);
    const times = reports.filter(r => r.session.totalTimeTaken > 0).map(r => r.session.totalTimeTaken);

    const passed = reports.filter(r => r.verdict.status === "passed").length;

    return {
        totalParticipants: reports.length,
        completed,
        inProgress,
        notStarted: reports.length - completed - inProgress,
        averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
        highestScore: Math.max(...scores),
        lowestScore: Math.min(...scores),
        averageTimeTaken: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
        passRate: (passed / reports.length) * 100
    };
};

// ============================================
// HELPER: CALCULATE VIOLATION STATS
// ============================================

const calculateViolationStats = (reports: ParticipantReport[]) => {
    const allViolations: Record<string, number> = {};
    let totalViolations = 0;
    let participantsWithViolations = 0;
    let highRiskCount = 0;

    for (const report of reports) {
        totalViolations += report.violations.totalCount;

        if (report.violations.totalCount > 0) {
            participantsWithViolations++;
        }

        if (report.violations.riskLevel === "high") {
            highRiskCount++;
        }

        for (const [type, count] of Object.entries(report.violations.byType)) {
            allViolations[type] = (allViolations[type] || 0) + count;
        }
    }

    return {
        totalViolations,
        participantsWithViolations,
        byType: allViolations,
        highRiskCount
    };
};
