import axios from "axios";
import { AppDataSource } from "../config/db";
import { SqlQuestion, SqlDialect } from "../entities/SqlQuestion.entity";

const JUDGE0_API_URL = process.env.JUDGE0_API_URL || "https://ce.judge0.com";
const JUDGE0_MAX_RETRIES = parseInt(process.env.JUDGE0_MAX_RETRIES || "20");
const JUDGE0_POLL_INTERVAL = parseInt(process.env.JUDGE0_POLL_INTERVAL || "1000");

const sqlQuestionRepo = () => AppDataSource.getRepository(SqlQuestion);

// Judge0 Language IDs for SQL
const SQL_LANGUAGE_IDS: Record<SqlDialect, number> = {
    [SqlDialect.MYSQL]: 82,        // MySQL 8.0
    [SqlDialect.POSTGRESQL]: 84,   // PostgreSQL 13.0
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
 * Submit SQL query to Judge0
 */
const submitToJudge0 = async (
    sourceCode: string,
    languageId: number,
    stdin?: string
): Promise<string> => {
    try {
        console.log(`   📡 [JUDGE0] Submitting SQL query (Language ID: ${languageId})...`);

        const response = await axios.post(
            `${JUDGE0_API_URL}/submissions?base64_encoded=true`,
            {
                source_code: Buffer.from(sourceCode).toString("base64"),
                language_id: languageId,
                stdin: stdin ? Buffer.from(stdin).toString("base64") : undefined,
            }
        );

        const token = response.data.token;
        console.log(`   📤 [JUDGE0] Submission token: ${token}`);
        return token;
    } catch (error: any) {
        console.error(`   ❌ [JUDGE0] Submission failed:`, error.message);
        throw {
            status: error.response?.status || 500,
            message: "Judge0 submission failed",
        };
    }
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
        const sqlScript = buildSqlScript(
            question.schemaSetup,
            question.sampleData,
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

        // Build complete SQL script
        const sqlScript = buildSqlScript(
            question.schemaSetup,
            question.sampleData,
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
}) => {
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
        query.andWhere("sql_question.topic = :topic", { topic: filters.topic });
    }

    if (filters?.subdivision) {
        query.andWhere("sql_question.subdivision = :subdivision", {
            subdivision: filters.subdivision,
        });
    }

    return await query.getMany();
};
