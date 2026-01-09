import axios from "axios";
import { AppDataSource } from "../config/db";
import { Problem } from "../entities/problem.entity";
import { SectionProblem } from "../entities/SectionProblem.entity";
import { getFilteredTestCases } from "./sectionProblem.service";

const JUDGE0_API_URL = process.env.JUDGE0_API_URL || "https://ce.judge0.com";
const JUDGE0_MAX_RETRIES = parseInt(process.env.JUDGE0_MAX_RETRIES || "40");
const JUDGE0_POLL_INTERVAL = parseInt(process.env.JUDGE0_POLL_INTERVAL || "3000"); // 3s polling

const problemRepo = () => AppDataSource.getRepository(Problem);
const sectionProblemRepo = () => AppDataSource.getRepository(SectionProblem);

// Language ID mapping for Judge0
const LANGUAGE_IDS: Record<string, number> = {
    "python": 71,      // Python 3.8
    "javascript": 63,  // JavaScript (Node.js 12.14.0)
    "java": 62,        // Java (OpenJDK 13.0.1)
    "c++": 54,         // C++ (GCC 9.2.0)
    "cpp": 54,         // Alias
    "c": 50,           // C (GCC 9.2.0)
    "go": 60,          // Go (1.13.5)
};

interface TestCase {
    input: string;
    output: string;
}

interface ExecutionResult {
    testcaseIndex: number;
    testcaseNumber?: number;     // 1-based index for display
    isHidden?: boolean;          // Whether this is a hidden testcase
    input: string;
    expectedOutput: string;
    actualOutput: string;
    passed: boolean;
    status: string;
    statusCode: number;          // Judge0 status code for easy checking
    time?: string;
    memory?: number;
    // Error details
    errorType?: 'compile' | 'runtime' | 'timeout' | 'memory_limit' | 'internal' | null;
    compileError?: string;       // Compilation error message
    runtimeError?: string;       // Runtime error (stderr)
    error?: string;              // Generic error message
}

interface RunResponse {
    success: boolean;
    results: ExecutionResult[];
    summary: {
        total: number;
        passed: number;
        failed: number;
    };
    // Optional fields for Submit response
    sampleResults?: ExecutionResult[];
    hiddenResults?: ExecutionResult[];
    sampleSummary?: {
        total: number;
        passed: number;
        failed: number;
    };
    hiddenSummary?: {
        total: number;
        passed: number;
        failed: number;
    };
}

/**
 * Combine user solution code with driver code
 */
const combineCodeWithDriver = (
    userCode: string,
    driverCode: Record<string, string> | null,
    language: string
): string => {
    const langKey = language.toLowerCase() === "cpp" ? "c++" : language.toLowerCase();

    if (!driverCode || !driverCode[langKey]) {
        console.log(`   ℹ️ No driver code found for ${langKey}, using user code directly`);
        return userCode;
    }

    let processedUserCode = userCode;

    // 🔧 Java specific: Rename class to 'Solution'
    if (langKey === 'java') {
        const classRegex = /(public\s+)?class\s+(\w+)/g;
        const matches = [...processedUserCode.matchAll(classRegex)];

        let targetClass = "";
        let hasSolutionClass = false;

        for (const match of matches) {
            if (match[2] === 'Solution') {
                hasSolutionClass = true;
                targetClass = 'Solution';
                break;
            }
        }

        if (!hasSolutionClass) {
            const helperClasses = new Set(['Node', 'TreeNode', 'ListNode', 'DoublyListNode', 'Point', 'Pair', 'Interval', 'Edge']);
            const publicClass = matches.find(m => m[1] && m[1].includes('public'));
            if (publicClass) {
                targetClass = publicClass[2];
            } else {
                const candidate = matches.find(m => !helperClasses.has(m[2]));
                if (candidate) targetClass = candidate[2];
            }
        }

        if (targetClass) {
            if (targetClass === 'Solution') {
                processedUserCode = processedUserCode.replace(/public\s+class\s+Solution/, "class Solution");
            } else {
                const replaceRegex = new RegExp(`(public\\s+)?class\\s+${targetClass}\\b`);
                processedUserCode = processedUserCode.replace(replaceRegex, "class Solution");
                const ctorRegex = new RegExp(`\\b${targetClass}\\s*\\(`, 'g');
                processedUserCode = processedUserCode.replace(ctorRegex, "Solution(");
            }
        }
    }

    let driver = driverCode[langKey];
    if (!driver) return processedUserCode;

    // 🔧 Auto-fix indentation: Remove common leading whitespace from driver code
    // This prevents "IndentationError" if driver code was saved with indentation
    const driverLines = driver.split('\n');
    const nonEmptyDriverLines = driverLines.filter(l => l.trim().length > 0);

    if (nonEmptyDriverLines.length > 0) {
        // Use the indentation of the first non-empty line as the baseline
        const firstLineIndent = nonEmptyDriverLines[0].match(/^(\s*)/)?.[1] || "";

        if (firstLineIndent.length > 0) {
            driver = driverLines.map(line => {
                if (line.startsWith(firstLineIndent)) {
                    return line.substring(firstLineIndent.length);
                }
                return line;
            }).join('\n');
        }
    }

    return `${processedUserCode}\n\n${driver.trim()}`;
};

