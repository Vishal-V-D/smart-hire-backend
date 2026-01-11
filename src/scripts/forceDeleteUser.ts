import { AppDataSource } from "../config/db";
import { User } from "../entities/user.entity";
import { ContestantProfile } from "../entities/ContestantProfile.entity";

// Usage: ts-node src/scripts/forceDeleteUser.ts <userId>
const userId = process.argv[2] || "068f850c-9894-4eee-b9eb-1992e85821d3";

const forceDeleteUser = async () => {
    try {
        await AppDataSource.initialize();
        console.log(`✅ Database connected. Attempting to delete user: ${userId}`);

        // 1. Delete dependent ContestantProfiles first
        console.log("🗑️ Deleting related Contestant Profiles...");
        const profileRepo = AppDataSource.getRepository(ContestantProfile);
        const userRepo = AppDataSource.getRepository(User);

        const deleteProfiles = await profileRepo
            .createQueryBuilder()
            .delete()
            .from(ContestantProfile)
            .where("userId = :id", { id: userId })
            .execute();

        console.log(`   Deleted ${deleteProfiles.affected} profile(s).`);

        // 2. Delete the User
        console.log("👤 Deleting User record...");
        const deleteUser = await userRepo
            .createQueryBuilder()
            .delete()
            .from(User)
            .where("id = :id", { id: userId })
            .execute();

        if (deleteUser.affected === 0) {
            console.log("⚠️ User not found or already deleted.");
        } else {
            console.log("✅ User deleted successfully.");
        }

        await AppDataSource.destroy();
        process.exit(0);
    } catch (error) {
        console.error("❌ Error deleting user:", error);
        process.exit(1);
    }
};

forceDeleteUser();
