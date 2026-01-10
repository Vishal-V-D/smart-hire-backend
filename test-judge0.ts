/**
 * 🧪 Judge0 API Tester
 * Tests the Judge0 endpoint with a simple Two Sum problem
 * Run with: npx ts-node test-judge0.ts
 */

import axios from "axios";

const JUDGE0_URL = "https://judge.decodex.live";

// Simple Two Sum solution in Python
const pythonCode = `
def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []

# Read input
n = int(input())
nums = list(map(int, input().split()))
target = int(input())

result = two_sum(nums, target)
print(result[0], result[1])
`;

// Test cases: input -> expected output
const testCases = [
    { input: "4\n2 7 11 15\n9", output: "0 1" },
    { input: "3\n3 2 4\n6", output: "1 2" },
    { input: "2\n3 3\n6", output: "0 1" },
    { input: "5\n1 2 3 4 5\n9", output: "3 4" },
    { input: "4\n-1 -2 -3 -4\n-6", output: "1 3" },
];

async function testJudge0() {
    console.log("=".repeat(60));
    console.log("🧪 JUDGE0 API TESTER");
    console.log("=".repeat(60));
    console.log(`📍 Endpoint: ${JUDGE0_URL}`);
    console.log(`📝 Testing Two Sum with ${testCases.length} test cases\n`);

    // Step 1: Check server health
    console.log("📡 Step 1: Checking server health...");
    try {
        const aboutRes = await axios.get(`${JUDGE0_URL}/about`);
        console.log(`   ✅ Server Online: ${aboutRes.data.version || 'OK'}`);
    } catch (err: any) {
        console.log(`   ❌ Server unreachable: ${err.message}`);
        return;
    }

    // Step 2: Check workers
    console.log("\n👷 Step 2: Checking workers...");
    try {
        const workersRes = await axios.get(`${JUDGE0_URL}/workers`);
        console.log(`   📊 Workers response:`);
        console.log(JSON.stringify(workersRes.data, null, 4));

        const workers = workersRes.data[0] || {};
        if (workers.available === 0 && workers.idle === 0 && workers.working === 0) {
            console.log("\n   ⚠️  WARNING: NO WORKERS AVAILABLE!");
            console.log("   ⚠️  Submissions will fail with 'Operation not permitted'");
        }
    } catch (err: any) {
        console.log(`   ⚠️ Could not check workers: ${err.message}`);
    }

    // Step 3: Submit batch
    console.log("\n📤 Step 3: Submitting batch of test cases...");
    const submissions = testCases.map((tc, i) => ({
        source_code: Buffer.from(pythonCode).toString("base64"),
        language_id: 71, // Python 3
        stdin: Buffer.from(tc.input).toString("base64"),
        expected_output: Buffer.from(tc.output).toString("base64"),
        enable_network: false,
    }));

    console.log(`   📦 Payload: ${submissions.length} jobs`);
    testCases.forEach((tc, i) => {
        console.log(`      Job #${i}: Input="${tc.input.replace(/\n/g, '\\n').substring(0, 30)}..." | Expected="${tc.output}"`);
    });

    let tokens: string[] = [];
    try {
        const submitRes = await axios.post(
            `${JUDGE0_URL}/submissions/batch?base64_encoded=true`,
            { submissions },
            { headers: { "Content-Type": "application/json" } }
        );
        tokens = submitRes.data.map((item: any) => item.token);
        console.log(`\n   ✅ Submitted! Tokens: ${tokens.join(", ")}`);
    } catch (err: any) {
        console.log(`\n   ❌ Submission failed!`);
        console.log(`   Error: ${err.message}`);
        if (err.response) {
            console.log(`   Status: ${err.response.status}`);
            console.log(`   Response: ${JSON.stringify(err.response.data)}`);
        }
        return;
    }

    // Step 4: Poll for results
    console.log("\n⏳ Step 4: Polling for results...");
    const tokenString = tokens.join(",");
    let results: any[] = [];

    for (let attempt = 1; attempt <= 20; attempt++) {
        await new Promise(r => setTimeout(r, 2000)); // Wait 2s

        try {
            const pollRes = await axios.get(
                `${JUDGE0_URL}/submissions/batch?tokens=${tokenString}&base64_encoded=true&fields=token,status,stdout,stderr,compile_output,time,memory,message`
            );

            results = pollRes.data.submissions;
            const pending = results.filter((s: any) => s.status.id <= 2);

            if (pending.length > 0) {
                console.log(`   ⏳ Attempt ${attempt}: ${pending.length}/${tokens.length} still processing...`);
                continue;
            }

            console.log(`   ✅ All ${tokens.length} jobs completed!\n`);
            break;
        } catch (err: any) {
            console.log(`   ❌ Poll attempt ${attempt} failed: ${err.message}`);
        }
    }

    // Step 5: Display results
    console.log("📊 Step 5: Results:");
    console.log("-".repeat(60));

    let passed = 0;
    let failed = 0;

    results.forEach((res: any, i: number) => {
        const statusId = res.status?.id;
        const statusDesc = res.status?.description || "Unknown";
        const stdout = res.stdout ? Buffer.from(res.stdout, "base64").toString().trim() : "";
        const stderr = res.stderr ? Buffer.from(res.stderr, "base64").toString().trim() : "";
        const message = res.message || "";
        const expected = testCases[i].output;

        const isPass = stdout === expected && statusId === 3;

        console.log(`\n   📝 Test #${i + 1}:`);
        console.log(`      Status: ${statusId} (${statusDesc})`);
        console.log(`      Expected: "${expected}"`);
        console.log(`      Actual:   "${stdout}"`);

        if (stderr) {
            console.log(`      ⚠️ Stderr: ${stderr}`);
        }
        if (message) {
            console.log(`      ⚠️ Message: ${message}`);
        }

        if (statusId === 13) {
            console.log(`      ❌ INTERNAL ERROR - This is a Judge0 server configuration issue!`);
            failed++;
        } else if (isPass) {
            console.log(`      ✅ PASSED`);
            passed++;
        } else {
            console.log(`      ❌ FAILED`);
            failed++;
        }
    });

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log(`📊 SUMMARY: ${passed}/${testCases.length} passed, ${failed} failed`);

    if (failed > 0 && results.some((r: any) => r.status?.id === 13)) {
        console.log("\n⚠️  DIAGNOSIS:");
        console.log("   Status 13 (Internal Error) indicates Judge0 workers are");
        console.log("   failing to create sandboxes. This is a SERVER-SIDE issue.");
        console.log("   The Judge0 instance needs to be run with --privileged flag");
        console.log("   or proper Linux kernel capabilities (CAP_SYS_ADMIN).");
    }

    console.log("=".repeat(60));
}

testJudge0().catch(console.error);
