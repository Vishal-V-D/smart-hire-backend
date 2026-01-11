import { AppDataSource } from "../config/db";
import { CompanyRequestLog, RequestAction } from "../entities/CompanyRequestLog.entity";

const repo = () => AppDataSource.getRepository(CompanyRequestLog);

/**
 * Log a company-related request or action
 */
export const logRequest = async (
    action: RequestAction,
    actorId: string,
    companyId?: string | null,
    targetUserId?: string | null,
    details?: any
) => {
    try {
        const log = repo().create({
            action,
            actor: actorId ? { id: actorId } as any : undefined,
            // Store IDs even if relations are null (for history of deleted items)
            companyId: companyId || undefined,
            // If we are rejecting/deleting, we might not want to set the relation to avoid FK constraints if it's about to be deleted? 
            // Better approach: Set relation ONLY if ID is present.
            // However, REJECT_ADMIN removes the user, so targetUser relation will fail if saved AFTER delete? 
            // Wait, we log BEFORE delete, so relation should be fine, unless ID is empty.
            company: companyId ? { id: companyId } as any : undefined,
            targetUserId: targetUserId || undefined,
            targetUser: targetUserId ? { id: targetUserId } as any : undefined,
            details
        });
        await repo().save(log);
        console.log(`[LOG] Action: ${action} by ${actorId} on Company ${companyId}`);
    } catch (error) {
        console.error("❌ Failed to log request:", error);
    }
};

/**
 * Fetch logs for an Organizer (All logs for companies they manage)
 * Currently fetched by company ID or all logs if needed.
 */
export const getLogsForCompany = async (companyId: string) => {
    return await repo().find({
        where: { company: { id: companyId } },
        relations: ["actor", "targetUser"],
        order: { createdAt: "DESC" }
    });
};

/**
 * Fetch all logs (Organizer Global View)
 * In future, filter by organizer's approved companies if needed.
 */
export const getAllLogs = async () => {
    return await repo().find({
        relations: ["actor", "targetUser", "company"],
        order: { createdAt: "DESC" },
        take: 100 // Limit to last 100 actions for performance
    });
};
