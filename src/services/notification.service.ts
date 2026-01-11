import { AppDataSource } from "../config/db";
import { Notification, NotificationType } from "../entities/Notification.entity";
import { User, UserRole } from "../entities/user.entity";
import { Company } from "../entities/Company.entity";
import { emitOrganizerNotification, emitCompanyNotification } from "../utils/socket";

const notificationRepo = () => AppDataSource.getRepository(Notification);
const userRepo = () => AppDataSource.getRepository(User);

interface CreateNotificationDTO {
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
    // Targets (pick at least one)
    userId?: string;          // Specific user
    companyId?: string;       // All admins of this company
    isGlobalOrganizer?: boolean; // All organizers
}

/**
 * Create and persist a notification, then emit it via socket
 */
export const createNotification = async (dto: CreateNotificationDTO) => {
    const notification = notificationRepo().create({
        type: dto.type,
        title: dto.title,
        message: dto.message,
        data: dto.data,
        userId: dto.userId,
        companyId: dto.companyId,
        isGlobalOrganizer: dto.isGlobalOrganizer
    });

    const savedNotification = await notificationRepo().save(notification);
    console.log(`[DEBUG] Notification persisted to DB: ${savedNotification.id} (${dto.title})`);

    // 🚀 Emit Real-time Events based on target

    // 1. Notify Organizer
    if (dto.isGlobalOrganizer) {
        const istTime = savedNotification.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
        console.log(`[DEBUG] Emitting notification to Global Organizer room at: ${istTime}`);
        emitOrganizerNotification({
            id: savedNotification.id,
            type: savedNotification.type as any,
            title: savedNotification.title,
            message: savedNotification.message,
            data: savedNotification.data,
            timestamp: savedNotification.createdAt
        });
    }

    // 2. Notify Company (All Admins)
    if (dto.companyId) {
        const istTime = savedNotification.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
        console.log(`[DEBUG] Emitting notification to Company room: company_${dto.companyId} at: ${istTime}`);
        emitCompanyNotification(dto.companyId, {
            id: savedNotification.id,
            type: savedNotification.type as any,
            title: savedNotification.title,
            message: savedNotification.message,
            data: savedNotification.data,
            timestamp: savedNotification.createdAt
        });
    }

    // 3. Notify Specific User (if you had a user-specific socket room, you'd emit here)
    // For now, they will see it when they poll the API or if they are covered by above rooms.

    return savedNotification;
};

/**
 * Get notifications for a specific user
 * - Fetches notifications targeted specifically to them
 * - Fetches notifications targeted to their company (if they are in one)
 * - Fetches organizer global notifications (if they are an organizer)
 */
export const getUserNotifications = async (userId: string, page = 1, limit = 20) => {
    const user = await userRepo().findOne({ where: { id: userId }, relations: ["company"] });
    if (!user) throw { status: 404, message: "User not found" };

    const query = notificationRepo().createQueryBuilder("notification");

    // Build OR condition
    // 1. Targeted directly to user
    query.where("notification.userId = :userId", { userId });

    // 2. Targeted to their company (if they have one)
    if (user.companyId) {
        query.orWhere("notification.companyId = :companyId", { companyId: user.companyId });
    }

    // 3. Targeted to organizers (if they are one)
    if (user.role === UserRole.ORGANIZER) {
        query.orWhere("notification.isGlobalOrganizer = :isGlobal", { isGlobal: true });
    }

    query
        .orderBy("notification.createdAt", "DESC")
        .skip((page - 1) * limit)
        .take(limit);

    const [notifications, total] = await query.getManyAndCount();

    if (notifications.length > 0) {
        console.log(`[DEBUG] Fetched ${notifications.length} notifications. Most recent at: ${notifications[0].createdAt}`);
    }

    return {
        data: notifications,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
};

/**
 * Mark a notification as read
 * - Security: Ensures the user is actually allowed to read this notification
 */
export const markAsRead = async (userId: string, notificationId: string) => {
    const user = await userRepo().findOne({ where: { id: userId } });
    if (!user) throw { status: 404, message: "User not found" };

    const notification = await notificationRepo().findOne({ where: { id: notificationId } });
    if (!notification) throw { status: 404, message: "Notification not found" };

    // Verify Ownership/Access
    let hasAccess = false;
    if (notification.userId === userId) hasAccess = true;
    if (notification.companyId && user.companyId === notification.companyId) hasAccess = true;
    if (notification.isGlobalOrganizer && user.role === UserRole.ORGANIZER) hasAccess = true;

    if (!hasAccess) {
        throw { status: 403, message: "You do not have permission to access this notification" };
    }

    notification.isRead = true;
    await notificationRepo().save(notification);

    return { message: "Notification marked as read" };
};

/**
 * Mark ALL notifications as read for a user
 * Note: For shared notifications (company/organizer), this marks the record itself as read.
 * In a more complex system, you'd have a separate "UserReadNotification" table mapping.
 * For this MVP, if one admin reads a company alert, it marks it read for everyone (Shared Inbox style).
 * UNLESS we want per-user read status for shared items, which is complex.
 * 
 * SIMPLE APPROACH (Per User Reading):
 * Since we are using a single Notification table, "isRead" is global for that notification.
 * If Organizer A reads it, Organizer B sees it as read.
 * If Company Admin A reads it, Admin B sees it as read.
 * This is acceptable for a "Shared Dashboard" model.
 */
export const markAllAsRead = async (userId: string) => {
    // Fetch all unread relevant to user
    const user = await userRepo().findOne({ where: { id: userId } });
    if (!user) throw { status: 404, message: "User not found" };

    let whereClauses = [{ userId: userId, isRead: false }];
    if (user.companyId) whereClauses.push({ companyId: user.companyId, isRead: false } as any);
    if (user.role === UserRole.ORGANIZER) whereClauses.push({ isGlobalOrganizer: true, isRead: false } as any);

    // Note: TypeORM doesn't support OR in simple update() efficiently without query builder for complex conditions
    // We will use the same query logic as 'get' to find IDs, then update them.

    const query = notificationRepo().createQueryBuilder("notification")
        .select("notification.id")
        .where("notification.isRead = :isRead", { isRead: false })
        .andWhere(
            "(notification.userId = :userId OR notification.companyId = :companyId OR notification.isGlobalOrganizer = :isGlobal)",
            { userId, companyId: user.companyId || '00000000-0000-0000-0000-000000000000', isGlobal: user.role === UserRole.ORGANIZER }
        );

    const notificationsToUpdate = await query.getMany();
    const ids = notificationsToUpdate.map(n => n.id);

    if (ids.length > 0) {
        await notificationRepo().update(ids, { isRead: true });
    }

    return { message: `Marked ${ids.length} notifications as read` };
};

/**
 * Clean up old notifications (Optional utility)
 */
export const deleteOldNotifications = async (days = 30) => {
    const date = new Date();
    date.setDate(date.getDate() - days);

    await notificationRepo()
        .createQueryBuilder()
        .delete()
        .from(Notification)
        .where("createdAt < :date", { date })
        .execute();
};