// ==========================================
// BATCH SUBMISSION LOGIC
// ==========================================

/**
 * Submit BATCH of testcases to Judge0
 */
const submitBatchToJudge0 = async (
    sourceCode: string,
    languageId: number,
    testcases: TestCase[]
): Promise<string[]> => {
    try {
        console.log(`\n   📡 [JUDGE0 BATCH] Submitting ${testcases.length} inputs...`);

        const submissions = testcases.map(tc => ({
            source_code: Buffer.from(sourceCode).toString("base64"),
            language_id: languageId,
            stdin: Buffer.from(tc.input).toString("base64"),
            expected_output: tc.output ? Buffer.from(tc.output).toString("base64") : undefined,
        }));

        // Log batch details
        console.log(`   📦 Payload: ${submissions.length} jobs`);
        submissions.forEach((s, i) => {
            const inputPreview = testcases[i].input.replace(/\n/g, '\\n').substring(0, 20);
            const outputPreview = testcases[i].output ? testcases[i].output.replace(/\n/g, '\\n').substring(0, 20) : "N/A";
            console.log(`      Job #${i}: In="${inputPreview}..." | Exp="${outputPreview}..."`);
        });

        const response = await axios.post(`${JUDGE0_API_URL}/submissions/batch?base64_encoded=true`, {
            submissions
        });

        // Response is array of objects: [{token: "..." }, {token: "..."}]
        const tokens = response.data.map((item: any) => item.token);
        console.log(`   📤 [JUDGE0 BATCH] Submitted ${tokens.length} jobs.`);
        return tokens;
    } catch (error: any) {
        console.error(`   ❌ [JUDGE0 BATCH] Submit failed!`);
        throw { status: error.response?.status || 500, message: "Batch submission failed" };
    }
};

/**
 * Poll BATCH results from Judge0
 */
const pollBatchJudge0Result = async (tokens: string[]): Promise<any[]> => {
    const tokenString = tokens.join(",");

    for (let i = 0; i < JUDGE0_MAX_RETRIES; i++) {
        await new Promise(resolve => setTimeout(resolve, JUDGE0_POLL_INTERVAL));

        try {
            const response = await axios.get(
                `${JUDGE0_API_URL}/submissions/batch?tokens=${tokenString}&base64_encoded=true&fields=token,status,stdout,stderr,compile_output,time,memory`
            );

            // Response.data.submissions is array of results
            const submissions = response.data.submissions;

            // Check if ALL are finished
            const pending = submissions.filter((s: any) => s.status.id <= 2);

            if (pending.length > 0) {
                console.log(`   ⏳ [JUDGE0 BATCH] Processing... ${pending.length}/${tokens.length} remaining (attempt ${i + 1})`);
                continue;
            }

            console.log(`   ✅ [JUDGE0 BATCH] All ${tokens.length} jobs completed.`);
            return submissions;

        } catch (error: any) {
            console.error(`   ❌ [JUDGE0 BATCH] Poll failed:`, error.message);
        }
    }

    throw { status: 408, message: "Batch execution timed out" };
};

