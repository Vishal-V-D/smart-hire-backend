import { AppDataSource } from "../config/db";
import { PlagiarismResult } from "../entities/plagiarismResult.entity";
import { ContestSubmission } from "../entities/contestSubmission.entity";
import axios from "axios";

const plagiarismRepo = () => AppDataSource.getRepository(PlagiarismResult);
const submissionRepo = () => AppDataSource.getRepository(ContestSubmission);

const PLAGIARISM_SERVICE_URL = process.env.PLAGIARISM_SERVICE_URL || "http://localhost:8000/api/v1";

/**
 * Send submission for plagiarism check
 */
export const checkPlagiarism = async (
    contestId: string,
    submissionId: string,
    userId: string,
    username: string,
    contestName: string,
    problemId: string,
    problemName: string, 
    code: string,
    language: string,
    photoUrl?: string,
    passedTests?: number, // ✅ Added
    totalTests?: number   // ✅ Added
) => {
    try {
        if (!code) {
            console.log(`⚠️ Skipping plagiarism check for ${submissionId} (No code provided)`);
            return;
        }

        console.log(`🔍 Sending submission ${submissionId} for plagiarism check...`);

        // Call external plagiarism service
        console.log(`📝 [Plagiarism] Code Snippet (First 50 chars): ${code.substring(0, 50).replace(/\n/g, ' ')}...`);

        // Fetch contest to get plagiarism settings
        const contestRepo = AppDataSource.getRepository("contests"); // Or use Contest entity directly if imported
        // Ideally import Contest entity and use getRepository(Contest)
        // But for minimal changes lets use what we have or add import.
        // Let's rely on standard repo access if `Contest` isn't fully imported in this context? 
        // Actually I should just import Contest. I'll add it to the top imports in a separate step or just assume dynamic import.
        // Wait, I can just use `AppDataSource.getRepository("contests")` which maps to Contest.

        const contest = await AppDataSource.getRepository("contests").findOne({ where: { id: contestId } });
        const config = contest?.plagiarismConfig || {};

        await axios.post(`${PLAGIARISM_SERVICE_URL}/detect`, {
            submission_id: submissionId,
            user_id: userId,
            username: username,
            contest_id: contestId,
            contest_name: contestName,
            problem_id: problemId,
            problem_name: problemName, 
            photo_url: photoUrl, 
            passed_tests: passedTests, // ✅ Send to Python
            total_tests: totalTests,   // ✅ Send to Python
            code: code,
            language: language,
            // 🎛️ Pass Configuration
            strictness: config.strictness || "Medium",
            similarity_threshold: config.similarityThreshold, // Optional, service defaults if null
            ai_sensitivity: config.aiSensitivity || "Medium",
            report_config: config.reportConfig || {
                includeSourceCode: true,
                includeMatches: true,
                includeAiAnalysis: true,
                includeVerdict: true
            }
        });

        console.log(`✅ Plagiarism check initiated for ${submissionId}`);
    } catch (error: any) {
        console.error(`🚨 Plagiarism service error: ${error.message}`);
        // Don't throw, just log. We don't want to fail the submission if plagiarism service is down.
    }
};

/**
 * Handle plagiarism webhook results
 */
export const processPlagiarismWebhook = async (data: any) => {
    const {
        submission_id,
        user_id,
        contest_id,
        problem_id,
        max_similarity,
        verdict,
        ai_score,
        matches,
        report_path
    } = data;

    console.log(`📩 Received plagiarism results for ${submission_id}: ${verdict} (${max_similarity}%)`);

    // Calculate risk level
    let riskLevel = "low";
    if (max_similarity > 80 || verdict === "Plagiarized") riskLevel = "high";
    else if (max_similarity > 50 || verdict === "Suspicious") riskLevel = "medium";

    // Create or update result
    let result = await plagiarismRepo().findOne({
        where: { submissionId: submission_id }
    });

    if (!result) {
        result = plagiarismRepo().create({
            submissionId: submission_id,
            userId: user_id,
            contestId: contest_id,
            problemId: problem_id,
        });
    }

    result.similarityScore = max_similarity;
    result.verdict = verdict;
    result.aiConfidence = ai_score || 0;
    result.isAiGenerated = (ai_score || 0) > 0.8;
    result.matches = matches;
    result.reportPath = report_path;
    result.riskLevel = riskLevel;
    result.analyzedAt = new Date();

    await plagiarismRepo().save(result);

    return result;
};

/**
 * Get plagiarism results for a user
 */
export const getPlagiarismResult = async (contestId: string, userId: string) => {
    return await plagiarismRepo().find({
        where: { contestId, userId },
        order: { similarityScore: "DESC" }
    });
};
