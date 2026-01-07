import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import { AppDataSource } from "../config/db";
import { Problem, ProblemAccess } from "../entities/problem.entity";
import { TestCase } from "../entities/testcase.entity";
import { User } from "../entities/user.entity";

const problemRepo = () => AppDataSource.getRepository(Problem);
const tcRepo = () => AppDataSource.getRepository(TestCase);
const userRepo = () => AppDataSource.getRepository(User);

// 👇 CHANGE THIS — must match an existing organizer in your DB
const ORGANIZER_EMAIL = "admin@gmail.com";

async function main() {
  try {
    await AppDataSource.initialize();
    console.log("✅ PostgreSQL/Supabase Database initialized...");

    const creator = await userRepo().findOneBy({ email: ORGANIZER_EMAIL });
    if (!creator) {
      console.error(`❌ Organizer not found for email: ${ORGANIZER_EMAIL}`);
      process.exit(1);
    }

    console.log(`👤 Using organizer: ${creator.username} (${creator.email})`);

    const problems = [
      // ---------- SET 1: EASY PUBLIC PROBLEMS ---------

      // ---------- SET 2: MEDIUM PUBLIC PROBLEMS ----------
      {
        title: "Longest Substring Without Repeating Characters",
        difficulty: "Medium",
        accessType: ProblemAccess.PUBLIC,
        description:
          "Given a string s, find the length of the longest substring without repeating characters.",
        inputFormat: "Single line: string s",
        outputFormat: "Print the length of longest substring",
        constraints: "0 ≤ |s| ≤ 5*10^4",
        additionalInfo: "Use sliding window with hash set.",
        visibleTests: [
          { input: "abcabcbb\n", expectedOutput: "3\n" },
          { input: "bbbbb\n", expectedOutput: "1\n" },
        ],
        hiddenTests: [
          { input: "pwwkew\n", expectedOutput: "3\n" },
          { input: "\n", expectedOutput: "0\n" },
          { input: "dvdf\n", expectedOutput: "3\n" },
        ],
      },
      {
        title: "Container With Most Water",
        difficulty: "Medium",
        accessType: ProblemAccess.PRIVATE,
        description:
          "Given n non-negative integers representing heights, find two lines that together with x-axis form a container with maximum water.",
        inputFormat: "First line: N\nSecond line: N integers (heights)",
        outputFormat: "Print maximum area",
        constraints: "2 ≤ N ≤ 10^5, 0 ≤ height[i] ≤ 10^4",
        additionalInfo: "Use two-pointer approach.",
        visibleTests: [
          { input: "9\n1 8 6 2 5 4 8 3 7\n", expectedOutput: "49\n" },
          { input: "2\n1 1\n", expectedOutput: "1\n" },
        ],
        hiddenTests: [
          { input: "6\n4 3 2 1 4 5\n", expectedOutput: "16\n" },
          { input: "3\n1 2 1\n", expectedOutput: "2\n" },
          { input: "5\n2 3 4 5 18\n", expectedOutput: "17\n" },
        ],
      },

      // ---------- SET 3: HARD PUBLIC DP PROBLEMS ----------
      {
        title: "Longest Increasing Subsequence",
        difficulty: "Hard",
        accessType: ProblemAccess.PUBLIC,
        description:
          "Given an integer array nums, return the length of the longest strictly increasing subsequence.",
        inputFormat: "First line: integer N\nSecond line: N integers.",
        outputFormat: "Print the length of the longest increasing subsequence.",
        constraints: "1 ≤ N ≤ 10^5, -10^9 ≤ nums[i] ≤ 10^9",
        additionalInfo: "Use dynamic programming with binary search (O(N log N)).",
        visibleTests: [
          { input: "8\n10 9 2 5 3 7 101 18\n", expectedOutput: "4\n" },
          { input: "6\n0 1 0 3 2 3\n", expectedOutput: "4\n" },
        ],
        hiddenTests: [
          { input: "1\n10\n", expectedOutput: "1\n" },
          { input: "5\n5 4 3 2 1\n", expectedOutput: "1\n" },
          { input: "5\n1 2 3 4 5\n", expectedOutput: "5\n" },
          { input: "7\n3 4 -1 0 6 2 3\n", expectedOutput: "4\n" },
          { input: "10\n1 11 2 10 4 5 2 1 3 7\n", expectedOutput: "5\n" },
        ],
      },
      {
        title: "0/1 Knapsack Problem",
        difficulty: "Hard",
        accessType: ProblemAccess.PUBLIC,
        description:
          "You are given weights and values of N items and a capacity W. Find the maximum total value in the knapsack without exceeding capacity W.",
        inputFormat:
          "First line: N W\nSecond line: N space-separated weights\nThird line: N space-separated values",
        outputFormat: "Print the maximum total value.",
        constraints: "1 ≤ N ≤ 1000, 1 ≤ W ≤ 10^4, 1 ≤ values[i],weights[i] ≤ 1000",
        additionalInfo: "Use bottom-up DP: dp[i][w] = max value using first i items.",
        visibleTests: [
          { input: "3 4\n4 5 1\n1 2 3\n", expectedOutput: "3\n" },
          { input: "4 7\n1 3 4 5\n1 4 5 7\n", expectedOutput: "9\n" },
        ],
        hiddenTests: [
          { input: "3 50\n10 20 30\n60 100 120\n", expectedOutput: "220\n" },
          { input: "2 3\n4 5\n1 2\n", expectedOutput: "0\n" },
          { input: "5 11\n3 4 5 9 4\n1 2 5 7 3\n", expectedOutput: "10\n" },
        ],
      },
     
    ];

    for (const p of problems) {
      const problem = problemRepo().create({
        ...p,
        createdBy: creator,
        accessType: p.accessType || ProblemAccess.PRIVATE,
      });

      await problemRepo().save(problem);

      const allTests = [
        ...p.visibleTests.map((t) => ({ ...t, isHidden: false })),
        ...p.hiddenTests.map((t) => ({ ...t, isHidden: true })),
      ];

      for (const tc of allTests) {
        const test = tcRepo().create({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isHidden: tc.isHidden,
          problem,
        });
        await tcRepo().save(test);
      }

      console.log(`✅ Inserted problem: ${p.title} (${p.difficulty} - ${p.accessType})`);
    }

    console.log("🎯 All 15 problems seeded successfully to Supabase!");
    console.log("📊 Summary:");
    console.log(
      `   - Easy: ${problems.filter((p) => p.difficulty === "Easy").length} problems`
    );
    console.log(
      `   - Medium: ${problems.filter((p) => p.difficulty === "Medium").length} problems`
    );
    console.log(
      `   - Hard: ${problems.filter((p) => p.difficulty === "Hard").length} problems`
    );
    console.log(
      `   - Public: ${problems.filter((p) => p.accessType === ProblemAccess.PUBLIC).length} problems`
    );
    console.log(
      `   - Private: ${problems.filter((p) => p.accessType === ProblemAccess.PRIVATE).length} problems`
    );

    await AppDataSource.destroy();
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed error:", err);
    process.exit(1);
  }
}

main();