/**
 * Run code against test cases (OPTIMIZED BATCH + FAIL-FAST)
 */
const executeAgainstTestcases = async (
    code: string,
    language: string,
    testcases: TestCase[]
): Promise<ExecutionResult[]> => {
    const languageId = LANGUAGE_IDS[language.toLowerCase()];
    if (!languageId) {
        throw { status: 400, message: `Unsupported language: ${language}` };
    }

    console.log(`\n🚀 [EXECUTE] Running ${testcases.length} testcase(s) in ${language} (Batch Mode)`);

    const results: ExecutionResult[] = [];

    // Batch Size
    const BATCH_SIZE = 20;

    // 1. FAIL-FAST: Run first batch (Sample cases) or first 5
    // If these have Compilation Error, we STOP immediately.
    const failFastCount = Math.min(testcases.length, 5);
    const initialBatch = testcases.slice(0, failFastCount);
    const remainingTestcases = testcases.slice(failFastCount);

    try {
        // --- Execute Initial Batch ---
        const initialTokens = await submitBatchToJudge0(code, languageId, initialBatch);
        const initialRawResults = await pollBatchJudge0Result(initialTokens);

        // Process results
        for (let i = 0; i < initialRawResults.length; i++) {
            const raw = initialRawResults[i];
            const tc = testcases[i]; // Corresponding testcase (global index)

            const processed = processJudge0Result(raw, tc, i);
            results.push(processed);

            // 🚨 FAIL-FAST CHECK 🚨
            // If Compilation Error (6) or Internal Error (13), abort immediately
            if (processed.statusCode === 6 || processed.statusCode === 13) {
                console.log(`   🛑 [FAIL-FAST] Critical error detected (Status: ${processed.statusCode}). Aborting remaining tests.`);
                return results; // Return what we have (which includes the error)
            }
        }

        // --- Execute Remaining Batches ---
        if (remainingTestcases.length > 0) {
            console.log(`   🔄 Processing remaining ${remainingTestcases.length} testcases in chunks of ${BATCH_SIZE}...`);

            for (let i = 0; i < remainingTestcases.length; i += BATCH_SIZE) {
                const chunk = remainingTestcases.slice(i, i + BATCH_SIZE);
                const chunkStartIndex = failFastCount + i;

                const chunkTokens = await submitBatchToJudge0(code, languageId, chunk);
                const chunkRawResults = await pollBatchJudge0Result(chunkTokens);

                chunkRawResults.forEach((raw, idx) => {
                    const globalIdx = chunkStartIndex + idx;
                    const tc = testcases[globalIdx];
                    results.push(processJudge0Result(raw, tc, globalIdx));
                });
            }
        }

    } catch (error: any) {
        console.error(`   ❌ [EXECUTE] Fatal error:`, error.message);
        // If batch fails entirely, return generic error for unrun tests
        // (Simplified for now, expecting batch API to be stable)
    }

    return results;
};

/**
 * Helper to process raw Judge0 response into ExecutionResult
 */
const processJudge0Result = (raw: any, tc: TestCase, index: number): ExecutionResult => {
    const statusId = raw.status.id;
    const stdout = raw.stdout ? Buffer.from(raw.stdout, "base64").toString() : "";
    const stderr = raw.stderr ? Buffer.from(raw.stderr, "base64").toString() : "";
    const compileOutput = raw.compile_output ? Buffer.from(raw.compile_output, "base64").toString() : "";

    // Normalize logic
    const actualOutput = stdout.trim();
    const expectedOutput = tc.output.trim();
    // ... logic ...
    const passed = actualOutput === expectedOutput && statusId === 3;

    // Detailed Logging
    const icon = passed ? "✅" : "❌";
    const statusText = passed ? "PASSED" : "FAILED";
    const logDetails = `   ${icon} [TEST #${index + 1}] Status: ${statusText} | In: "${tc.input.replace(/\n/g, '\\n').substring(0, 20)}${tc.input.length > 20 ? '...' : ''}" | Exp: "${tc.output.replace(/\n/g, '\\n').substring(0, 20)}..." | Act: "${actualOutput.replace(/\n/g, '\\n').substring(0, 20)}..."`;
    console.log(logDetails);

    if (!passed && statusId !== 3) {
        console.log(`      ⚠️ Status Code: ${statusId} (${raw.status.description})`);
        if (stderr) console.log(`      ⚠️ Stderr: ${stderr.substring(0, 100)}...`);
    }

    let errorType: ExecutionResult['errorType'] = null;
    if (statusId === 6) errorType = 'compile';
    else if (statusId === 5) errorType = 'timeout';
    else if (statusId === 9) errorType = 'memory_limit';
    else if (statusId >= 7 && statusId <= 12) errorType = 'runtime';
    else if (statusId >= 13) errorType = 'internal';

    return {
        testcaseIndex: index,
        input: tc.input,
        expectedOutput: expectedOutput,
        actualOutput: actualOutput,
        passed: passed,
        status: raw.status.description,
        statusCode: statusId,
        time: raw.time,
        memory: raw.memory,
        errorType: errorType,
        compileError: statusId === 6 ? compileOutput : undefined,
        runtimeError: stderr || undefined,
        error: compileOutput || stderr || undefined,
    };
};

