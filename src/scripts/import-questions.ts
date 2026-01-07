import "reflect-metadata";
import { AppDataSource } from "../config/db";
import { Question, QuestionType, QuestionDifficulty } from "../entities/Question.entity";
import * as fs from "fs";
import * as path from "path";

// @ts-ignore - csv-parser doesn't have type definitions
const csv = require("csv-parser");

// Configuration
const CSV_FILE_PATH = path.join(__dirname, "questions_updated.csv");
const BATCH_SIZE = 100;
const DIVISION = "Aptitude";
const SUBDIVISION = "Quantitative";

// Statistics
interface ImportStats {
    totalRows: number;
    successCount: number;
    errorCount: number;
}

// Error logging
const errorLog: Array<{ row: number; error: string; data: any }> = [];

/**
 * Parse CSV file and return array of row objects
 */
async function parseCSV(filePath: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
        const results: any[] = [];

        console.log(`📄 Reading CSV file: ${filePath}`);

        if (!fs.existsSync(filePath)) {
            reject(new Error(`CSV file not found at: ${filePath}`));
            return;
        }

        fs.createReadStream(filePath)
            .pipe(csv())
            .on("data", (data: any) => results.push(data))
            .on("end", () => {
                console.log(`✅ CSV parsed successfully: ${results.length} rows found\n`);
                resolve(results);
            })
            .on("error", (error: any) => {
                console.error(`❌ CSV parsing error: ${error.message}`);
                reject(error);
            });
    });
}

/**
 * Map difficulty string to enum
 */
function mapDifficulty(level: string): QuestionDifficulty {
    const normalized = (level || "Medium").trim().toLowerCase();

    switch (normalized) {
        case "easy":
            return QuestionDifficulty.EASY;
        case "hard":
            return QuestionDifficulty.HARD;
        case "medium":
        default:
            return QuestionDifficulty.MEDIUM;
    }
}

/**
 * Map CSV row to Question entity (standalone, no section)
 */
function mapCSVRowToQuestion(row: any, rowNum: number): Question {
    const questionRepo = AppDataSource.getRepository(Question);

    // Parse options from JSON
    let options: string[] = [];
    try {
        const optionsStr = row["Options (JSON)"];
        if (optionsStr && optionsStr.trim()) {
            // Parse the JSON string
            const parsed = JSON.parse(optionsStr);
            // Convert object to array of values
            options = Object.values(parsed);
        }
    } catch (error: any) {
        console.warn(`⚠️  Row ${rowNum}: Failed to parse options - ${error.message}`);
        options = [];
    }

    // Get correct answer (convert 1-based to option text)
    let correctAnswer: any = null;
    try {
        const solutionNum = parseFloat(row["Solution (Correct Option Number)"]);
        if (!isNaN(solutionNum) && solutionNum > 0 && solutionNum <= options.length) {
            // Convert to 0-based index and get the option text
            correctAnswer = options[Math.floor(solutionNum) - 1];
        }
    } catch (error: any) {
        console.warn(`⚠️  Row ${rowNum}: Failed to parse solution - ${error.message}`);
    }

    // Get image URL (prefer image_url, fallback to question_image)
    const imageUrl = row.image_url || row.question_image || null;

    // Create Question entity (standalone, no section)
    const question = questionRepo.create({
        section: null, // Standalone question
        text: row.Question || "",
        image: imageUrl,
        type: QuestionType.SINGLE_CHOICE,
        options: options,
        correctAnswer: correctAnswer,
        explanation: row.Explanation || null,
        marks: 1,
        order: parseInt(row["S.No"]) || 0,
        tags: row.Subtopic ? [row.Subtopic] : [],
        topic: row.Topic || DIVISION,
        division: DIVISION,
        subdivision: SUBDIVISION,
        difficulty: mapDifficulty(row.Level)
    });

    return question;
}

/**
 * Main import function
 */
