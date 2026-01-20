import axios from "axios";
import { AppDataSource } from "../config/db";
import { SqlQuestion, SqlDialect } from "../entities/SqlQuestion.entity";

const JUDGE0_API_URL = process.env.JUDGE0_API_URL || "https://ce.judge0.com";
const JUDGE0_MAX_RETRIES = parseInt(process.env.JUDGE0_MAX_RETRIES || "20");
const JUDGE0_POLL_INTERVAL = parseInt(process.env.JUDGE0_POLL_INTERVAL || "1000");

const sqlQuestionRepo = () => AppDataSource.getRepository(SqlQuestion);

// Judge0 Language IDs for SQL
// Note: Judge0 CE only supports SQLite (ID 82) for SQL execution
// Both MySQL and PostgreSQL queries will run on SQLite engine
const SQL_LANGUAGE_IDS: Record<SqlDialect, number> = {
    [SqlDialect.MYSQL]: 82,        // SQL (SQLite 3.27.2)
    [SqlDialect.POSTGRESQL]: 82,   // SQL (SQLite 3.27.2)
};

interface SqlExecutionResult {
    success: boolean;
    output?: any[];
    rawOutput?: string;
    error?: string;
    executionTime?: number;
    isCorrect?: boolean;
    expectedOutput?: any[];
    status?: string;
    statusCode?: number;
}

/**
 * Submit SQL query to Judge0 with retry logic
 */
const submitToJudge0 = async (
    sourceCode: string,
    languageId: number,
    stdin?: string,
    retries = 3
): Promise<string> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`   📡 [JUDGE0] Submitting SQL query (Language ID: ${languageId})${attempt > 1 ? ` - Attempt ${attempt}/${retries}` : ''}...`);

            const response = await axios.post(
                `${JUDGE0_API_URL}/submissions?base64_encoded=true`,
                {
                    source_code: Buffer.from(sourceCode).toString("base64"),
                    language_id: languageId,
                    stdin: stdin ? Buffer.from(stdin).toString("base64") : undefined,
                },
                {
                    timeout: 10000, // 10 second timeout
                }
            );

            const token = response.data.token;
            console.log(`   📤 [JUDGE0] Submission token: ${token}`);
            return token;
        } catch (error: any) {
            const isLastAttempt = attempt === retries;
            const isNetworkError = error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED';

            if (isNetworkError && !isLastAttempt) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
                console.warn(`   ⚠️ [JUDGE0] Connection error (${error.code}), retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            console.error(`   ❌ [JUDGE0] Submission failed:`, error.message);
            throw {
                status: error.response?.status || 500,
                message: isNetworkError
                    ? "Judge0 connection failed. Please try again."
                    : "Judge0 submission failed",
            };
        }
    }

    throw {
        status: 500,
        message: "Judge0 submission failed after multiple retries",
    };
};

/**
 * Poll Judge0 for result
 */
const pollJudge0Result = async (token: string): Promise<any> => {
    for (let i = 0; i < JUDGE0_MAX_RETRIES; i++) {
        await new Promise((resolve) => setTimeout(resolve, JUDGE0_POLL_INTERVAL));

        try {
            const response = await axios.get(
                `${JUDGE0_API_URL}/submissions/${token}?base64_encoded=true&fields=stdout,stderr,status,time,memory,compile_output`
            );

            const status = response.data.status;

            // Status IDs: 1=In Queue, 2=Processing, 3=Accepted
            if (status.id <= 2) {
                console.log(`   ⏳ [JUDGE0] Processing... (attempt ${i + 1}/${JUDGE0_MAX_RETRIES})`);
                continue;
            }

            console.log(`   ✅ [JUDGE0] Execution completed (Status: ${status.description})`);
            return response.data;
        } catch (error: any) {
            console.error(`   ❌ [JUDGE0] Poll failed:`, error.message);
        }
    }

    throw { status: 408, message: "Judge0 execution timed out" };
};

/**
 * Parse SQL result output (CSV or JSON format)
 */
const parseSqlOutput = (output: string): any[] => {
    try {
        // Try parsing as JSON first
        return JSON.parse(output);
    } catch {
        // If not JSON, parse as CSV-like output
        const lines = output.trim().split("\n");
        if (lines.length === 0) return [];

        // First line is headers
        const headers = lines[0].split(/\s+\|\s+/).map(h => h.trim());

        // Skip separator line if exists
        const dataStartIndex = lines[1]?.includes("---") ? 2 : 1;

        const rows = [];
        for (let i = dataStartIndex; i < lines.length; i++) {
            const values = lines[i].split(/\s+\|\s+/).map(v => v.trim());
            if (values.length === headers.length) {
                const row: any = {};
                headers.forEach((header, idx) => {
                    row[header] = values[idx];
                });
                rows.push(row);
            }
        }

        return rows;
    }
};

/**
 * Compare SQL results
 */
const compareResults = (actual: any[], expected: any[]): boolean => {
    if (actual.length !== expected.length) {
        return false;
    }

    // Sort both arrays for comparison (order might differ)
    const sortedActual = JSON.stringify(actual.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
    const sortedExpected = JSON.stringify(expected.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));

    return sortedActual === sortedExpected;
};

/**
 * Build complete SQL script with schema, data, and query
 */
const buildSqlScript = (
    schemaSetup: string,
    sampleData: string | null,
    userQuery: string,
    dialect: SqlDialect
): string => {
    let script = "";

    // Add schema setup
    script += schemaSetup.trim() + "\n\n";

    // Add sample data if provided
    if (sampleData) {
        script += sampleData.trim() + "\n\n";
    }

    // Add user query
    script += userQuery.trim() + ";";

    return script;
};

/**
 * Helper to infer SQL type from value
 */
const inferSqlType = (value: any): string => {
    if (typeof value === 'number') {
        return Number.isInteger(value) ? 'INT' : 'DECIMAL(10,2)';
    }
    if (typeof value === 'boolean') return 'BOOLEAN';
    // Simple date check
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return 'DATETIME';
    return 'TEXT';
};

/**
 * Generate CREATE TABLE and INSERT statements from inputTables JSON
 */
const generateSqlFromInputTables = (inputTables: any, dialect: SqlDialect): string => {
    if (!inputTables || !Array.isArray(inputTables)) return "";

    let script = "";

    for (const table of inputTables) {
        if (!table.name || !table.columns) continue;

        // 1. CREATE TABLE
        script += `CREATE TABLE ${table.name} (\n`;

        const columnDefs = table.columns.map((col: string) => {
            // Try to infer type from first row of data
            let type = "TEXT";
            if (table.rows && table.rows.length > 0) {
                const sampleVal = table.rows[0][col];
                if (sampleVal !== undefined && sampleVal !== null) {
                    type = inferSqlType(sampleVal);
                }
            }
            return `    ${col} ${type}`;
        });

        script += columnDefs.join(",\n");
        script += `\n);\n\n`;

        // 2. INSERT DATA
        if (table.rows && table.rows.length > 0) {
            script += `INSERT INTO ${table.name} (${table.columns.join(", ")}) VALUES\n`;

            const valueRows = table.rows.map((row: any) => {
                const values = table.columns.map((col: string) => {
                    const val = row[col];
                    if (val === null) return "NULL";
                    if (typeof val === 'number') return val;
                    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
                    // Escape single quotes for SQL
                    return `'${val.toString().replace(/'/g, "''")}'`;
                });
                return `(${values.join(", ")})`;
            });

            script += valueRows.join(",\n") + ";\n\n";
        }
    }

    return script;
};

