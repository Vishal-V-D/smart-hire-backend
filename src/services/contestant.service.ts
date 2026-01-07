import { AppDataSource } from "../config/db";
import { Assessment } from "../entities/Assessment.entity";
import { AssessmentSection } from "../entities/AssessmentSection.entity";
import { Question } from "../entities/Question.entity";
import { AssessmentInvitation, InvitationStatus } from "../entities/AssessmentInvitation.entity";
import { SectionProblem } from "../entities/SectionProblem.entity";
import { Problem } from "../entities/problem.entity";

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
            "sections.problems.problem" // Load the actual coding problem details
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
        console.log(`   🔎 Section 1 Preview: ${s.questions?.length} questions, ${s.problems?.length} coding problems`);
        if (s.problems?.length > 0) {
            console.log(`      Example Problem ID: ${s.problems[0].problem?.id}`);
            console.log(`      Example Problem Title: ${s.problems[0].problem?.title}`);
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
        relations: ["questions", "problems", "problems.problem"],
    });

    if (!section) {
        throw { status: 404, message: "Section not found" };
    }

    // Get raw questions (remove correctAnswer field)
    const rawQuestions = section.questions.map((q) => {
        const { correctAnswer, ...questionWithoutAnswer } = q as any;
        return questionWithoutAnswer;
    });

    // Get coding problems - Extract from SectionProblem joint entity
    // Sanitize: Remove solutions and hidden testcases, send everything else
    const problems = section.problems?.map((sp) => {
        const problem = sp.problem;
        if (!problem) return null;

        // Destructure to remove sensitive fields, keep everything else
        const {
            solutions,
            hiddenTestcases,
            createdBy,  // Don't send creator details
            ...safeProblemData
        } = problem as any;

        // Return sanitized problem with section-specific data
        return {
            ...safeProblemData,
            marks: sp.marks || 10, // Default to 10 if not set
            sectionProblemId: sp.id // Send the link ID too
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
                        sectionProblemId: `recovered-${orphan.id}` // Placeholder ID
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
    console.log(`--------------------------------------------------\n`);

    return {
        questions: validQuestions,
        problems,
    };
};
