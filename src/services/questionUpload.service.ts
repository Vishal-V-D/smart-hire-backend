import { AppDataSource } from "../config/db";
import { Question, QuestionType, QuestionDifficulty } from "../entities/Question.entity";
import { supabase, BUCKET_NAME } from "../config/supabase";
import csvParser from "csv-parser";
import AdmZip from "adm-zip";
import { Readable } from "stream";
import path from "path";
import fs from "fs";

const questionRepo = () => AppDataSource.getRepository(Question);

// Validation result interface
interface ValidationError {
    row: number;
    field: string;
    error: string;
}

interface UploadSummary {
    total: number;
    success: number;
    failed: number;
    imagesUploaded?: number;
    errors: ValidationError[];
}

// Sanitize filename for Supabase
function sanitizeFilename(filename: string): string {
    return filename
        .replace(/\s+/g, "_")
        .replace(/[^A-Za-z0-9._-]/g, "-");
}

// Upload image to Supabase Storage
export async function uploadImageToSupabase(
    imageBuffer: Buffer,
    filename: string
): Promise<string> {
    try {
        const sanitizedName = sanitizeFilename(filename);
        const uploadPath = `questions/${sanitizedName}`;

        console.log(`  📤 Uploading image: ${filename} → ${sanitizedName}`);

        // Upload to Supabase
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(uploadPath, imageBuffer, {
                contentType: getContentType(filename),
                upsert: true,
            });

        if (error) {
            throw new Error(`Supabase upload failed: ${error.message}`);
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(uploadPath);

        console.log(`  ✅ Image uploaded: ${publicUrlData.publicUrl}`);
        return publicUrlData.publicUrl;
    } catch (error: any) {
        console.error(`  ❌ Image upload failed: ${error.message}`);
        throw error;
    }
}

// Get content type from filename
function getContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const types: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
    };
    return types[ext] || "application/octet-stream";
}

// Helper to get Solution value from row (handles different column name variations)
function getSolutionValue(row: any): string | number | undefined {
    // Try different possible column names for Solution
    const solutionColumnNames = [
        "Solution",
        "Solution (Correct Option Number)",
        "Correct Answer",
        "CorrectAnswer",
        "Answer"
    ];

    for (const colName of solutionColumnNames) {
        if (row[colName] !== undefined && row[colName] !== null && row[colName] !== "") {
            return row[colName];
        }
    }
    return undefined;
}

// Map difficulty string to enum
function mapDifficulty(level: string | undefined): QuestionDifficulty | undefined {
    if (!level) return undefined;

    const normalized = level.trim().toLowerCase();
    switch (normalized) {
        case "easy":
            return QuestionDifficulty.EASY;
        case "medium":
            return QuestionDifficulty.MEDIUM;
        case "hard":
            return QuestionDifficulty.HARD;
        default:
            // Try to match the already-correct format
            if (level === "Easy" || level === "Medium" || level === "Hard") {
                return level as QuestionDifficulty;
            }
            console.warn(`Unknown difficulty: ${level}, defaulting to Medium`);
            return QuestionDifficulty.MEDIUM;
    }
}

// Validate CSV row
function validateCSVRow(row: any, rowNumber: number): ValidationError[] {
    const errors: ValidationError[] = [];

    // Debug: Log column names for first row
    if (rowNumber === 1) {
        console.log(`📋 [CSV] Detected columns:`, Object.keys(row));
    }

    // Required: Question text
    if (!row.Question || row.Question.trim() === "") {
        errors.push({ row: rowNumber, field: "Question", error: "Question text is required" });
    }

    // Required: Solution (correct answer) - check multiple possible column names
    const solutionValue = getSolutionValue(row);
    if (solutionValue === undefined) {
        errors.push({
            row: rowNumber,
            field: "Solution",
            error: `Solution (correct answer) is required. Checked columns: Solution, Solution (Correct Option Number), Correct Answer`
        });
        if (rowNumber === 1) {
            console.log(`⚠️ [CSV] Row 1 - No solution found. Available columns:`, Object.keys(row));
        }
    }

    // If has Options, validate they are parseable
    if (row["Options (JSON)"] && row["Options (JSON)"].trim() !== "") {
        try {
            const options = JSON.parse(row["Options (JSON)"]);
            if (!Array.isArray(options) && typeof options !== "object") {
                errors.push({
                    row: rowNumber,
                    field: "Options (JSON)",
                    error: "Options must be a JSON array or object with at least 2 items",
                });
            } else if (Array.isArray(options) && options.length < 2) {
                errors.push({
                    row: rowNumber,
                    field: "Options (JSON)",
                    error: "Options must be a JSON array with at least 2 items",
                });
            }
        } catch (e) {
            errors.push({
                row: rowNumber,
                field: "Options (JSON)",
                error: "Options must be valid JSON array",
            });
        }
    }

    return errors;
}

