#!/usr/bin/env node
/**
 * Standalone script to seed problems & testcases into the production RDS database.
 *
 * Usage:
 *   1. Update the CONFIG block below with your RDS credentials / organizer email.
 *   2. Install dependencies (once): npm install mysql2 dotenv
 *   3. Run: node seed-problems-rds.js
 */

const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const { randomUUID } = require("crypto");

dotenv.config();

//#region CONFIG – update these values before running
const CONFIG = {
  db: {
    host:  "quantum-judge-dev.capsi2agwav9.us-east-1.rds.amazonaws.com",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user:  "admin",
    password:  "!zX*HFjR[aTd5Zkz",
    database: "quantum_judge",
  },
  organizerEmail: process.env.ORGANIZER_EMAIL || "admin@gmail.com",
};
//#endregion

const ProblemAccess = {
  PUBLIC: "PUBLIC",
  PRIVATE: "PRIVATE",
};

//#region INLINE PROBLEMS

const problems = [
  {
  title: "Minimum Window Substring",
  difficulty: "Hard",
  accessType: ProblemAccess.PRIVATE,
  description:
    "Given two strings s and t, return the minimum window of s which contains all the characters in t. If no such window exists, return an empty string.",
  inputFormat: "Two lines: s and t.",
  outputFormat: "Print the minimum window substring.",
  constraints: "1 ≤ |s|,|t| ≤ 10^5",
  additionalInfo: "Use two-pointer + frequency tracking.",
  visibleTests: [
    { input: "ADOBECODEBANC\nABC\n", expectedOutput: "BANC\n" },
    { input: "a\naa\n", expectedOutput: "\n" },
  ],
  hiddenTests: [
    { input: "aa\naa\n", expectedOutput: "aa\n" },
    { input: "aabdec\nabc\n", expectedOutput: "abdec\n" },
    { input: "xyz\nx\n", expectedOutput: "x\n" },
    { input: "abc\nz\n", expectedOutput: "\n" },
    { input: "aaaaaaa\naa\n", expectedOutput: "aa\n" },
  ],
},
{
  title: "Word Break II",
  difficulty: "Hard",
  accessType: ProblemAccess.PRIVATE,
  description:
    "Given a string s and a dictionary of words wordDict, return all possible sentences where each word is in wordDict.",
  inputFormat: "First line: s\nSecond line: space-separated words.",
  outputFormat: "Print each valid sentence in a newline.",
  constraints: "1 ≤ |s| ≤ 20, |dict| ≤ 20",
  additionalInfo: "Use DFS + memoization.",
  visibleTests: [
    { input: "catsanddog\ncat cats and sand dog\n", expectedOutput: "cat sand dog\ncats and dog\n" },
    { input: "pineapplepenapple\napple pen applepen pine pineapple\n", expectedOutput: "pine apple pen apple\npineapple pen apple\npine applepen apple\n" },
  ],
  hiddenTests: [
    { input: "aaaa\na aa aaa\n", expectedOutput: "a a a a\naa aa\na aa a\naaa a\n" },
    { input: "abc\nab a bc\n", expectedOutput: "ab c\n" },
    { input: "leetcode\nleet code\n", expectedOutput: "leet code\n" },
  ],
},
{
  title: "Maximum Subarray Sum with One Deletion",
  difficulty: "Hard",
  accessType: ProblemAccess.PRIVATE,
  description:
    "Find the maximum subarray sum where you are allowed to delete at most one element.",
  inputFormat: "First line: integer N\nSecond line: N integers.",
  outputFormat: "Print the maximum achievable sum.",
  constraints: "1 ≤ N ≤ 2×10^5",
  additionalInfo: "Use DP: Track with and without delete status.",
  visibleTests: [
    { input: "6\n1 -2 0 3 5 -1\n", expectedOutput: "9\n" },
    { input: "3\n-1 -1 -1\n", expectedOutput: "-1\n" },
  ],
  hiddenTests: [
    { input: "5\n1 2 3 4 5\n", expectedOutput: "15\n" },
    { input: "5\n1 -2 3 -2 5\n", expectedOutput: "8\n" },
    { input: "1\n-5\n", expectedOutput: "-5\n" },
    { input: "4\n-2 1 -3 2\n", expectedOutput: "2\n" },
  ],
},
{
  title: "Min Cost to Cut a Stick",
  difficulty: "Hard",
  accessType: ProblemAccess.PRIVATE,
  description:
    "Given a stick of length n and an array of cuts, return the minimum cost to cut the stick. Cost of each cut is the current length of the stick being cut.",
  inputFormat: "First line: integer n\nSecond line: integer k\nThird line: k cuts.",
  outputFormat: "Print minimum possible cost.",
  constraints: "1 ≤ n ≤ 10^6, 1 ≤ k ≤ 100",
  additionalInfo: "Classic interval DP.",
  visibleTests: [
    { input: "7\n3\n1 3 4\n", expectedOutput: "16\n" },
    { input: "9\n2\n5 6\n", expectedOutput: "5\n" },
  ],
  hiddenTests: [
    { input: "10\n3\n2 4 7\n", expectedOutput: "20\n" },
    { input: "15\n2\n3 14\n", expectedOutput: "15\n" },
    { input: "20\n4\n2 8 10 14\n", expectedOutput: "46\n" },
  ],
},
{
  title: "Russian Doll Envelopes",
  difficulty: "Hard",
  accessType: ProblemAccess.PRIVATE,
  description:
    "Given a list of envelopes, find the maximum number you can nest. Envelope A must have both width and height smaller than B.",
  inputFormat: "First line: n\nNext n lines: width height",
  outputFormat: "Print max nested envelopes.",
  constraints: "1 ≤ n ≤ 10^5",
  additionalInfo: "Sort + LIS on heights.",
  visibleTests: [
    { input: "4\n5 4\n6 4\n6 7\n2 3\n", expectedOutput: "3\n" },
    { input: "3\n1 1\n1 1\n1 1\n", expectedOutput: "1\n" },
  ],
  hiddenTests: [
    { input: "1\n2 2\n", expectedOutput: "1\n" },
    { input: "5\n1 3\n2 4\n3 5\n4 6\n5 7\n", expectedOutput: "5\n" },
    { input: "5\n5 4\n6 10\n8 9\n7 8\n3 2\n", expectedOutput: "4\n" },
  ],
},{
  title: "Count Vowels",
  difficulty: "Easy",
  accessType: ProblemAccess.PRIVATE,
  description:
    "Given a lowercase string s, return the number of vowels (a, e, i, o, u) in the string.",
  inputFormat: "Single line: string s",
  outputFormat: "Print an integer denoting the number of vowels.",
  constraints: "1 ≤ |s| ≤ 10^5",
  additionalInfo: "Traverse and count vowels.",
  visibleTests: [
    { input: "hello\n", expectedOutput: "2\n" },
    { input: "abc\n", expectedOutput: "1\n" },
  ],
  hiddenTests: [
    { input: "aeiou\n", expectedOutput: "5\n" },
    { input: "zzzzz\n", expectedOutput: "0\n" },
    { input: "banana\n", expectedOutput: "3\n" },
    { input: "leetcode\n", expectedOutput: "4\n" },
  ],
},
{
  title: "Sum of Array",
  difficulty: "Easy",
  accessType: ProblemAccess.PRIVATE,
  description:
    "Given an array of integers, return the sum of all elements.",
  inputFormat: "First line: integer N\nSecond line: N integers",
  outputFormat: "Print the sum of the array.",
  constraints: "1 ≤ N ≤ 10^5, -10^9 ≤ nums[i] ≤ 10^9",
  additionalInfo: "Just accumulate.",
  visibleTests: [
    { input: "5\n1 2 3 4 5\n", expectedOutput: "15\n" },
    { input: "3\n-1 -2 -3\n", expectedOutput: "-6\n" },
  ],
  hiddenTests: [
    { input: "1\n10\n", expectedOutput: "10\n" },
    { input: "4\n0 0 0 0\n", expectedOutput: "0\n" },
    { input: "3\n100 200 300\n", expectedOutput: "600\n" },
    { input: "6\n1 -1 2 -2 3 -3\n", expectedOutput: "0\n" },
  ],
},
{
  title: "Check Palindrome",
  difficulty: "Easy",
  accessType: ProblemAccess.PRIVATE,
  description:
    "Given a string s, return YES if it is a palindrome; otherwise return NO.",
  inputFormat: "Single line: string s",
  outputFormat: "YES or NO",
  constraints: "1 ≤ |s| ≤ 10^5",
  additionalInfo: "Two-pointer or reverse string.",
  visibleTests: [
    { input: "racecar\n", expectedOutput: "YES\n" },
    { input: "hello\n", expectedOutput: "NO\n" },
  ],
  hiddenTests: [
    { input: "a\n", expectedOutput: "YES\n" },
    { input: "abba\n", expectedOutput: "YES\n" },
    { input: "abcd\n", expectedOutput: "NO\n" },
    { input: "madam\n", expectedOutput: "YES\n" },
  ],
},

];
//#endregion

