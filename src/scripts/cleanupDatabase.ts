import { AppDataSource } from "../config/db";
import { User, UserRole } from "../entities/user.entity";

const cleanupContestants = async () => {
    try {
        await AppDataSource.initialize();
        console.log("🧹 Starting Contestant Cleanup...");

        const userRepo = AppDataSource.getRepository(User);

        // 1. Find all users with role = CONTESTANT
        const usersToDelete = await userRepo
            .createQueryBuilder("user")
            .where("user.role = :role", { role: UserRole.CONTESTANT })
            .getMany();

        console.log(`🔍 Found ${usersToDelete.length} CONTESTANT account(s) to delete.`);

        if (usersToDelete.length === 0) {
            console.log("✅ No contestants to delete. Exiting.");
            process.exit(0);
        }

        const userIds = usersToDelete.map(u => u.id);

        // 2. Delete Users (Cascade will handle profiles, submissions, etc.)
        console.log("🗑️ Deleting users...");
        await userRepo.delete(userIds);
        console.log(`✅ Deleted ${userIds.length} contestant accounts.`);

        console.log("✨ Cleanup Complete!");
        await AppDataSource.destroy();
        process.exit(0);
    } catch (error) {
        console.error("❌ Cleanup Failed:", error);
        process.exit(1);
    }
};

cleanupContestants();