// Parse CSV row to Question entity
function parseCSVRow(row: any, division?: string): Partial<Question> {
    // Parse options if exists
    let options: string[] | undefined = undefined;
    let questionType: QuestionType = QuestionType.FILL_IN_THE_BLANK;

    if (row["Options (JSON)"] && row["Options (JSON)"].trim() !== "") {
        try {
            const parsedOptions = JSON.parse(row["Options (JSON)"]);

            // Handle both array format and object format ({"1":"Option A","2":"Option B",...})
            if (Array.isArray(parsedOptions)) {
                // Already an array, use as-is
                options = parsedOptions;
            } else if (typeof parsedOptions === "object" && parsedOptions !== null) {
                // It's an object like {"1":"Option A","2":"Option B",...}
                // Convert to array by extracting values in sorted key order
                const keys = Object.keys(parsedOptions).sort((a, b) => {
                    // Try numeric sort first, fallback to string sort
                    const numA = parseInt(a, 10);
                    const numB = parseInt(b, 10);
                    if (!isNaN(numA) && !isNaN(numB)) {
                        return numA - numB;
                    }
                    return a.localeCompare(b);
                });
                options = keys.map(key => parsedOptions[key]);
                console.log(`  📋 Converted options object to array: ${options.length} options`);
            }

            questionType = QuestionType.SINGLE_CHOICE; // If has options, it's single choice
        } catch (e) {
            console.warn(`Failed to parse options for row: ${row["S.No"]}`);
        }
    }

    const question: Partial<Question> = {
        text: row.Question?.trim(),
        type: questionType,
        options: options,
        correctAnswer: getSolutionValue(row)?.toString().trim(), // Convert to string
        explanation: row.Explanation?.trim() || undefined,
        marks: 1, // Default marks
        difficulty: mapDifficulty(row.Level?.trim()), // Convert to enum: Easy, Medium, Hard
        division: division || undefined, // From frontend
        subdivision: row.Subtopic?.trim() || undefined,
        topic: row.Topic?.trim() || undefined,
        image: undefined, // Will be set after image upload or from image_url
    };

    // Handle image_url if exists in CSV
    if (row.image_url && row.image_url.trim() !== "") {
        question.image = row.image_url.trim();
    }

    return question;
}

// Upload CSV file
export async function uploadCSV(fileBuffer: Buffer, division?: string): Promise<UploadSummary> {
    const summary: UploadSummary = {
        total: 0,
        success: 0,
        failed: 0,
        errors: [],
    };

    const rows: any[] = [];
    const stream = Readable.from(fileBuffer.toString());

    return new Promise((resolve, reject) => {
        stream
            .pipe(csvParser())
            .on("data", (row) => {
                rows.push(row);
            })
            .on("end", async () => {
                console.log(`\n📊 Processing ${rows.length} questions from CSV...\n`);
                summary.total = rows.length;

                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    const rowNumber = i + 1;

                    // Validate row
                    const validationErrors = validateCSVRow(row, rowNumber);
                    if (validationErrors.length > 0) {
                        summary.errors.push(...validationErrors);
                        summary.failed++;
                        console.log(`[${rowNumber}/${rows.length}] ❌ Validation failed`);
                        continue;
                    }

                    try {
                        // Parse and save question
                        const questionData = parseCSVRow(row, division);
                        const question = questionRepo().create(questionData);
                        await questionRepo().save(question);

                        summary.success++;
                        console.log(`[${rowNumber}/${rows.length}] ✅ Question saved`);
                    } catch (error: any) {
                        summary.errors.push({
                            row: rowNumber,
                            field: "database",
                            error: error.message,
                        });
                        summary.failed++;
                        console.log(`[${rowNumber}/${rows.length}] ❌ Save failed: ${error.message}`);
                    }
                }

                console.log(`\n🎉 CSV Upload Complete!`);
                console.log(`   Total: ${summary.total}`);
                console.log(`   Success: ${summary.success}`);
                console.log(`   Failed: ${summary.failed}`);

                resolve(summary);
            })
            .on("error", (error) => {
                reject(error);
            });
    });
}

