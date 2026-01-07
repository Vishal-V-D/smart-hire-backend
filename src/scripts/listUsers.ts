import { AppDataSource } from "../config/db";
import { User } from "../entities/user.entity";

/**
 * Script to list all users in the database
 * Usage: ts-node src/scripts/listUsers.ts
 */

const listUsers = async () => {
    try {
        await AppDataSource.initialize();
        console.log("✅ Database connected\n");

        const userRepo = AppDataSource.getRepository(User);

        const users = await userRepo.find({
            order: { createdAt: "DESC" }
        });

        if (users.length === 0) {
            console.log("❌ No users found in database");
            process.exit(0);
        }

        console.log(`📋 Found ${users.length} user(s):\n`);
        console.log("─".repeat(100));

        users.forEach((user, index) => {
            console.log(`${index + 1}. ${user.username} (${user.email})`);
            console.log(`   Role: ${user.role}`);
            console.log(`   Verified: ${user.isVerified ? "✅ Yes" : "❌ No"}`);
            console.log(`   Google ID: ${user.googleId || "N/A"}`);
            console.log(`   Created: ${user.createdAt}`);
            console.log("─".repeat(100));
        });

        await AppDataSource.destroy();
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
};

listUsers();
