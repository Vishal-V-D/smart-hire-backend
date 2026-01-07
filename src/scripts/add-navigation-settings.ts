import { AppDataSource } from "../config/db";

/**
 * Migration to add navigation settings to Assessment table
 * Adds: allowPreviousNavigation and allowMarkForReview columns
 */

const migrate = async () => {
    try {
        await AppDataSource.initialize();
        console.log("✅ Database connected");

        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        console.log("\n🔧 Adding navigation settings columns to Assessment table...");

        // Add allowPreviousNavigation column
        await queryRunner.query(`
            ALTER TABLE "assessments" 
            ADD COLUMN IF NOT EXISTS "allowPreviousNavigation" boolean NOT NULL DEFAULT true;
        `);
        console.log("   ✅ Added allowPreviousNavigation column");

        // Add allowMarkForReview column
        await queryRunner.query(`
            ALTER TABLE "assessments" 
            ADD COLUMN IF NOT EXISTS "allowMarkForReview" boolean NOT NULL DEFAULT true;
        `);
        console.log("   ✅ Added allowMarkForReview column");

        console.log("\n🎉 Migration completed successfully!");
        console.log("   Assessments now support navigation settings");

        await queryRunner.release();
        await AppDataSource.destroy();
        process.exit(0);
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
};

console.log("🚀 Running migration: Add navigation settings to Assessment");
migrate();