// Upload ZIP file (CSV + images)
export async function uploadZIP(fileBuffer: Buffer, division?: string): Promise<UploadSummary> {
    const summary: UploadSummary = {
        total: 0,
        success: 0,
        failed: 0,
        imagesUploaded: 0,
        errors: [],
    };

    try {
        console.log("\n📦 Extracting ZIP file...");
        const zip = new AdmZip(fileBuffer);
        const zipEntries = zip.getEntries();

        // Find CSV file
        const csvEntry = zipEntries.find(
            (entry) =>
                !entry.isDirectory &&
                (entry.entryName.endsWith(".csv") || entry.entryName.toLowerCase().includes("question"))
        );

        if (!csvEntry) {
            throw new Error("No CSV file found in ZIP");
        }

        console.log(`✅ Found CSV: ${csvEntry.entryName}`);

        // Extract images folder
        const imageEntries = zipEntries.filter(
            (entry) =>
                !entry.isDirectory &&
                entry.entryName.toLowerCase().includes("images/") &&
                /\.(png|jpg|jpeg|gif|svg)$/i.test(entry.entryName)
        );

        console.log(`✅ Found ${imageEntries.length} images`);

        // Upload images to Supabase
        const imageUrlMap: Record<string, string> = {};

        for (const imageEntry of imageEntries) {
            try {
                const filename = path.basename(imageEntry.entryName);
                const imageBuffer = imageEntry.getData();
                const publicUrl = await uploadImageToSupabase(imageBuffer, filename);
                imageUrlMap[filename] = publicUrl;
                summary.imagesUploaded!++;
            } catch (error: any) {
                console.error(`  ❌ Failed to upload image ${imageEntry.entryName}: ${error.message}`);
            }
        }

        // Parse CSV
        const csvBuffer = csvEntry.getData();
        const rows: any[] = [];
        const stream = Readable.from(csvBuffer.toString());

        return new Promise((resolve, reject) => {
            stream
                .pipe(csvParser())
                .on("data", (row) => {
                    rows.push(row);
                })
                .on("end", async () => {
                    console.log(`\n📊 Processing ${rows.length} questions from CSV...\n`);
                    summary.total = rows.length;

                    for (let i = 0; i < rows.length; i++) {
                        const row = rows[i];
                        const rowNumber = i + 1;

                        // Validate row
                        const validationErrors = validateCSVRow(row, rowNumber);
                        if (validationErrors.length > 0) {
                            summary.errors.push(...validationErrors);
                            summary.failed++;
                            console.log(`[${rowNumber}/${rows.length}] ❌ Validation failed`);
                            continue;
                        }

                        try {
                            // Parse question
                            const questionData = parseCSVRow(row, division);

                            // Handle question_image column - upload to Supabase if exists
                            if (row.question_image && imageUrlMap[row.question_image]) {
                                questionData.image = imageUrlMap[row.question_image];
                            }

                            // Save question
                            const question = questionRepo().create(questionData);
                            await questionRepo().save(question);

                            summary.success++;
                            console.log(`[${rowNumber}/${rows.length}] ✅ Question saved`);
                        } catch (error: any) {
                            summary.errors.push({
                                row: rowNumber,
                                field: "database",
                                error: error.message,
                            });
                            summary.failed++;
                            console.log(`[${rowNumber}/${rows.length}] ❌ Save failed: ${error.message}`);
                        }
                    }

                    console.log(`\n🎉 ZIP Upload Complete!`);
                    console.log(`   Total Questions: ${summary.total}`);
                    console.log(`   Success: ${summary.success}`);
                    console.log(`   Failed: ${summary.failed}`);
                    console.log(`   Images Uploaded: ${summary.imagesUploaded}`);

                    resolve(summary);
                })
                .on("error", (error) => {
                    reject(error);
                });
        });
    } catch (error: any) {
        throw new Error(`ZIP processing failed: ${error.message}`);
    }
}