/**
 * Run SQL query (for testing/practice)
 */
export const runSqlQuery = async (
    questionId: string,
    userQuery: string
): Promise<SqlExecutionResult> => {
    try {
        const question = await sqlQuestionRepo().findOne({
            where: { id: questionId },
        });

        if (!question) {
            return {
                success: false,
                error: "SQL question not found",
            };
        }

        console.log(`\n🔍 [SQL RUN] Question: ${question.title}`);
        console.log(`   Dialect: ${question.dialect}`);
        console.log(`   Query: ${userQuery.substring(0, 100)}...`);

        // Build complete SQL script
        // Check if we need to generate SQL from inputTables (if schemaSetup is placeholder or inputTables exists)
        let schemaSetup = question.schemaSetup;
        let sampleData = question.sampleData;

        // If inputTables exists, use it to generate the schema and data
        if (question.inputTables) {
            console.log(`   🛠️  Generating SQL Schema from inputTables...`);
            const generatedSql = generateSqlFromInputTables(question.inputTables, question.dialect);
            schemaSetup = generatedSql; // Contains both schema and data
            sampleData = ""; // Data is included in generatedSql
        }

        // Build complete SQL script
        const sqlScript = buildSqlScript(
            schemaSetup,
            sampleData,
            userQuery,
            question.dialect
        );

        // Get language ID for Judge0
        const languageId = SQL_LANGUAGE_IDS[question.dialect];

        // Submit to Judge0
        const token = await submitToJudge0(sqlScript, languageId);
        const result = await pollJudge0Result(token);

        // Process result
        const statusId = result.status.id;
        const stdout = result.stdout ? Buffer.from(result.stdout, "base64").toString() : "";
        const stderr = result.stderr ? Buffer.from(result.stderr, "base64").toString() : "";
        const compileOutput = result.compile_output ? Buffer.from(result.compile_output, "base64").toString() : "";

        // Check for errors
        if (statusId !== 3) {
            console.log(`   ❌ [SQL RUN] Execution failed (Status: ${result.status.description})`);
            return {
                success: false,
                error: stderr || compileOutput || result.status.description,
                status: result.status.description,
                statusCode: statusId,
            };
        }

        // Parse output
        const parsedOutput = parseSqlOutput(stdout);

        console.log(`   ✅ [SQL RUN] Success`);
        console.log(`   ⏱️  Execution time: ${result.time}s`);
        console.log(`   📊 Rows returned: ${parsedOutput.length}`);

        return {
            success: true,
            output: parsedOutput,
            rawOutput: stdout,
            executionTime: parseFloat(result.time) * 1000, // Convert to ms
            status: result.status.description,
            statusCode: statusId,
        };
    } catch (error: any) {
        console.error(`   ❌ [SQL RUN] Error:`, error.message);
        return {
            success: false,
            error: error.message || "SQL execution failed",
        };
    }
};