/**
 * RUN CODE - Execute against sample testcases only
 */
export const runCode = async (
    problemId: string,
    code: string,
    language: string,
    sectionProblemId?: string
): Promise<RunResponse> => {
    console.log(`\n🏃 [RUN] Running code for problem ${problemId}`);

    const problem = await problemRepo().findOne({ where: { id: problemId } });
    if (!problem) throw { status: 404, message: "Problem not found" };

    let sampleTestcases: TestCase[] = problem.exampleTestcases || [];
    const originalCount = sampleTestcases.length;

    // 🎯 Apply assessment-specific filtering if configuration provided
    if (sectionProblemId) {
        const sectionProblem = await sectionProblemRepo().findOne({
            where: { id: sectionProblemId },
            relations: ["problem"]
        });

        if (sectionProblem && sectionProblem.testCaseConfig) {
            console.log(`   🎯 [PARTIAL RUN] Applying filter from sectionProblem ${sectionProblemId}...`);
            const filtered = getFilteredTestCases(problem, sectionProblem.testCaseConfig);
            sampleTestcases = filtered.exampleTestcases;

            console.log(`      Example: ${sampleTestcases.length}/${originalCount} cases (${Math.round(sampleTestcases.length / originalCount * 100)}%)`);
        } else {
            console.log(`   📋 [FULL RUN] Using ALL sample cases (No config found)`);
        }
    } else {
        console.log(`   📋 [FULL RUN] Using ALL sample cases (No context provided)`);
    }

    if (sampleTestcases.length === 0) throw { status: 400, message: "No sample testcases available for execution" };

    const fullCode = combineCodeWithDriver(code, problem.driverCode as Record<string, string> | null, language);
    const results = await executeAgainstTestcases(fullCode, language, sampleTestcases);

    const passed = results.filter(r => r.passed).length;

    return {
        success: passed === results.length,
        results,
        summary: { total: results.length, passed, failed: results.length - passed },
    };
};

/**
 * SUBMIT CODE - Execute against sample + hidden testcases
 * 🎯 Supports assessment-specific test case filtering
 */