async function importQuestions(csvPath: string): Promise<void> {
    console.log("\n" + "=".repeat(70));
    console.log("🚀 APTITUDE QUANTITATIVE QUESTIONS IMPORT");
    console.log("   Standalone Question Bank (No Assessment/Section)");
    console.log("=".repeat(70) + "\n");

    // Initialize stats
    const stats: ImportStats = {
        totalRows: 0,
        successCount: 0,
        errorCount: 0
    };

    try {
        // Initialize database
        if (!AppDataSource.isInitialized) {
            console.log("🔌 Connecting to database...");
            await AppDataSource.initialize();
            console.log("✅ Database connected\n");
        }

        // Parse CSV
        const rows = await parseCSV(csvPath);
        stats.totalRows = rows.length;

        if (rows.length === 0) {
            console.log("⚠️  No rows found in CSV file");
            return;
        }

        // Batch array
        const questionBatch: Question[] = [];

        // Process each row
        console.log("=".repeat(70));
        console.log(`📊 Processing ${rows.length} questions...\n`);

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 1;

            try {
                // Map to Question entity
                const question = mapCSVRowToQuestion(row, rowNum);
                questionBatch.push(question);
                stats.successCount++;

                // Batch insert
                if (questionBatch.length >= BATCH_SIZE) {
                    await AppDataSource.getRepository(Question).save(questionBatch);
                    console.log(`✅ Saved batch of ${questionBatch.length} questions (Total: ${stats.successCount})`);
                    questionBatch.length = 0;
                }

                // Progress update every 100 rows
                if (rowNum % 100 === 0) {
                    console.log(`📈 Progress: ${rowNum}/${rows.length} rows processed (Success: ${stats.successCount}, Errors: ${stats.errorCount})`);
                }

            } catch (error: any) {
                stats.errorCount++;
                errorLog.push({
                    row: rowNum,
                    error: error.message,
                    data: row
                });
                console.error(`❌ Row ${rowNum} failed: ${error.message}`);
            }
        }

        // Save remaining batch
        if (questionBatch.length > 0) {
            await AppDataSource.getRepository(Question).save(questionBatch);
            console.log(`✅ Saved final batch of ${questionBatch.length} questions\n`);
        }

        // Write error log if there are errors
        if (errorLog.length > 0) {
            const errorLogPath = path.join(__dirname, "../import-errors.log");
            const errorContent = errorLog.map(e =>
                `Row ${e.row}: ${e.error}\nData: ${JSON.stringify(e.data, null, 2)}\n${"=".repeat(70)}`
            ).join("\n");
            fs.writeFileSync(errorLogPath, errorContent);
            console.log(`⚠️  Error log written to: ${errorLogPath}\n`);
        }

        // Print summary
        console.log("=".repeat(70));
        console.log("✅ IMPORT COMPLETED SUCCESSFULLY!");
        console.log("=".repeat(70));
        console.log(`📊 Total Rows in CSV:     ${stats.totalRows}`);
        console.log(`✅ Questions Imported:    ${stats.successCount}`);
        console.log(`❌ Failed Rows:           ${stats.errorCount}`);
        console.log(`🏷️  Division:              ${DIVISION}`);
        console.log(`🏷️  Subdivision:           ${SUBDIVISION}`);
        console.log(`📝 Storage:               Standalone (No Assessment/Section)`);
        console.log("=".repeat(70) + "\n");

    } catch (error: any) {
        console.error("\n" + "=".repeat(70));
        console.error("❌ FATAL ERROR OCCURRED");
        console.error("=".repeat(70));
        console.error(`Error: ${error.message}`);
        console.error(`Stack: ${error.stack}`);
        console.error("=".repeat(70) + "\n");
        throw error;
    }
}

// Main execution
async function main() {
    try {
        console.log(`\n📁 CSV File Path: ${CSV_FILE_PATH}\n`);

        await importQuestions(CSV_FILE_PATH);

        console.log("🎉 Script execution completed successfully!\n");
        process.exit(0);
    } catch (error: any) {
        console.error("\n❌ Script execution failed!");
        console.error(`Error: ${error.message}\n`);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}

export { importQuestions, parseCSV };
