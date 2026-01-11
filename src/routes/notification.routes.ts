import { Router } from "express";
import { checkAuth } from "../middleware/auth.middleware";
import * as notificationService from "../services/notification.service";
import { Request, Response } from "express";

const router = Router();

// GET /api/notifications - Get my notifications
router.get("/", checkAuth, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        console.log(`[DEBUG] Fetching notifications for user: ${userId}`);
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;

        const result = await notificationService.getUserNotifications(userId, page, limit);
        console.log(`[DEBUG] Fetched ${result.data.length} notifications (total: ${result.meta.total}) for user: ${userId}`);
        res.json(result);
    } catch (error: any) {
        console.error(`[DEBUG] Error fetching notifications for user ${((req as any).user || {}).id}:`, error);
        res.status(error.status || 500).json({ message: error.message });
    }
});

// PUT /api/notifications/:id/read - Mark one as read
router.put("/:id/read", checkAuth, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        console.log(`[DEBUG] Mark READ request for notification: ${req.params.id} by user: ${userId}`);
        const result = await notificationService.markAsRead(userId, req.params.id);
        console.log(`[DEBUG] Notification ${req.params.id} marked as READ for user: ${userId}`);
        res.json(result);
    } catch (error: any) {
        console.error(`[DEBUG] Error marking notification ${req.params.id} as read:`, error);
        res.status(error.status || 500).json({ message: error.message });
    }
});

// PUT /api/notifications/read-all - Mark ALL as read
router.put("/read-all", checkAuth, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        console.log(`[DEBUG] Mark ALL READ request by user: ${userId}`);
        const result = await notificationService.markAllAsRead(userId);
        console.log(`[DEBUG] All notifications marked as READ for user: ${userId}`);
        res.json(result);
    } catch (error: any) {
        console.error(`[DEBUG] Error marking ALL notifications as read by user ${((req as any).user || {}).id}:`, error);
        res.status(error.status || 500).json({ message: error.message });
    }
});

export default router;
