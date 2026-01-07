import { Request, Response } from "express";
import { AppDataSource } from "../config/db";
import { User } from "../entities/user.entity";


export class UserController {
    private userRepo = AppDataSource.getRepository(User);
    // Follow logic removed

    // Upload user photo
    async uploadPhoto(req: Request, res: Response) {
        try {
            const userId = (req as any).user.userId || (req as any).user.id;
            const file = req.file;

            if (!file) {
                return res.status(400).json({ message: "Photo is required" });
            }

            // Upload and optimize
            const urls = await import("../services/supabase.service").then(s => s.uploadUserPhoto(file, userId));

            // Update user record
            await this.userRepo.update(userId, {
                photoUrl: urls.originalUrl,
                photoOptimizedUrl: urls.optimizedUrl,
                photoThumbnailUrl: urls.thumbnailUrl
            });

            res.json({
                message: "Photo uploaded successfully",
                data: urls
            });
        } catch (error: any) {
            console.error("Error uploading photo:", error);
            res.status(500).json({ message: error.message || "Error uploading photo" });
        }
    }

    // Get user photo
    async getPhoto(req: Request, res: Response) {
        try {
            const { userId } = req.params;
            const user = await this.userRepo.findOne({
                where: { id: userId },
                select: ["photoUrl", "photoOptimizedUrl", "photoThumbnailUrl", "updatedAt"]
            });

            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            res.json({
                originalUrl: user.photoUrl,
                optimizedUrl: user.photoOptimizedUrl,
                thumbnailUrl: user.photoThumbnailUrl,
                updatedAt: user.updatedAt
            });
        } catch (error) {
            console.error("Error fetching photo:", error);
            res.status(500).json({ message: "Error fetching photo" });
        }
    }
}
