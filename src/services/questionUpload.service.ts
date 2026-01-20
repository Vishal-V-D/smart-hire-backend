import { AppDataSource } from "../config/db";
import { Question, QuestionType, QuestionDifficulty } from "../entities/Question.entity";
import { supabase, BUCKET_NAME } from "../config/supabase";
import csvParser from "csv-parser";
import AdmZip from "adm-zip";
import { Readable } from "stream";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";

import { SqlQuestion, SqlQuestionDifficulty } from "../entities/SqlQuestion.entity";

const questionRepo = () => AppDataSource.getRepository(Question);
const sqlQuestionRepo = () => AppDataSource.getRepository(SqlQuestion);

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
    pseudocodeCount?: number;
    divisionBreakdown?: Record<string, number>;
    typeBreakdown?: Record<string, number>;
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
        "Solution (Correct Option Number)",
        "Correct Answer",
        "CorrectAnswer",
        "Solution (Correct Option Number)",
        "Correct Answer",
        "CorrectAnswer",
        "Answer",
        "solution",
        "solution"
    ];

    for (const colName of solutionColumnNames) {
        if (row[colName] !== undefined && row[colName] !== null && row[colName] !== "") {
            return row[colName];
        }
    }
    return undefined;
}

// Helper to detect if solution indicates multiple choice
function detectMultipleChoice(solutionValue: string | number | undefined): boolean {
    if (!solutionValue) return false;

    const solutionStr = solutionValue.toString().trim();

    // Check if it's a JSON array: ["1","3"] or [1,3]
    if (solutionStr.startsWith('[') && solutionStr.endsWith(']')) {
        try {
            const parsed = JSON.parse(solutionStr);
            if (Array.isArray(parsed) && parsed.length > 1) {
                return true;
            }
        } catch {
            // Not valid JSON, continue checking
        }
    }

    // Check if it contains comma: "1,3" or "A,C" or "1, 3"
    if (solutionStr.includes(',')) {
        const parts = solutionStr.split(',').map(p => p.trim()).filter(p => p.length > 0);
        if (parts.length > 1) {
            return true;
        }
    }

    // Single answer
    return false;
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
    // Required: Question text (check case insensitive)
    const questionKey = Object.keys(row).find(k => k.toLowerCase() === 'question' || k.toLowerCase() === 'questiontext');
    if (!questionKey || !row[questionKey] || row[questionKey].toString().trim() === "") {
        // Skip validation if it's a SQL question (uses different required fields like question_tables/expected_output)
        const isSqlInfoPresent = Object.keys(row).some(k => ['question_tables', 'expected_output', 'solution'].includes(k.toLowerCase()));
        if (!isSqlInfoPresent) {
            errors.push({ row: rowNumber, field: "Question", error: "Question text is required" });
        }
    }

    // Required: Solution (correct answer) - check multiple possible column names
    const solutionValue = getSolutionValue(row);

    if (solutionValue === undefined) {
        // Skip validation if it's a SQL question (might use 'solution' or 'expected_query' which are checked in SQL parser)
        const isSqlInfoPresent = Object.keys(row).some(k => ['question_tables', 'expected_output', 'solution'].includes(k.toLowerCase()));
        if (!isSqlInfoPresent) {
            errors.push({
                row: rowNumber,
                field: "Solution",
                error: `Solution (correct answer) is required. Checked columns: Solution, Solution (Correct Option Number), Correct Answer`
            });
            if (rowNumber === 1) {
                console.log(`⚠️ [CSV] Row 1 - No solution found. Available columns:`, Object.keys(row));
            }
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
function parseCSVRow(
    row: any,
    division?: string,
    subdivision?: string,
    topic?: string
): Partial<Question> {
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

            // 🎯 AUTO-DETECT: Single Choice vs Multiple Choice
            const solutionValue = getSolutionValue(row);
            const isMultipleChoice = detectMultipleChoice(solutionValue);

            questionType = isMultipleChoice
                ? QuestionType.MULTIPLE_CHOICE
                : QuestionType.SINGLE_CHOICE;

            console.log(`  🎯 Detected type: ${questionType} (Solution: ${solutionValue})`);
        } catch (e) {
            console.warn(`Failed to parse options for row: ${row["S.No"]}`);
        }
    }

    // Explicitly check columns for overrides (CSV > Input Param)
    const rowDivision = row.Division?.trim() || row.MainType?.trim();
    const rowSubdivision = row.Subdivision?.trim() || row.Subtopic?.trim();
    const rowTopic = row.Topic?.trim();

    const finalDivision = rowDivision || division || undefined;
    const finalSubdivision = rowSubdivision || subdivision || undefined;
    const finalTopic = rowTopic || topic || undefined;

    const question: Partial<Question> = {
        text: row.Question?.trim(),
        type: questionType,
        options: options,
        correctAnswer: getSolutionValue(row)?.toString().trim(), // Convert to string
        explanation: row.Explanation?.trim() || undefined,
        pseudocode: row.Pseudocode?.trim() || undefined, // Extract pseudocode from CSV
        marks: 1, // Default marks
        difficulty: mapDifficulty(row.Level?.trim()), // Convert to enum: Easy, Medium, Hard
        division: finalDivision,
        subdivision: finalSubdivision,
        topic: finalTopic,
        image: undefined, // Will be set after image upload or from image_url
    };

    // Handle image_url if exists in CSV
    if (row.image_url && row.image_url.trim() !== "") {
        question.image = row.image_url.trim();
    }

    return question;
}

// Parse CSV row to SqlQuestion entity
function parseSqlCSVRow(
    row: any,
    division?: string,
    subdivision?: string,
    topic?: string
): Partial<SqlQuestion> {
    // Helper to find value case-insensitively
    const findVal = (keys: string[]) => {
        const foundKey = Object.keys(row).find(k => keys.includes(k.toLowerCase().trim()));
        return foundKey ? row[foundKey] : undefined;
    };

    const rowDivision = findVal(['division', 'maintype'])?.trim() || division;

    // Map CSV headers to SqlQuestion fields
    // User requested format: s.no, topic, subtopic, subsubtopic, level, question, question_tables, expected_output, hint, solution

    const rowTopic = findVal(['topic'])?.trim() || topic;
    const rowSubtopic = findVal(['subtopic', 'subdivision'])?.trim() || subdivision;
    const rowSubSubtopic = findVal(['subsubtopic'])?.trim();
    const tags = rowSubSubtopic ? [rowSubSubtopic] : [];

    const difficultyStr = findVal(['level', 'difficulty'])?.trim();
    let difficulty = SqlQuestionDifficulty.MEDIUM;
    if (difficultyStr) {
        if (difficultyStr.toLowerCase() === 'easy') difficulty = SqlQuestionDifficulty.EASY;
        else if (difficultyStr.toLowerCase() === 'hard') difficulty = SqlQuestionDifficulty.HARD;
    }

    const questionText = findVal(['question', 'questiontext'])?.trim();

    // Parse JSON fields
    let inputTables = null;
    try {
        const tablesStr = findVal(['question_tables', 'questiontables'])?.trim();
        if (tablesStr) inputTables = JSON.parse(tablesStr);
    } catch (e) {
        console.warn("Failed to parse question_tables JSON");
    }

    let expectedResult = null;
    try {
        const resultStr = findVal(['expected_output', 'expectedoutput', 'expectedresult'])?.trim();
        if (resultStr) expectedResult = JSON.parse(resultStr);
    } catch (e) {
        console.warn("Failed to parse expected_output JSON");
    }

    return {
        title: questionText ? (questionText.length > 50 ? questionText.substring(0, 47) + "..." : questionText) : "SQL Question",
        description: questionText,
        division: rowDivision,
        topic: rowTopic,
        subdivision: rowSubtopic,
        tags: tags,
        difficulty: difficulty,
        schemaSetup: "-- Schema defined in inputTables",
        sampleData: "-- Data defined in inputTables",
        inputTables: inputTables,
        expectedQuery: findVal(['solution', 'expectedquery', 'answer'])?.trim(),
        expectedResult: expectedResult,
        hint: findVal(['hint'])?.trim(),
        dialect: "postgresql" as any // Default to postgres or as needed
    };
}

// Upload CSV file
export async function uploadCSV(
    fileBuffer: Buffer,
    division?: string,
    subdivision?: string,
    topic?: string
): Promise<UploadSummary> {
    const summary: UploadSummary = {
        total: 0,
        success: 0,
        failed: 0,
        errors: [],
        pseudocodeCount: 0,
        divisionBreakdown: {},
        typeBreakdown: {},
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
                        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                        console.log(`[${rowNumber}/${rows.length}] ❌ VALIDATION FAILED`);
                        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                        validationErrors.forEach(err => {
                            console.log(`⚠️  ${err.field}: ${err.error}`);
                        });
                        console.log(`clipboard ROW DATA: ${JSON.stringify(row)}`);
                        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                        continue;
                    }

                    try {
                        // Check if it's a SQL question (has question_tables or specific CSV structure - Case Insensitive Check)
                        const keys = Object.keys(row);
                        const hasQuestionTables = keys.some(k => k.toLowerCase() === 'question_tables');
                        const hasExpectedOutput = keys.some(k => k.toLowerCase() === 'expected_output');

                        if (hasQuestionTables || hasExpectedOutput) {
                            const sqlQuestionData = parseSqlCSVRow(row, division, subdivision, topic);
                            // Validate required fields for SQL
                            if (!sqlQuestionData.description || !sqlQuestionData.expectedQuery) {
                                throw new Error("Missing required fields for SQL Question (question, solution)");
                            }
                            const sqlQuestion = sqlQuestionRepo().create(sqlQuestionData);
                            await sqlQuestionRepo().save(sqlQuestion);

                            // Update stats for SQL
                            const div = sqlQuestionData.division || 'Uncategorized';
                            summary.divisionBreakdown![div] = (summary.divisionBreakdown![div] || 0) + 1;
                            summary.typeBreakdown!['SQL'] = (summary.typeBreakdown!['SQL'] || 0) + 1;

                            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                            console.log(`[${rowNumber}/${rows.length}] ✅ SQL QUESTION UPLOADED SUCCESSFULLY`);
                            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                            console.log(`📂 DIVISION    : ${sqlQuestionData.division || 'N/A'}`);
                            console.log(`📁 SUBDIVISION : ${sqlQuestionData.subdivision || 'N/A'}`);
                            console.log(`🏷️  TOPIC       : ${sqlQuestionData.topic || 'N/A'}`);
                            console.log(`📝 QUESTION    : ${sqlQuestionData.description?.substring(0, 60)}...`);
                            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

                        } else {
                            // Parse and save regular question
                            const questionData = parseCSVRow(row, division, subdivision, topic);
                            const question = questionRepo().create(questionData);
                            await questionRepo().save(question);

                            // Track statistics
                            if (questionData.pseudocode) {
                                summary.pseudocodeCount!++;
                            }

                            const div = questionData.division || 'Uncategorized';
                            summary.divisionBreakdown![div] = (summary.divisionBreakdown![div] || 0) + 1;

                            const type = questionData.type || 'Unknown';
                            summary.typeBreakdown![type] = (summary.typeBreakdown![type] || 0) + 1;

                            // Enhanced Detailed Logging
                            const divisionLabel = questionData.division || 'N/A';
                            const subdivisionLabel = questionData.subdivision || 'N/A';
                            const topicLabel = questionData.topic || 'N/A';
                            const typeLabel = questionData.type || 'N/A';
                            const hasPseudocode = questionData.pseudocode ? '✅ YES' : '❌ NO';
                            const hasOptions = questionData.options && questionData.options.length > 0 ? `${questionData.options.length} opts` : 'No opts';

                            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                            console.log(`[${rowNumber}/${rows.length}] ✅ QUESTION UPLOADED SUCCESSFULLY`);
                            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                            console.log(`📂 DIVISION    : ${divisionLabel}`);
                            console.log(`📁 SUBDIVISION : ${subdivisionLabel}`);
                            console.log(`🏷️  TOPIC       : ${topicLabel}`);
                            console.log(`📝 TYPE        : ${typeLabel}`);
                            console.log(`💻 PSEUDOCODE  : ${hasPseudocode}`);
                            console.log(`🔢 OPTIONS     : ${hasOptions}`);
                            console.log(`❓ QUESTION    : ${questionData.text?.substring(0, 60)}...`);
                            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                        }

                        summary.success++;
                    } catch (error: any) {
                        summary.errors.push({
                            row: rowNumber,
                            field: "database",
                            error: error.message,
                        });
                        summary.failed++;

                        // Enhanced Error Logging
                        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                        console.log(`[${rowNumber}/${rows.length}] ❌ QUESTION UPLOAD FAILED`);
                        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                        console.log(`⚠️  ERROR: ${error.message}`);
                        console.log(`📋 ROW DATA: ${JSON.stringify(row, null, 2)}`);
                        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                    }
                }

                // Enhanced Final Summary
                console.log(`\n╔════════════════════════════════════════════════════════════╗`);
                console.log(`║           🎉 CSV UPLOAD COMPLETE - SUMMARY 🎉              ║`);
                console.log(`╚════════════════════════════════════════════════════════════╝\n`);
                console.log(`📊 OVERALL STATISTICS:`);
                console.log(`   ├─ Total Questions    : ${summary.total}`);
                console.log(`   ├─ ✅ Success         : ${summary.success}`);
                console.log(`   ├─ ❌ Failed          : ${summary.failed}`);
                console.log(`   └─ 💻 With Pseudocode : ${summary.pseudocodeCount}\n`);

                if (summary.errors.length > 0) {
                    console.log(`❌ ERROR DETAILS:`);
                    summary.errors.forEach(err => {
                        console.log(`   Row ${err.row}: [${err.field}] ${err.error}`);
                    });
                    console.log('');
                }

                if (Object.keys(summary.divisionBreakdown!).length > 0) {
                    console.log(`📂 DIVISION BREAKDOWN:`);
                    Object.entries(summary.divisionBreakdown!).forEach(([div, count]) => {
                        console.log(`   ├─ ${div.padEnd(20)} : ${count} questions`);
                    });
                    console.log('');
                }

                if (Object.keys(summary.typeBreakdown!).length > 0) {
                    console.log(`📝 TYPE BREAKDOWN:`);
                    Object.entries(summary.typeBreakdown!).forEach(([type, count]) => {
                        console.log(`   ├─ ${type.padEnd(20)} : ${count} questions`);
                    });
                    console.log('');
                }

                resolve(summary);
            })
            .on("error", (error) => {
                reject(error);
            });
    });
}

