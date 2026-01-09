import { AppDataSource } from "../config/db";
import { AssessmentViolation, ViolationType } from "../entities/AssessmentViolation.entity";
import { AssessmentSession } from "../entities/AssessmentSession.entity";
import { MoreThan, In } from "typeorm";

const violationRepo = () => AppDataSource.getRepository(AssessmentViolation);
const sessionRepo = () => AppDataSource.getRepository(AssessmentSession);

/**
 * Record a violation
 */
/**
 * Record a violation
 */
export const recordViolation = async (
    sessionToken: string,
    type: string,
    metadata?: any
): Promise<AssessmentViolation> => {
    // Validate session
    const session = await sessionRepo().findOne({
        where: { sessionToken },
        relations: ["user", "assessment"]
    });
    if (!session) {
        throw { status: 401, message: "Invalid session" };
    }

    // Determine violation type
    let violationType = ViolationType.WINDOW_SWAP;
    if (Object.values(ViolationType).includes(type as ViolationType)) {
        violationType = type as ViolationType;
    }

    // Create violation record
    const violation = violationRepo().create({
        session,
        assessmentId: session.assessment?.id || session.assessmentId, // Store assessmentId directly
        type: violationType,
        metadata: {
            ...metadata,
            timestamp: metadata?.timestamp || new Date().toISOString(), // Ensure timestamp exists in metadata
            serverRecievedAt: new Date().toISOString()
        },
        detectedAt: new Date() // Explicitly set server timestamp
    });

    const saved = await violationRepo().save(violation);

    // Log for realtime monitoring
    console.log(`⚠️ [VIOLATION] Recorded ${violationType} for session ${session.id}`);
    console.log(`   📝 Saved ID: ${saved.id}, Time: ${saved.detectedAt.toISOString()}`);

    return saved;
};

// ... (skipping unchanged functions)

/**
 * Get realtime violations (for polling - violations since a timestamp)
 */
export const getRealtimeViolations = async (
    assessmentId: string,
    sinceTimestamp: Date
) => {
    console.log(`\n🔴 [REALTIME] Fetching violations for assessment ${assessmentId}`);

    // User requested "send all violations" to ensure persistence on frontend reload.
    // We ignore the 'since' timestamp filter and always return the recent history.
    // This allows the frontend to deduplicate or replace its list, ensuring no data is hidden.

    // FETCH recent violations for this assessment (latest 100)
    const violations = await violationRepo().find({
        where: {
            assessmentId, // Filter by assessmentId only
        },
        relations: ["session", "session.user", "session.invitation", "session.assessment"],
        order: { detectedAt: "DESC" },
        take: 100 // Always return last 100 items to ensure history visibility
    });

    console.log(`   Found ${violations.length} violations for assessment ${assessmentId} (returning ALL history)`);

    // Log details as requested
    violations.forEach((v, index) => {
        // Robust Name Resolution
        const userName =
            v.session?.user?.username ||
            v.session?.invitation?.name ||
            v.session?.invitation?.email?.split('@')[0] ||
            v.session?.user?.email?.split('@')[0] ||
            `Candidate ${v.session?.id?.slice(0, 4) || 'Unknown'}`;

        const userEmail = v.session?.user?.email || v.session?.invitation?.email || "";

        const violationName = v.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const time = v.detectedAt.toLocaleTimeString();
        console.log(`   👉 [${time}] ${userName} (${userEmail}): ${violationName}`);
    });

    const lastTimestamp = violations.length > 0
        ? violations[0].detectedAt
        : sinceTimestamp;

    // Deduplicate violations to prevent frontend key errors
    const uniqueViolations = Array.from(new Map(violations.map(v => [v.id, v])).values());

    return {
        violations: uniqueViolations.map(v => {
            const userName =
                v.session?.user?.username ||
                v.session?.invitation?.name ||
                v.session?.invitation?.email?.split('@')[0] ||
                v.session?.user?.email?.split('@')[0] ||
                `Candidate ${v.session?.id?.slice(0, 4) || 'Unknown'}`;

            return {
                id: v.id,
                type: v.type,
                typeName: v.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                metadata: v.metadata,
                detectedAt: v.detectedAt, // ISO Date object/string
                timestamp: v.detectedAt,  // Alias for frontend compatibility
                timeAgo: getTimeAgo(v.detectedAt),
                // Flattened user info for easier frontend access if needed
                userName: userName,
                userEmail: v.session?.user?.email || v.session?.invitation?.email || '',
                session: v.session ? {
                    id: v.session.id,
                    status: v.session.status,
                } : null,
                user: {
                    id: v.session?.user?.id || null,
                    username: userName,
                    name: userName, // Ensure 'name' is populated
                    email: v.session?.user?.email || v.session?.invitation?.email || ''
                },
            };
        }),
        lastTimestamp,
        count: violations.length,
        assessmentId
    };
};

/**
 * Get violations for a session (Organizer view)
 */
export const getViolationsForSession = async (sessionId: string) => {
    return await violationRepo().find({
        where: { session: { id: sessionId } },
        order: { detectedAt: "DESC" },
    });
};

/**
 * Get all violations for an assessment (Admin/Organizer view)
 * With pagination, filtering, and sorting
 */
