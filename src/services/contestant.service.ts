import { AppDataSource } from "../config/db";
import { Assessment } from "../entities/Assessment.entity";
import { AssessmentSection } from "../entities/AssessmentSection.entity";
import { Question } from "../entities/Question.entity";
import { AssessmentInvitation, InvitationStatus } from "../entities/AssessmentInvitation.entity";
import { SectionProblem } from "../entities/SectionProblem.entity";
import { Problem } from "../entities/problem.entity";
import { getFilteredTestCases } from "./sectionProblem.service";

const assessmentRepo = () => AppDataSource.getRepository(Assessment);
const sectionRepo = () => AppDataSource.getRepository(AssessmentSection);
const invitationRepo = () => AppDataSource.getRepository(AssessmentInvitation);
const sectionProblemRepo = () => AppDataSource.getRepository(SectionProblem);
const problemRepo = () => AppDataSource.getRepository(Problem);

/**
 * Get assessments user is invited to
 */
export const getMyAssessments = async (userId: string) => {
    console.log(`\n📋 [CONTESTANT] Getting assessments for user: ${userId}`);

    const invitations = await invitationRepo().find({
        where: { user: { id: userId }, status: InvitationStatus.ACCEPTED },
        relations: ["assessment"],
        order: { createdAt: "DESC" },
    });

    const assessments = invitations.map((inv) => inv.assessment);

    console.log(`   Found ${assessments.length} assessments`);

    return assessments;
};

/**
 * Get assessment details for contestant (with access check)
 */
export const getAssessmentForContestant = async (assessmentId: string, userId: string) => {
    console.log(`\n🔍 [CONTESTANT] Getting assessment ${assessmentId} for user ${userId}`);

    // Check invitation
    const invitation = await invitationRepo().findOne({
        where: {
            assessment: { id: assessmentId },
            user: { id: userId },
            status: InvitationStatus.ACCEPTED,
        },
    });

    if (!invitation) {
        console.log(`   ❌ Access denied - no valid invitation`);
        throw { status: 403, message: "Access denied. You don't have permission to view this assessment." };
    }

    // Get assessment with sections AND nested questions/problems for preview
    const assessment = await assessmentRepo().findOne({
        where: { id: assessmentId },
        relations: [
            "sections",
            "sections.questions",
            "sections.problems",
            "sections.problems.problem", // Load the actual coding problem details
            "sections.sqlQuestions" // ✅ Load SQL questions
        ],
    });

    if (!assessment) {
        throw { status: 404, message: "Assessment not found" };
    }

    // Sanitize assessment details (remove sensitive data if any)
    if (assessment.sections) {
        assessment.sections.forEach(section => {
            if (section.questions) {
                // Remove correct answers from preview
                section.questions.forEach((q: any) => delete q.correctAnswer);
            }
        });
    }

    console.log(`   ✅ Access granted. Loaded ${assessment.sections?.length || 0} sections.`);
    console.log(`   🛡️ Proctoring Settings:`);
    console.log(`      - Enabled: ${assessment.proctoring?.enabled}`);
    console.log(`      - Fullscreen: ${assessment.proctoring?.fullscreen}`);
    console.log(`      - Camera: ${assessment.proctoring?.imageMonitoring || assessment.proctoring?.videoMonitoring}`);
    console.log(`      - Mic: ${assessment.proctoring?.audioMonitoring || assessment.proctoring?.audioRecording}`);
    console.log(`      - Screen Share: ${assessment.proctoring?.screenMonitoring || assessment.proctoring?.screenRecording}`);

    if (assessment.sections?.length > 0) {
        const s = assessment.sections[0];
        console.log(`   🔎 Section 1 Preview: ${s.questions?.length} questions, ${s.problems?.length} coding problems, ${s.sqlQuestions?.length || 0} SQL questions`);
        if (s.problems?.length > 0) {
            console.log(`      Example Problem ID: ${s.problems[0].problem?.id}`);
            console.log(`      Example Problem Title: ${s.problems[0].problem?.title}`);
        }

        // 📊 Print SQL Questions Summary Table for all sections
        const allSqlQuestions = assessment.sections.flatMap(section => section.sqlQuestions || []);
        if (allSqlQuestions.length > 0) {
            const sqlTable = allSqlQuestions.map((sqlQ, idx) => ({
                '#': idx + 1,
                'Title': sqlQ.title?.substring(0, 45) + '...',
                'Difficulty': sqlQ.difficulty,
                'Marks': sqlQ.marks || 'N/A',
                'Time': sqlQ.timeLimit ? `${sqlQ.timeLimit}m` : 'N/A',
                'Topic': sqlQ.topic?.substring(0, 20) || 'N/A'
            }));

            console.log(`\n🗄️  SQL QUESTIONS IN THIS ASSESSMENT:`);
            console.table(sqlTable);
            console.log(`   📊 Total SQL Questions: ${allSqlQuestions.length}`);
            console.log(`   💯 Total Marks: ${allSqlQuestions.reduce((sum, q) => sum + (q.marks || 0), 0)}`);
            console.log(`   ⏱️  Total Time: ${allSqlQuestions.reduce((sum, q) => sum + (q.timeLimit || 0), 0)} minutes\n`);
        }
    }

    return {
        ...assessment,
        proctoringSettings: assessment.proctoring,
        navigationSettings: {
            allowPreviousNavigation: assessment.allowPreviousNavigation,
            allowMarkForReview: assessment.allowMarkForReview,
        }
    };
};