// Upload Excel file
export async function uploadExcel(
    fileBuffer: Buffer,
    division?: string,
    subdivision?: string,
    topic?: string
): Promise<UploadSummary> {
    const summary: UploadSummary = {
        total: 0,
        success: 0,
        failed: 0,
        errors: [],
        pseudocodeCount: 0,
        divisionBreakdown: {},
        typeBreakdown: {},
    };

    try {
        const workbook = XLSX.read(fileBuffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        console.log(`\n📊 Processing ${rows.length} questions from Excel...\n`);
        summary.total = rows.length;

        for (let i = 0; i < rows.length; i++) {
            const row: any = rows[i];
            const rowNumber = i + 1;

            // Validate row
            const validationErrors = validateCSVRow(row, rowNumber);
            if (validationErrors.length > 0) {
                summary.errors.push(...validationErrors);
                summary.failed++;
                console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`[${rowNumber}/${rows.length}] ❌ VALIDATION FAILED`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                validationErrors.forEach(err => {
                    console.log(`⚠️  ${err.field}: ${err.error}`);
                });
                console.log(`clipboard ROW DATA: ${JSON.stringify(row)}`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                continue;
            }

            try {
                // Check if it's a SQL question (has question_tables or specific Excel structure - Case Insensitive Check)
                const keys = Object.keys(row);
                const hasQuestionTables = keys.some(k => k.toLowerCase() === 'question_tables');
                const hasExpectedOutput = keys.some(k => k.toLowerCase() === 'expected_output');

                if (hasQuestionTables || hasExpectedOutput) {
                    const sqlQuestionData = parseSqlCSVRow(row, division, subdivision, topic);
                    // Validate required fields for SQL
                    if (!sqlQuestionData.description || !sqlQuestionData.expectedQuery) {
                        throw new Error("Missing required fields for SQL Question (question, solution)");
                    }
                    const sqlQuestion = sqlQuestionRepo().create(sqlQuestionData);
                    await sqlQuestionRepo().save(sqlQuestion);

                    // Update stats for SQL
                    const div = sqlQuestionData.division || 'Uncategorized';
                    summary.divisionBreakdown![div] = (summary.divisionBreakdown![div] || 0) + 1;
                    summary.typeBreakdown!['SQL'] = (summary.typeBreakdown!['SQL'] || 0) + 1;

                    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    console.log(`[${rowNumber}/${rows.length}] ✅ SQL QUESTION UPLOADED SUCCESSFULLY`);
                    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    console.log(`📂 DIVISION    : ${sqlQuestionData.division || 'N/A'}`);
                    console.log(`📁 SUBDIVISION : ${sqlQuestionData.subdivision || 'N/A'}`);
                    console.log(`🏷️  TOPIC       : ${sqlQuestionData.topic || 'N/A'}`);
                    console.log(`📝 QUESTION    : ${sqlQuestionData.description?.substring(0, 60)}...`);
                    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

                } else {
                    // Parse and save regular question
                    const questionData = parseCSVRow(row, division, subdivision, topic);
                    const question = questionRepo().create(questionData);
                    await questionRepo().save(question);

                    // Track statistics
                    if (questionData.pseudocode) {
                        summary.pseudocodeCount!++;
                    }

                    const div = questionData.division || 'Uncategorized';
                    summary.divisionBreakdown![div] = (summary.divisionBreakdown![div] || 0) + 1;

                    const type = questionData.type || 'Unknown';
                    summary.typeBreakdown![type] = (summary.typeBreakdown![type] || 0) + 1;

                    // Enhanced Detailed Logging
                    const divisionLabel = questionData.division || 'N/A';
                    const subdivisionLabel = questionData.subdivision || 'N/A';
                    const topicLabel = questionData.topic || 'N/A';
                    const typeLabel = questionData.type || 'N/A';
                    const hasPseudocode = questionData.pseudocode ? '✅ YES' : '❌ NO';
                    const hasOptions = questionData.options && questionData.options.length > 0 ? `${questionData.options.length} opts` : 'No opts';

                    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    console.log(`[${rowNumber}/${rows.length}] ✅ QUESTION UPLOADED SUCCESSFULLY`);
                    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    console.log(`📂 DIVISION    : ${divisionLabel}`);
                    console.log(`📁 SUBDIVISION : ${subdivisionLabel}`);
                    console.log(`🏷️  TOPIC       : ${topicLabel}`);
                    console.log(`📝 TYPE        : ${typeLabel}`);
                    console.log(`💻 PSEUDOCODE  : ${hasPseudocode}`);
                    console.log(`🔢 OPTIONS     : ${hasOptions}`);
                    console.log(`❓ QUESTION    : ${questionData.text?.substring(0, 60)}...`);
                    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                }

                summary.success++;
            } catch (error: any) {
                summary.errors.push({
                    row: rowNumber,
                    field: "database",
                    error: error.message,
                });
                summary.failed++;

                // Enhanced Error Logging
                console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`[${rowNumber}/${rows.length}] ❌ QUESTION UPLOAD FAILED`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`⚠️  ERROR: ${error.message}`);
                console.log(`📋 ROW DATA: ${JSON.stringify(row, null, 2)}`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            }
        }

        // Print Summary (Generic helper could be used, but inlining for consistency with existing code style)
        console.log(`\n╔════════════════════════════════════════════════════════════╗`);
        console.log(`║          🎉 EXCEL UPLOAD COMPLETE - SUMMARY 🎉             ║`);
        console.log(`╚════════════════════════════════════════════════════════════╝\n`);
        console.log(`📊 OVERALL STATISTICS:`);
        console.log(`   ├─ Total Questions    : ${summary.total}`);
        console.log(`   ├─ ✅ Success         : ${summary.success}`);
        console.log(`   ├─ ❌ Failed          : ${summary.failed}`);
        console.log(`   └─ 💻 With Pseudocode : ${summary.pseudocodeCount}\n`);

        if (summary.errors.length > 0) {
            console.log(`❌ ERROR DETAILS:`);
            summary.errors.forEach(err => {
                console.log(`   Row ${err.row}: [${err.field}] ${err.error}`);
            });
            console.log('');
        }

        if (Object.keys(summary.divisionBreakdown!).length > 0) {
            console.log(`📂 DIVISION BREAKDOWN:`);
            Object.entries(summary.divisionBreakdown!).forEach(([div, count]) => {
                console.log(`   ├─ ${div.padEnd(20)} : ${count} questions`);
            });
            console.log('');
        }

        if (Object.keys(summary.typeBreakdown!).length > 0) {
            console.log(`📝 TYPE BREAKDOWN:`);
            Object.entries(summary.typeBreakdown!).forEach(([type, count]) => {
                console.log(`   ├─ ${type.padEnd(20)} : ${count} questions`);
            });
            console.log('');
        }

        return summary;

    } catch (error: any) {
        throw new Error(`Excel processing failed: ${error.message}`);
    }
}

// Upload ZIP file (CSV + images)
export async function uploadZIP(
    fileBuffer: Buffer,
    division?: string,
    subdivision?: string,
    topic?: string
): Promise<UploadSummary> {
    const summary: UploadSummary = {
        total: 0,
        success: 0,
        failed: 0,
        imagesUploaded: 0,
        errors: [],
        pseudocodeCount: 0,
        divisionBreakdown: {},
        typeBreakdown: {},
    };

    try {
        console.log("\n📦 Extracting ZIP file...");
        const zip = new AdmZip(fileBuffer);
        const zipEntries = zip.getEntries();

        // Find CSV or Excel file
        const csvEntry = zipEntries.find(
            (entry) =>
                !entry.isDirectory &&
                (entry.entryName.endsWith(".csv") || entry.entryName.toLowerCase().includes("question") && entry.entryName.endsWith(".csv"))
        );

        const excelEntry = !csvEntry ? zipEntries.find(
            (entry) =>
                !entry.isDirectory &&
                (entry.entryName.endsWith(".xlsx") || entry.entryName.endsWith(".xls") || entry.entryName.toLowerCase().includes("question"))
        ) : null;

        if (!csvEntry && !excelEntry) {
            throw new Error("No CSV or Excel file found in ZIP");
        }

        const questionsFileEntry = csvEntry || excelEntry;
        console.log(`✅ Found Questions File: ${questionsFileEntry!.entryName}`);

        // Extract images folder
        const imageEntries = zipEntries.filter(
            (entry) =>
                !entry.isDirectory &&
                (entry.entryName.toLowerCase().includes("images/") &&
                    /\.(png|jpg|jpeg|gif|svg)$/i.test(entry.entryName))
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

        // Parse File (CSV or Excel)
        let rows: any[] = [];

        if (questionsFileEntry!.entryName.endsWith(".csv")) {
            // Parse CSV
            const csvBuffer = questionsFileEntry!.getData();
            const stream = Readable.from(csvBuffer.toString());

            await new Promise<void>((resolve, reject) => {
                stream
                    .pipe(csvParser())
                    .on("data", (row) => rows.push(row))
                    .on("end", () => resolve())
                    .on("error", (err) => reject(err));
            });
        } else {
            // Parse Excel
            const excelBuffer = questionsFileEntry!.getData();
            const workbook = XLSX.read(excelBuffer, { type: "buffer" });
            const sheetName = workbook.SheetNames[0];
            rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        }

        console.log(`\n📊 Processing ${rows.length} questions from ${questionsFileEntry!.entryName}...\n`);
        summary.total = rows.length;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNumber = i + 1;

            // Validate row
            const validationErrors = validateCSVRow(row, rowNumber);
            if (validationErrors.length > 0) {
                summary.errors.push(...validationErrors);
                summary.failed++;
                console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`[${rowNumber}/${rows.length}] ❌ VALIDATION FAILED (ZIP)`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                validationErrors.forEach(err => {
                    console.log(`⚠️  ${err.field}: ${err.error}`);
                });
                console.log(`📋 ROW DATA: ${JSON.stringify(row)}`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                continue;
            }

            try {
                // Check if it's a SQL question (has question_tables or specific CSV structure)
                if (row.question_tables || row.expected_output) {
                    const sqlQuestionData = parseSqlCSVRow(row, division, subdivision, topic);
                    // Validate required fields for SQL
                    if (!sqlQuestionData.description || !sqlQuestionData.expectedQuery) {
                        throw new Error("Missing required fields for SQL Question (question, solution)");
                    }
                    const sqlQuestion = sqlQuestionRepo().create(sqlQuestionData);
                    await sqlQuestionRepo().save(sqlQuestion);

                    // Update stats for SQL
                    const div = sqlQuestionData.division || 'Uncategorized';
                    summary.divisionBreakdown![div] = (summary.divisionBreakdown![div] || 0) + 1;
                    summary.typeBreakdown!['SQL'] = (summary.typeBreakdown!['SQL'] || 0) + 1;

                    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    console.log(`[${rowNumber}/${rows.length}] ✅ SQL QUESTION UPLOADED SUCCESSFULLY (ZIP)`);
                    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    console.log(`📂 DIVISION    : ${sqlQuestionData.division || 'N/A'}`);
                    console.log(`📁 SUBDIVISION : ${sqlQuestionData.subdivision || 'N/A'}`);
                    console.log(`🏷️  TOPIC       : ${sqlQuestionData.topic || 'N/A'}`);
                    console.log(`📝 QUESTION    : ${sqlQuestionData.description?.substring(0, 60)}...`);
                    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

                } else {
                    // Parse regular question
                    const questionData = parseCSVRow(row, division, subdivision, topic);

                    // Handle question_image column - upload to Supabase if exists
                    if (row.question_image && imageUrlMap[row.question_image]) {
                        questionData.image = imageUrlMap[row.question_image];
                    }

                    // Save question
                    const question = questionRepo().create(questionData);
                    await questionRepo().save(question);

                    summary.success++;

                    // Track statistics
                    if (questionData.pseudocode) {
                        summary.pseudocodeCount!++;
                    }

                    const div = questionData.division || 'Uncategorized';
                    summary.divisionBreakdown![div] = (summary.divisionBreakdown![div] || 0) + 1;

                    const type = questionData.type || 'Unknown';
                    summary.typeBreakdown![type] = (summary.typeBreakdown![type] || 0) + 1;

                    // Enhanced Detailed Logging
                    const divisionLabel = questionData.division || 'N/A';
                    const subdivisionLabel = questionData.subdivision || 'N/A';
                    const topicLabel = questionData.topic || 'N/A';
                    const typeLabel = questionData.type || 'N/A';
                    const hasPseudocode = questionData.pseudocode ? '✅ YES' : '❌ NO';
                    const hasOptions = questionData.options && questionData.options.length > 0 ? `${questionData.options.length} opts` : 'No opts';
                    const hasImage = questionData.image ? '✅ YES' : '❌ NO';

                    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    console.log(`[${rowNumber}/${rows.length}] ✅ QUESTION UPLOADED SUCCESSFULLY (ZIP)`);
                    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    console.log(`📂 DIVISION    : ${divisionLabel}`);
                    console.log(`📁 SUBDIVISION : ${subdivisionLabel}`);
                    console.log(`🏷️  TOPIC       : ${topicLabel}`);
                    console.log(`📝 TYPE        : ${typeLabel}`);
                    console.log(`💻 PSEUDOCODE  : ${hasPseudocode}`);
                    console.log(`🔢 OPTIONS     : ${hasOptions}`);
                    console.log(`🖼️  IMAGE       : ${hasImage}`);
                    console.log(`❓ QUESTION    : ${questionData.text?.substring(0, 60)}...`);
                    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                }
            } catch (error: any) {
                summary.errors.push({
                    row: rowNumber,
                    field: "database",
                    error: error.message,
                });
                summary.failed++;

                // Enhanced Error Logging
                console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`[${rowNumber}/${rows.length}] ❌ QUESTION UPLOAD FAILED (ZIP)`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`⚠️  ERROR: ${error.message}`);
                console.log(`📋 ROW DATA: ${JSON.stringify(row, null, 2)}`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            }
        }

        // Enhanced Final Summary
        console.log(`\n╔════════════════════════════════════════════════════════════╗`);
        console.log(`║           🎉 ZIP UPLOAD COMPLETE - SUMMARY 🎉              ║`);
        console.log(`╚════════════════════════════════════════════════════════════╝\n`);
        console.log(`📊 OVERALL STATISTICS:`);
        console.log(`   ├─ Total Questions    : ${summary.total}`);
        console.log(`   ├─ ✅ Success         : ${summary.success}`);
        console.log(`   ├─ ❌ Failed          : ${summary.failed}`);
        console.log(`   ├─ 💻 With Pseudocode : ${summary.pseudocodeCount}`);
        console.log(`   └─ 🖼️  Images Uploaded : ${summary.imagesUploaded}\n`);

        if (summary.errors.length > 0) {
            console.log(`❌ ERROR DETAILS:`);
            summary.errors.forEach(err => {
                console.log(`   Row ${err.row}: [${err.field}] ${err.error}`);
            });
            console.log('');
        }

        if (Object.keys(summary.divisionBreakdown!).length > 0) {
            console.log(`📂 DIVISION BREAKDOWN:`);
            Object.entries(summary.divisionBreakdown!).forEach(([div, count]) => {
                console.log(`   ├─ ${div.padEnd(20)} : ${count} questions`);
            });
            console.log('');
        }

        if (Object.keys(summary.typeBreakdown!).length > 0) {
            console.log(`📝 TYPE BREAKDOWN:`);
            Object.entries(summary.typeBreakdown!).forEach(([type, count]) => {
                console.log(`   ├─ ${type.padEnd(20)} : ${count} questions`);
            });
            console.log('');
        }

        return summary;

    } catch (error: any) {
        throw new Error(`ZIP processing failed: ${error.message}`);
    }
}