export const getAllViolationsForAssessment = async (
    assessmentId: string,
    options: {
        page?: number;
        limit?: number;
        types?: ViolationType[];
        sessionId?: string;
        sinceTimestamp?: Date;
    } = {}
) => {
    const { page = 1, limit = 50, types, sessionId, sinceTimestamp } = options;
    const skip = (page - 1) * limit;

    console.log(`\n📊 [VIOLATIONS] Fetching ALL violations for assessment ${assessmentId}`);

    let queryBuilder = violationRepo()
        .createQueryBuilder("violation")
        .leftJoinAndSelect("violation.session", "session")
        .leftJoinAndSelect("session.user", "user")
        .leftJoinAndSelect("session.invitation", "invitation")
        .where("violation.assessmentId = :assessmentId", { assessmentId });

    if (types && types.length > 0) {
        queryBuilder.andWhere("violation.type IN (:...types)", { types });
    }

    if (sessionId) {
        queryBuilder.andWhere("session.id = :sessionId", { sessionId });
    }

    if (sinceTimestamp) {
        queryBuilder.andWhere("violation.detectedAt > :sinceTimestamp", { sinceTimestamp });
    }

    const [violations, total] = await queryBuilder
        .orderBy("violation.detectedAt", "DESC")
        .skip(skip)
        .take(limit)
        .getManyAndCount();

    console.log(`   Found ${total} violations`);

    return {
        violations: violations.map(v => {
            const userName =
                v.session?.user?.username ||
                v.session?.invitation?.name ||
                v.session?.invitation?.email?.split('@')[0] ||
                v.session?.user?.email?.split('@')[0] ||
                `Candidate ${v.session?.id?.slice(0, 4) || 'Unknown'}`;

            return {
                id: v.id,
                type: v.type,
                metadata: v.metadata,
                detectedAt: v.detectedAt,
                session: v.session ? {
                    id: v.session.id,
                    status: v.session.status,
                } : null,
                user: {
                    id: v.session?.user?.id || null,
                    username: userName,
                    name: userName,
                    email: v.session?.user?.email || v.session?.invitation?.email || "",
                },
            };
        }),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};

/**
 * Get violation statistics for an assessment
 */
export const getViolationStatsForAssessment = async (assessmentId: string) => {
    console.log(`\n📊 [STATS] Getting violation stats for assessment ${assessmentId}`);

    // Fetch violations filtered by assessmentId (Ordered by most recent)
    const violations = await violationRepo()
        .createQueryBuilder("violation")
        .leftJoinAndSelect("violation.session", "session")
        .leftJoinAndSelect("session.user", "user")
        .leftJoinAndSelect("session.invitation", "invitation")
        .where("violation.assessmentId = :assessmentId", { assessmentId })
        .orderBy("violation.detectedAt", "DESC") // ✅ Sort by recent first
        .getMany();

    console.log(`   Found ${violations.length} violations for assessment ${assessmentId}`);

    if (violations.length === 0) {
        return {
            totalViolations: 0,
            violationsByType: {},
            violationsPerSession: [],
            recentViolationsCount: 0,
            highRiskSessions: []
        };
    }

    // Aggregation Logic: Group by Session (User)
    const userStatsMap: Record<string, any> = {};

    violations.forEach(v => {
        const sessionId = v.session.id;
        const userName =
            v.session?.user?.username ||
            v.session?.invitation?.name ||
            v.session?.invitation?.email?.split('@')[0] ||
            v.session?.user?.email?.split('@')[0] ||
            `Candidate ${v.session?.id?.slice(0, 4) || 'Unknown'}`;
        const userEmail = v.session?.user?.email || v.session?.invitation?.email || "";

        if (!userStatsMap[sessionId]) {
            userStatsMap[sessionId] = {
                user: {
                    name: userName,
                    email: userEmail,
                    username: userName
                },
                totalViolations: 0,
                violationsByType: {}, // Breakdown: { "window_swap": 5, "tab_switch": 2 }
                violations: []        // Detailed list if needed (or summarized)
            };
        }

        // Increment Total
        userStatsMap[sessionId].totalViolations++;

        // Increment Type Count
        if (!userStatsMap[sessionId].violationsByType[v.type]) {
            userStatsMap[sessionId].violationsByType[v.type] = 0;
        }
        userStatsMap[sessionId].violationsByType[v.type]++;

        // Add to detailed list (optional, but requested "each violations")
        userStatsMap[sessionId].violations.push({
            type: v.type,
            detectedAt: v.detectedAt,
            metadata: v.metadata
        });
    });

    // Convert Map to Array & Sort by Count DESC
    const users = Object.values(userStatsMap).sort((a: any, b: any) => b.totalViolations - a.totalViolations);

    // Calculate global stats (overall dashboard)
    const violationsByType: Record<string, number> = {};
    Object.values(ViolationType).forEach(type => {
        violationsByType[type] = violations.filter(v => v.type === type).length;
    });

    return {
        totalViolations: violations.length,
        violationsByType, // Global breakdown
        users,            // ⭐ New User-Centric List requested
        // Legacy support (optional)
        violationsPerSession: users.map((u: any) => ({
            sessionId: "unknown", // Map doesn't keep session ID as key in array, but UI might not need it if usage changed
            count: u.totalViolations,
            user: u.user
        })),
        recentViolationsCount: 0, // Simplified
        highRiskSessions: []
    };
};

/**
 * Get realtime violations (legacy function removed)
 */

// Helper function to format time ago
const getTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
};
