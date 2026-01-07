import { AppDataSource } from "../config/db";
import { Assessment } from "../entities/Assessment.entity";

/**
 * Verify that navigation settings are present in assessments
 */

const checkNavigationSettings = async () => {
    try {
        await AppDataSource.initialize();
        console.log("✅ Database connected\n");

        const assessmentRepo = AppDataSource.getRepository(Assessment);

        // Get a sample assessment
        const assessment = await assessmentRepo.findOne({
            where: {},
            order: { createdAt: "DESC" },
        });

        if (!assessment) {
            console.log("❌ No assessments found");
            await AppDataSource.destroy();
            process.exit(1);
        }

        console.log("📋 Assessment Details:");
        console.log(`   ID: ${assessment.id}`);
        console.log(`   Title: ${assessment.title}`);
        console.log(`\n🧭 Navigation Settings:`);
        console.log(`   Allow Previous Navigation: ${assessment.allowPreviousNavigation}`);
        console.log(`   Allow Mark For Review: ${assessment.allowMarkForReview}`);
        
        if (assessment.allowPreviousNavigation !== undefined && assessment.allowMarkForReview !== undefined) {
            console.log("\n✅ Navigation settings are properly configured!");
        } else {
            console.log("\n❌ Navigation settings are missing!");
        }

        await AppDataSource.destroy();
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
};

console.log("🔍 Checking navigation settings in Assessment entity\n");
checkNavigationSettings();
