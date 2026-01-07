import { AppDataSource } from "../config/db";
import { User } from "../entities/user.entity";

const fixUsers = async () => {
    try {
        await AppDataSource.initialize();
        console.log("📦 Database connected");

        const repo = AppDataSource.getRepository(User);

        // Update ALL users to be verified using QueryBuilder to avoid empty criteria check
        const result = await repo.createQueryBuilder()
            .update(User)
            .set({ isVerified: true })
            .execute();

        console.log(`✅ Successfully verified ${result.affected} existing users.`);
    } catch (error) {
        console.error("🚨 Error updating users:", error);
    } finally {
        await AppDataSource.destroy();
        process.exit();
    }
};

fixUsers();
