import { AppDataSource } from "../config/db";
import { User, UserRole } from "../entities/user.entity";
import { hashPassword } from "../utils/password.util";

/**
 * Script to create THE single organizer account for the entire application
 * 
 * Usage: ts-node src/scripts/createOrganizer.ts
 * 
 * This creates ONE organizer account that will:
 * - Approve all company registrations
 * - Manage the entire platform
 * - No public registration available for organizers
 */

const createOrganizer = async () => {
    try {
        await AppDataSource.initialize();
        console.log("✅ Database connected\n");

        const userRepo = AppDataSource.getRepository(User);

        // Check if organizer already exists
        const existingOrganizer = await userRepo.findOne({
            where: { role: UserRole.ORGANIZER }
        });

        if (existingOrganizer) {
            console.log("⚠️  Organizer account already exists:");
            console.log(`   Email: ${existingOrganizer.email}`);
            console.log(`   Username: ${existingOrganizer.username}`);
            console.log(`   Organization: ${existingOrganizer.organizationName || 'N/A'}`);
            console.log(`   Verified: ${existingOrganizer.isVerified ? '✅ Yes' : '❌ No'}`);
            console.log("\n💡 If you want to create a new organizer, delete the existing one first.");
            await AppDataSource.destroy();
            process.exit(0);
        }

        // Organizer credentials - CHANGE THESE!
        const ORGANIZER_EMAIL = "admin@smarthire.com";
        const ORGANIZER_USERNAME = "smarthire_admin";
        const ORGANIZER_PASSWORD = "Admin@123"; // CHANGE THIS IN PRODUCTION!
        const ORGANIZATION_NAME = "SmartHire Platform";

        console.log("🔐 Creating organizer account...\n");

        const hashedPassword = await hashPassword(ORGANIZER_PASSWORD);

        const organizer = userRepo.create({
            email: ORGANIZER_EMAIL,
            username: ORGANIZER_USERNAME,
            password: hashedPassword,
            role: UserRole.ORGANIZER,
            organizationName: ORGANIZATION_NAME,
            isVerified: true, // Pre-verified
            fullName: "SmartHire Administrator"
        });

        await userRepo.save(organizer);

        console.log("✅ Organizer account created successfully!\n");
        console.log("─".repeat(60));
        console.log("📋 Account Details:");
        console.log("─".repeat(60));
        console.log(`   Email:        ${ORGANIZER_EMAIL}`);
        console.log(`   Username:     ${ORGANIZER_USERNAME}`);
        console.log(`   Password:     ${ORGANIZER_PASSWORD}`);
        console.log(`   Organization: ${ORGANIZATION_NAME}`);
        console.log(`   Role:         ${UserRole.ORGANIZER}`);
        console.log("─".repeat(60));
        console.log("\n⚠️  IMPORTANT: Change the password after first login!");
        console.log("💡 This is the ONLY organizer account for the entire platform.");

        await AppDataSource.destroy();
        process.exit(0);
    } catch (error) {
        console.error("❌ Error creating organizer:", error);
        await AppDataSource.destroy();
        process.exit(1);
    }
};

createOrganizer();