export const submitCode = async (
    problemId: string,
    code: string,
    language: string,
    userId: string,
    assessmentId?: string,
    sectionId?: string,
    sectionProblemId?: string  // 🎯 NEW: For test case filtering
): Promise<RunResponse & { score: number; maxScore: number }> => {
    console.log(`\n📨 [SUBMIT] Submitting code for problem ${problemId} by user ${userId}`);
    if (sectionProblemId) {
        console.log(`   🎯 Using assessment-specific config from sectionProblem: ${sectionProblemId}`);
    }

    const problem = await problemRepo().findOne({ where: { id: problemId } });
    if (!problem) throw { status: 404, message: "Problem not found" };

    const originalExampleCount = problem.exampleTestcases?.length || 0;
    const originalHiddenCount = problem.hiddenTestcases?.length || 0;

    // 🎯 Get assessment-specific test case configuration
    let sampleTestcases: TestCase[] = problem.exampleTestcases || [];
    let hiddenTestcases: TestCase[] = problem.hiddenTestcases || [];

    if (sectionProblemId) {
        const sectionProblem = await sectionProblemRepo().findOne({
            where: { id: sectionProblemId },
            relations: ["problem"]
        });

        if (sectionProblem && sectionProblem.testCaseConfig) {
            console.log(`   🎯 [PARTIAL TEST CASES] Applying filter...`);
            const filtered = getFilteredTestCases(problem, sectionProblem.testCaseConfig);
            sampleTestcases = filtered.exampleTestcases;
            hiddenTestcases = filtered.hiddenTestcases;

            console.log(`      Example: ${sampleTestcases.length}/${originalExampleCount} (${Math.round(sampleTestcases.length / originalExampleCount * 100)}%)`);
            console.log(`      Hidden: ${hiddenTestcases.length}/${originalHiddenCount} (${Math.round(hiddenTestcases.length / originalHiddenCount * 100)}%)`);
            console.log(`      Config:`, JSON.stringify(sectionProblem.testCaseConfig));
        } else {
            console.log(`   📋 [FULL TEST CASES] No config - using all test cases`);
            console.log(`      Example: ${originalExampleCount} (100%)`);
            console.log(`      Hidden: ${originalHiddenCount} (100%)`);
        }
    } else {
        console.log(`   📋 [FULL TEST CASES] No sectionProblemId provided - using all test cases`);
        console.log(`      Example: ${originalExampleCount} (100%)`);
        console.log(`      Hidden: ${originalHiddenCount} (100%)`);
    }

    const allTestcases = [...sampleTestcases, ...hiddenTestcases];

    if (allTestcases.length === 0) throw { status: 400, message: "No testcases available" };

    console.log(`   📊 Total test cases to execute: ${allTestcases.length} (${sampleTestcases.length} example + ${hiddenTestcases.length} hidden)`);

    const fullCode = combineCodeWithDriver(code, problem.driverCode as Record<string, string> | null, language);

    // EXECUTE (Batch Optimized)
    const results = await executeAgainstTestcases(fullCode, language, allTestcases);

    const passed = results.filter(r => r.passed).length;
    const score = Math.round((passed / allTestcases.length) * 100);

    console.log(`\n📊 [SUBMIT] Score: ${score}/100 (${passed}/${allTestcases.length} passed)`);

    // Separate results logic (same as before)
    const sampleResults = results.slice(0, sampleTestcases.length);
    const hiddenResults = results.slice(sampleTestcases.length);
    const samplePassed = sampleResults.filter(r => r.passed).length;
    const hiddenPassed = hiddenResults.filter(r => r.passed).length;

    return {
        success: passed === allTestcases.length,
        sampleResults: sampleResults.map((r, idx) => ({
            ...r, isHidden: false, testcaseNumber: idx + 1,
        })),
        hiddenResults: hiddenResults.map((r, idx) => ({
            testcaseIndex: sampleTestcases.length + idx,
            testcaseNumber: sampleTestcases.length + idx + 1,
            isHidden: true,
            passed: r.passed,
            status: r.status,
            statusCode: r.statusCode,
            errorType: r.errorType,
            input: "[Hidden]",
            expectedOutput: "[Hidden]",
            actualOutput: r.passed ? "✓ Correct" : "✗ Incorrect",
            time: r.time,
            memory: r.memory,
        })),
        summary: { total: allTestcases.length, passed, failed: allTestcases.length - passed },
        sampleSummary: { total: sampleTestcases.length, passed: samplePassed, failed: sampleTestcases.length - samplePassed },
        hiddenSummary: { total: hiddenTestcases.length, passed: hiddenPassed, failed: hiddenTestcases.length - hiddenPassed },
        score,
        maxScore: 100,
        results: results.map((r, idx) => ({
            ...r,
            isHidden: idx >= sampleTestcases.length,
            input: idx < sampleTestcases.length ? r.input : "[Hidden]",
            expectedOutput: idx < sampleTestcases.length ? r.expectedOutput : "[Hidden]",
            actualOutput: idx < sampleTestcases.length ? r.actualOutput : (r.passed ? "✓ Correct" : "✗ Incorrect"),
        })),
    };
};
