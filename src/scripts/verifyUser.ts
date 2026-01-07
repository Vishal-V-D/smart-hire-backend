import { AppDataSource } from "../config/db";
import { User } from "../entities/user.entity";

/**
 * Script to verify a user's email manually
 * Usage: ts-node src/scripts/verifyUser.ts <email>
 */

const verifyUserEmail = async (email: string) => {
    try {
        await AppDataSource.initialize();
        console.log("✅ Database connected");

        const userRepo = AppDataSource.getRepository(User);

        const user = await userRepo.findOne({ where: { email } });

        if (!user) {
            console.log(`❌ User with email ${email} not found`);
            process.exit(1);
        }

        console.log(`\n📋 User Details:`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Verified: ${user.isVerified}`);
        console.log(`   Created: ${user.createdAt}`);

        if (user.isVerified) {
            console.log(`\n✅ User ${email} is already verified!`);
        } else {
            user.isVerified = true;
            user.verificationToken = null as any;
            await userRepo.save(user);
            console.log(`\n✅ User ${email} has been verified successfully!`);
        }

        await AppDataSource.destroy();
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
};

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
    console.log("❌ Usage: ts-node src/scripts/verifyUser.ts <email>");
    process.exit(1);
}

verifyUserEmail(email);