async function seed() {
  console.log("🔌 Connecting to DB...", CONFIG.db.host);
  const connection = await mysql.createConnection(CONFIG.db);

  try {
    const [organizerRows] = await connection.execute(
      "SELECT id, username, email FROM users WHERE email = ? LIMIT 1",
      [CONFIG.organIZER_EMAIL || CONFIG.organizerEmail]
    );

    const organizer = organizerRows[0];
    if (!organizer) {
      throw new Error(`Organizer (email: ${CONFIG.organizerEmail}) not found. Create the user first.`);
    }
    console.log(`👤 Using organizer: ${organizer.username} (${organizer.email})`);

    for (const p of problems) {
      const [existingRows] = await connection.execute(
        "SELECT id FROM problems WHERE title = ? LIMIT 1",
        [p.title]
      );

      if (existingRows.length) {
        console.log(`ℹ️ Problem already exists, skipping: ${p.title}`);
        continue;
      }

      const problemId = randomUUID();

      await connection.execute(
        `INSERT INTO problems
          (id, title, description, difficulty, constraints, inputFormat, outputFormat, additionalInfo, accessType, createdById)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
        [
          problemId,
          p.title,
          p.description,
          p.difficulty,
          p.constraints,
          p.inputFormat,
          p.outputFormat,
          p.additionalInfo,
          p.accessType,
          organizer.id,
        ]
      );

      console.log(`✅ Inserted problem: ${p.title}`);

      const visible = p.visibleTests.map((t) => ({ ...t, isHidden: 0 }));
      const hidden = p.hiddenTests.map((t) => ({ ...t, isHidden: 1 }));

      for (const tc of [...visible, ...hidden]) {
        await connection.execute(
          `INSERT INTO testcases (id, input, expectedOutput, isHidden, problemId)
           VALUES (?, ?, ?, ?, ?)` ,
          [randomUUID(), tc.input, tc.expectedOutput, tc.isHidden, problemId]
        );
      }
    }

    console.log("🎯 All problems seeded successfully!");
  } catch (err) {
    console.error("❌ Seed error:", err.message || err);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

seed();