/**
 * Submit SQL query (for evaluation)
 */
export const submitSqlQuery = async (
    questionId: string,
    userQuery: string
): Promise<SqlExecutionResult> => {
    try {
        const question = await sqlQuestionRepo().findOne({
            where: { id: questionId },
        });

        if (!question) {
            return {
                success: false,
                error: "SQL question not found",
            };
        }

        console.log(`\n📤 [SQL SUBMIT] Question: ${question.title}`);
        console.log(`   Dialect: ${question.dialect}`);
        console.log(`   Query: ${userQuery.substring(0, 100)}...`);

        // Check if we need to generate SQL from inputTables (if schemaSetup is placeholder or inputTables exists)
        let schemaSetup = question.schemaSetup;
        let sampleData = question.sampleData;

        // If inputTables exists, use it to generate the schema and data
        if (question.inputTables) {
            console.log(`   🛠️  Generating SQL Schema from inputTables...`);
            const generatedSql = generateSqlFromInputTables(question.inputTables, question.dialect);
            schemaSetup = generatedSql; // Contains both schema and data
            sampleData = ""; // Data is included in generatedSql
        }

        // Build complete SQL script
        const sqlScript = buildSqlScript(
            schemaSetup,
            sampleData,
            userQuery,
            question.dialect
        );

        // Get language ID for Judge0
        const languageId = SQL_LANGUAGE_IDS[question.dialect];

        // Submit to Judge0
        const token = await submitToJudge0(sqlScript, languageId);
        const result = await pollJudge0Result(token);

        // Process result
        const statusId = result.status.id;
        const stdout = result.stdout ? Buffer.from(result.stdout, "base64").toString() : "";
        const stderr = result.stderr ? Buffer.from(result.stderr, "base64").toString() : "";
        const compileOutput = result.compile_output ? Buffer.from(result.compile_output, "base64").toString() : "";

        // Check for errors
        if (statusId !== 3) {
            console.log(`   ❌ [SQL SUBMIT] Execution failed (Status: ${result.status.description})`);
            return {
                success: false,
                error: stderr || compileOutput || result.status.description,
                isCorrect: false,
                status: result.status.description,
                statusCode: statusId,
            };
        }

        // Parse output
        const parsedOutput = parseSqlOutput(stdout);

        // Compare with expected result
        const isCorrect = compareResults(parsedOutput, question.expectedResult);

        console.log(`   ${isCorrect ? '✅' : '❌'} [SQL SUBMIT] Result: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);
        console.log(`   ⏱️  Execution time: ${result.time}s`);
        console.log(`   📊 Rows returned: ${parsedOutput.length}`);

        return {
            success: true,
            output: parsedOutput,
            rawOutput: stdout,
            executionTime: parseFloat(result.time) * 1000, // Convert to ms
            isCorrect,
            expectedOutput: question.expectedResult,
            status: result.status.description,
            statusCode: statusId,
        };
    } catch (error: any) {
        console.error(`   ❌ [SQL SUBMIT] Error:`, error.message);
        return {
            success: false,
            error: error.message || "SQL execution failed",
            isCorrect: false,
        };
    }
};

/**
 * Get SQL question by ID
 */
export const getSqlQuestion = async (questionId: string) => {
    return await sqlQuestionRepo().findOne({
        where: { id: questionId },
    });
};

/**
 * Get all SQL questions
 */
export const getAllSqlQuestions = async (filters?: {
    dialect?: SqlDialect;
    difficulty?: string;
    topic?: string;
    subdivision?: string;
    division?: string;
}) => {
    console.log("🔍 [GET_ALL_SQL] Filters:", filters);
    const query = sqlQuestionRepo().createQueryBuilder("sql_question");

    if (filters?.dialect) {
        query.andWhere("sql_question.dialect = :dialect", {
            dialect: filters.dialect,
        });
    }

    if (filters?.difficulty) {
        query.andWhere("sql_question.difficulty = :difficulty", {
            difficulty: filters.difficulty,
        });
    }

    if (filters?.topic) {
        query.andWhere("sql_question.topic ILIKE :topic", { topic: `%${filters.topic}%` });
    }

    if (filters?.subdivision) {
        query.andWhere("sql_question.subdivision ILIKE :subdivision", {
            subdivision: `%${filters.subdivision}%`,
        });
    }

    if (filters?.division) {
        query.andWhere("sql_question.division ILIKE :division", {
            division: `%${filters.division}%`,
        });
    }

    const result = await query.getMany();
    console.log(`✅ [GET_ALL_SQL] Found ${result.length} questions`);

    if (result.length === 0 && Object.keys(filters || {}).length > 0) {
        // Debug: Show what's actually in the database
        const allQuestions = await sqlQuestionRepo().find({ take: 3 });
        console.log(`🔍 [DEBUG] Sample questions in DB:`);
        allQuestions.forEach(q => {
            console.log(`   - Division: "${q.division}", Subdivision: "${q.subdivision}", Topic: "${q.topic}"`);
        });
    }

    console.log(`📊 [GET_ALL_SQL] SQL Query:`, query.getSql());
    console.log(`📊 [GET_ALL_SQL] Parameters:`, query.getParameters());
    return result;
};

/**
 * Get unique filter options for SQL questions
 */
export const getSqlFilterOptions = async (): Promise<{
    dialects: string[];
    difficulties: string[];
    topics: string[];
    subdivisions: string[];
}> => {
    const qb = sqlQuestionRepo().createQueryBuilder("sql_question");

    // Get distinct values
    const dialects = await qb
        .select("DISTINCT(sql_question.dialect)", "dialect")
        .where("sql_question.dialect IS NOT NULL")
        .getRawMany();


    const difficulties = await qb
        .select("DISTINCT(sql_question.difficulty)", "difficulty")
        .where("sql_question.difficulty IS NOT NULL")
        .getRawMany();

    const topics = await qb
        .select("DISTINCT(sql_question.topic)", "topic")
        .where("sql_question.topic IS NOT NULL")
        .getRawMany();

    const subdivisions = await qb
        .select("DISTINCT(sql_question.subdivision)", "subdivision")
        .where("sql_question.subdivision IS NOT NULL")
        .getRawMany();

    return {
        dialects: dialects.map(d => d.dialect).sort(),
        difficulties: difficulties.map(d => d.difficulty).sort(),
        topics: topics.map(t => t.topic).sort(),
        subdivisions: subdivisions.map(s => s.subdivision).sort(),
    };
};

/**
 * Update SQL question
 */
export const updateSqlQuestion = async (questionId: string, updateData: Partial<any>) => {
    console.log(`🔄 [UPDATE_SQL] Updating question: ${questionId}`);

    const question = await sqlQuestionRepo().findOne({
        where: { id: questionId },
    });

    if (!question) {
        throw { status: 404, message: "SQL question not found" };
    }

    // Update fields
    Object.assign(question, updateData);

    const updatedQuestion = await sqlQuestionRepo().save(question);
    console.log(`✅ [UPDATE_SQL] Question updated successfully`);

    return updatedQuestion;
};

/**
 * Delete SQL question
 */
export const deleteSqlQuestion = async (questionId: string) => {
    console.log(`🗑️ [DELETE_SQL] Deleting question: ${questionId}`);

    const question = await sqlQuestionRepo().findOne({
        where: { id: questionId },
    });

    if (!question) {
        throw { status: 404, message: "SQL question not found" };
    }

    await sqlQuestionRepo().remove(question);
    console.log(`✅ [DELETE_SQL] Question deleted successfully`);

    return { success: true, message: "SQL question deleted successfully" };
};

