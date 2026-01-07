import { AppDataSource } from "../config/db";
import { SecureContestResult } from "../entities/SecureContestResult.entity";

const repo = () => AppDataSource.getRepository(SecureContestResult);

/**
 * Get a single Secure Contest Result by ID
 */
export const getResult = async (id: string) => {
    const result = await repo().findOne({
        where: { id },
        relations: ["user", "contest"],
    });
    if (!result) throw { status: 404, message: "Result not found" };
    return result;
};

/**
 * Update a Secure Contest Result
 * Allows updating top-level fields AND merged fields for JSONB columns
 */
export const updateResult = async (id: string, data: any) => {
    const result = await repo().findOne({ where: { id } });
    if (!result) throw { status: 404, message: "Result not found" };

    // Update Top-Level Fields
    if (data.finalScore !== undefined) result.finalScore = data.finalScore;
    if (data.plagiarismScore !== undefined) result.plagiarismScore = data.plagiarismScore;
    if (data.suspiciousScore !== undefined) result.suspiciousScore = data.suspiciousScore;
    if (data.aiScore !== undefined) result.aiScore = data.aiScore;
    if (data.isAiGenerated !== undefined) result.isAiGenerated = data.isAiGenerated;
    if (data.violationPenalty !== undefined) result.violationPenalty = data.violationPenalty;
    if (data.totalBaseScore !== undefined) result.totalBaseScore = data.totalBaseScore;

    // Update JSON Fields (Merge logic)
    if (data.violationReport) {
        result.violationReport = { ...result.violationReport, ...data.violationReport };
    }

    if (data.plagiarismReport) {
        result.plagiarismReport = { ...result.plagiarismReport, ...data.plagiarismReport };
    }

    if (data.timeMetrics) {
        result.timeMetrics = { ...result.timeMetrics, ...data.timeMetrics };
    }

    if (data.resultDetails) {
        result.resultDetails = { ...result.resultDetails, ...data.resultDetails };
    }

    return await repo().save(result);
};

/**
 * Delete a Secure Contest Result
 */
export const deleteResult = async (id: string) => {
    const result = await repo().findOne({ where: { id } });
    if (!result) throw { status: 404, message: "Result not found" };

    await repo().remove(result);
    return { message: "Result deleted successfully" };
};