/**
 * Get sections for assessment
 */
export const getSectionsForContestant = async (assessmentId: string, userId: string) => {
    console.log(`\n📑 [CONTESTANT] Getting sections for assessment ${assessmentId}`);

    // Verify access
    await getAssessmentForContestant(assessmentId, userId);

    const sections = await sectionRepo().find({
        where: { assessment: { id: assessmentId } },
        order: { order: "ASC" },
    });

    console.log(`   Found ${sections.length} sections`);

    return sections;
};

/**
 * Get questions for a section (WITHOUT answers!)
 */
export const getQuestionsForSection = async (
    sectionId: string,
    assessmentId: string,
    userId: string
) => {
    console.log(`\n❓ [CONTESTANT] Getting questions for section ${sectionId}`);

    // Verify access
    await getAssessmentForContestant(assessmentId, userId);

    const section = await sectionRepo().findOne({
        where: { id: sectionId },
        relations: ["questions", "problems", "problems.problem", "sqlQuestions"],
    });

    if (!section) {
        throw { status: 404, message: "Section not found" };
    }

    // Get raw questions (remove correctAnswer field)
    const rawQuestions = section.questions.map((q) => {
        const { correctAnswer, ...questionWithoutAnswer } = q as any;

        // 🔍 DEBUG: Log what we're sending
        console.log(`   📝 Question ${q.id.slice(0, 8)}: pseudocode=${q.pseudocode ? 'YES' : 'NO'}, type=${q.type}`);

        return questionWithoutAnswer;
    });

    // Get coding problems - Extract from SectionProblem joint entity
    // 🎯 Apply assessment-specific test case filtering
    // Sanitize: Remove solutions and hidden testcases, send everything else
    const problems = section.problems?.map((sp) => {
        const problem = sp.problem;
        if (!problem) return null;

        // 🎯 Apply test case filtering based on assessment configuration
        const { exampleTestcases, hiddenTestcases } = getFilteredTestCases(
            problem,
            sp.testCaseConfig
        );

        const originalExampleCount = problem.exampleTestcases?.length || 0;
        const originalHiddenCount = problem.hiddenTestcases?.length || 0;
        const filteredExampleCount = exampleTestcases.length;
        const filteredHiddenCount = hiddenTestcases.length;

        // 🔍 Detailed logging for debugging
        if (sp.testCaseConfig) {
            console.log(`   🎯 [PARTIAL] Problem "${problem.title}"`);
            console.log(`      Example: ${filteredExampleCount}/${originalExampleCount} cases (${Math.round(filteredExampleCount / originalExampleCount * 100)}%)`);
            console.log(`      Hidden: ${filteredHiddenCount}/${originalHiddenCount} cases (${Math.round(filteredHiddenCount / originalHiddenCount * 100)}%)`);
            console.log(`      Config:`, JSON.stringify(sp.testCaseConfig));
        } else {
            console.log(`   📋 [FULL] Problem "${problem.title}"`);
            console.log(`      Example: ${originalExampleCount} cases (100%)`);
            console.log(`      Hidden: ${originalHiddenCount} cases (100%)`);
            console.log(`      Config: null (using all test cases)`);
        }

        // Destructure to remove sensitive fields, keep everything else
        const {
            solutions,
            hiddenTestcases: _hiddenOriginal,  // Remove original hidden test cases
            createdBy,  // Don't send creator details
            ...safeProblemData
        } = problem as any;

        // Return sanitized problem with FILTERED test cases
        return {
            ...safeProblemData,
            exampleTestcases: exampleTestcases,  // 🎯 Filtered example test cases
            // hiddenTestcases are NEVER sent to frontend for security
            totalExampleTestCases: filteredExampleCount, // 🎯 Explicitly send count
            totalHiddenTestCases: filteredHiddenCount,   // 🎯 Explicitly send count
            marks: sp.marks || 10, // Default to 10 if not set
            sectionProblemId: sp.id // Send the link ID for submission
        };
    }).filter((p): p is NonNullable<typeof p> => !!p) || [];

    // --- FIX: HANDLE ORPHAN CODING QUESTIONS ---
    // Separate actual MCQs from Coding Questions that were wrongly added to the 'questions' table
    const validQuestions: any[] = [];
    const orphanCodingQuestions: any[] = [];

    for (const q of rawQuestions) {
        if (q.type === 'coding') {
            orphanCodingQuestions.push(q);
        } else {
            validQuestions.push(q);
        }
    }

    // Attempt to recover orphan coding questions by finding their Problem entity
    if (orphanCodingQuestions.length > 0) {
        console.log(`⚠️ [FIX] Found ${orphanCodingQuestions.length} orphan coding question(s) in 'questions' table.`);

        for (const orphan of orphanCodingQuestions) {
            // Check if this problem is already in the 'problems' list (linked via SectionProblem)
            // Match by Title is the best heuristic we have
            const alreadyLinked = problems.some(p => p.title === orphan.text);

            if (!alreadyLinked) {
                console.log(`   🔍 Attempting to find matching Problem entity for: "${orphan.text}"`);
                const foundProblem = await problemRepo().findOne({
                    where: { title: orphan.text }
                });

                if (foundProblem) {
                    console.log(`   ✅ MATCHED! promoting orphan question to Problem ID: ${foundProblem.id}`);
                    // Sanitize: Remove sensitive fields
                    const { solutions, hiddenTestcases, createdBy, ...safeProblemData } = foundProblem as any;
                    // Add to problems list with synthesized linking info
                    problems.push({
                        ...safeProblemData,
                        marks: orphan.marks || section.marksPerQuestion || 10,
                        sectionProblemId: `recovered-${orphan.id}`, // Placeholder ID
                        totalExampleTestCases: safeProblemData.exampleTestcases?.length || 0, // 🎯 Explicitly send count
                        totalHiddenTestCases: hiddenTestcases?.length || 0 // 🎯 Explicitly send count
                    });
                } else {
                    console.warn(`   ❌ FAILED. Could not find matching Problem entity for: "${orphan.text}". Keeping as raw question.`);
                    // Fallback: If we can't find the real problem, keep it in validQuestions
                    // so the user sees *something* instead of it disappearing.
                    validQuestions.push(orphan);
                }
            } else {
                console.log(`   ℹ️ Orphan question "${orphan.text}" is already linked via SectionProblem. Ignoring orphan copy.`);
            }
        }
    }

    console.log(`   Returning ${validQuestions.length} valid questions (MCQ/etc)`);
    console.log(`   Returning ${problems.length} coding problems (Linked + Recovered)`);

    // --- DEBUG LOGS: FULL DATA BEING SENT TO FRONTEND ---
    console.log(`\n📤 [CONTESTANT] Sending to Frontend:`);
    console.log(`   Questions: ${validQuestions.length}`);
    console.log(`   Problems: ${problems.length}`);

    if (problems.length > 0) {
        problems.forEach((p, idx) => {
            console.log(`\n   💻 [PROBLEM ${idx + 1}] FULL DATA BEING SENT:`);
            console.log(JSON.stringify(p, null, 2));
        });
    }

    // 🔍 DEBUG: Log each question's full data
    if (validQuestions.length > 0) {
        validQuestions.forEach((q, idx) => {
            console.log(`\n   📝 [QUESTION ${idx + 1}] FULL DATA:`);
            console.log(`      ID: ${q.id}`);
            console.log(`      Type: ${q.type}`);
            console.log(`      Text: ${q.text?.substring(0, 50)}...`);
            console.log(`      Pseudocode: ${q.pseudocode ? 'YES (' + q.pseudocode.substring(0, 30) + '...)' : 'NO (null)'}`);
            console.log(`      Division: ${q.division || 'null'}`);
            console.log(`      Subdivision: ${q.subdivision || 'null'}`);
            console.log(`      Topic: ${q.topic || 'null'}`);
            console.log(`      Options: ${q.options?.length || 0}`);
            console.log(`      Marks: ${q.marks}`);
        });
    }
    console.log(`--------------------------------------------------\n`);

    // Get SQL questions (sanitize - remove expected answers)
    const sqlQuestions = section.sqlQuestions?.map((sqlQ) => {
        const { expectedQuery, ...safeSqlData } = sqlQ as any;
        return safeSqlData;
    }) || [];

    console.log(`   Returning ${sqlQuestions.length} SQL questions`);

    // 📊 Print SQL Questions Summary Table
    if (sqlQuestions.length > 0) {
        const sqlTable = sqlQuestions.map((sqlQ, idx) => ({
            '#': idx + 1,
            'Title': sqlQ.title?.substring(0, 50) + '...',
            'Difficulty': sqlQ.difficulty,
            'Marks': sqlQ.marks || 'N/A',
            'Time Limit': sqlQ.timeLimit ? `${sqlQ.timeLimit}m` : 'N/A',
            'Topic': sqlQ.topic || 'N/A'
        }));

        console.log(`\n🗄️  SQL QUESTIONS SUMMARY:`);
        console.table(sqlTable);
        console.log(`   Total SQL Questions: ${sqlQuestions.length}`);
        console.log(`   Total Marks: ${sqlQuestions.reduce((sum, q) => sum + (q.marks || 0), 0)}`);
        console.log(`   Total Time: ${sqlQuestions.reduce((sum, q) => sum + (q.timeLimit || 0), 0)} minutes\n`);
    }

    return {
        questions: validQuestions,
        problems,
        sqlQuestions, // ✅ Add SQL questions to response
    };
};
