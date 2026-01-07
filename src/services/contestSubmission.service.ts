import { AppDataSource } from "../config/db";
import { ContestSubmission } from "../entities/contestSubmission.entity";
import { Contest } from "../entities/contest.entity";
import { User } from "../entities/user.entity";
import { ContestRegistration } from "../entities/contestRegistration.entity";
import { Problem } from "../entities/problem.entity";
import axios from "axios";

const submissionRepo = () => AppDataSource.getRepository(ContestSubmission);
const contestRepo = () => AppDataSource.getRepository(Contest);
const userRepo = () => AppDataSource.getRepository(User);
const problemRepo = () => AppDataSource.getRepository(Problem);

// Secure Submission Service URL
const SECURE_SUBMISSION_SERVICE = process.env.SECURE_SUBMISSION_SERVICE_URL || "http://localhost:6000";

/**
 * Submit code (Auto or Manual)
 */
export const submitCode = async (
    contestId: string,
    userId: string,
    problemId: string,
    code: string,
    language: string,
    isAutoSubmitted: boolean = false
) => {
    const contest = await contestRepo().findOne({ where: { id: contestId } });
    if (!contest) throw { status: 404, message: "Contest not found" };

    const user = await userRepo().findOne({ where: { id: userId } });
    if (!user) throw { status: 404, message: "User not found" };

    // Check if user has finished the contest
    const registrationRepo = AppDataSource.getRepository(ContestRegistration);
    const registration = await registrationRepo.findOne({ where: { contestId, userId } });

    if (registration?.finishedAt) {
        throw { status: 403, message: "Contest already finished. No further submissions allowed." };
    }

    // Fetch problem for its title
    const problem = await problemRepo().findOne({ where: { id: problemId } });
    const problemName = problem?.title || "Problem";

    console.log(`🚀 [SecureHire] Calling Secure Submission Service for user ${user.username}, problem ${problemId}`);

    // Call Secure Submission Service to execute code
    let executionResult;
    try {
        const response = await axios.post(`${SECURE_SUBMISSION_SERVICE}/api/execution/run`, {
            contestId,
            userId,
            username: user.username,
            problemId,
            code,
            language,
            contestName: contest.title
        });
        executionResult = response.data;
        console.log("✅ [SecureHire] Execution successful:", executionResult.verdict);
    } catch (err: any) {
        console.error("🚨 [SecureHire] Secure Submission Service failed:", err.message);
        throw { status: 500, message: "Code execution failed. Please try again." };
    }

    // Create submission with results
    const submission = submissionRepo().create({
        contestId,
        userId,
        problemId,
        code,
        language,
        isAutoSubmitted,
        status: executionResult.verdict,
        executionTime: executionResult.executionTime,
        memoryUsed: executionResult.memoryUsed,
        passedTests: executionResult.passedTests,
        totalTests: executionResult.totalTests,
        output: executionResult.output, // Store log/feedback
        submittedAt: new Date()
    });

    await submissionRepo().save(submission);

    return submission;
};

/**
 * Get user submissions
 */
export const getUserSubmissions = async (contestId: string, userId: string) => {
    return await submissionRepo().find({
        where: { contestId, userId },
        order: { submittedAt: "DESC" }
    });
};

/**
 * Get submission details
 */
export const getSubmission = async (submissionId: string) => {
    return await submissionRepo().findOne({
        where: { id: submissionId },
        relations: ["user", "problem"]
    });
};
