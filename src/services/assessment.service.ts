import { AppDataSource } from "../config/db";
import { Brackets } from "typeorm";
import { Assessment, AssessmentStatus, TimeMode } from "../entities/Assessment.entity";
import { AssessmentSection } from "../entities/AssessmentSection.entity";
import { Question } from "../entities/Question.entity";
import { User, UserRole } from "../entities/user.entity";
import { Problem } from "../entities/problem.entity";
import { Company, CompanyStatus } from "../entities/Company.entity";
import { SectionProblem } from "../entities/SectionProblem.entity";

const repo = () => AppDataSource.getRepository(Assessment);
const userRepo = () => AppDataSource.getRepository(User);
const sectionRepo = () => AppDataSource.getRepository(AssessmentSection);

/**
 * Check if assessment has ended and update status to COMPLETED
 * This is called on-the-fly when accessing assessment data
 */
const checkAndUpdateAssessmentStatus = async (assessment: Assessment): Promise<Assessment> => {
    // If assessment has an end date and it's in PUBLISHED or ACTIVE status
    if (
        assessment.endDate &&
        new Date() > new Date(assessment.endDate) &&
        (assessment.status === AssessmentStatus.PUBLISHED || assessment.status === AssessmentStatus.ACTIVE)
    ) {
        assessment.status = AssessmentStatus.COMPLETED;
        await repo().save(assessment);
        console.log(`⏰ [ASSESSMENT] Assessment ${assessment.id} auto-marked as COMPLETED (end time passed)`);
    }
    return assessment;
};

// ✅ Create a new assessment (draft) with optional nested sections and questions
export const createAssessment = async (data: any, organizerId: string): Promise<any> => {
    // Create a query runner for transaction
    const queryRunner = AppDataSource.createQueryRunner();

    // Connect and start transaction
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        // Validate organizer/creator exists
        const user = await queryRunner.manager.findOne(User, {
            where: { id: organizerId },
            relations: ["company"] // Fetch company if they are an admin
        });

        if (!user) {
            throw { status: 404, message: "User not found" };
        }

        let company: Company | undefined;

        // 🛡️ PERMISSION CHECK FOR COMPANY ADMINS
        if (user.role === UserRole.ADMIN) {
            if (!user.company) {
                throw { status: 403, message: "User not associated with a company" };
            }
            if (user.company.status !== CompanyStatus.APPROVED) {
                throw { status: 403, message: "Company not approved" };
            }

            // Check specific permission
            if (!user.company.permissions?.createAssessment) {
                throw { status: 403, message: "Your company does not have permission to create assessments. Please contact the organizer." };
            }

            company = user.company; // Link assessment to this company
            console.log(`[CREATE_ASSESSMENT] Authorized Company Admin: ${user.email} (${company.name})`);
        } else if (user.role !== UserRole.ORGANIZER) {
            // Only Organizers and authorized Admins can create
            throw { status: 403, message: "Unauthorized role" };
        }

        // Validate title
        if (!data.title || data.title.length < 5 || data.title.length > 200) {
            throw { status: 400, message: "Title must be between 5 and 200 characters" };
        }

        // Validate description
        if (data.description && data.description.length > 2000) {
            throw { status: 400, message: "Description must not exceed 2000 characters" };
        }

        // Validate dates
        if (data.startDate && data.endDate) {
            const start = new Date(data.startDate);
            const end = new Date(data.endDate);
            if (end <= start) {
                throw { status: 400, message: "End date must be after start date" };
            }
        }

        // Validate globalTime if timeMode is 'global'
        if (data.timeMode === TimeMode.GLOBAL && (!data.globalTime || data.globalTime <= 0)) {
            throw { status: 400, message: "Global time is required when time mode is 'global'" };
        }

        // Validate proctoring settings
        if (data.proctoringSettings?.tabSwitchLimit !== undefined) {
            if (data.proctoringSettings.tabSwitchLimit < 0 || data.proctoringSettings.tabSwitchLimit > 10) {
                throw { status: 400, message: "Tab switch limit must be between 0 and 10" };
            }
        }

        // Validate pass percentage
        if (data.passPercentage !== undefined) {
            if (typeof data.passPercentage !== 'number' || data.passPercentage < 0 || data.passPercentage > 100) {
                throw { status: 400, message: "Pass percentage must be a number between 0 and 100" };
            }
        }

        console.log(`[CREATE_ASSESSMENT] Creating assessment: ${data.title}`);

        // Create assessment entity
        const assessment = queryRunner.manager.create(Assessment, {
            title: data.title,
            description: data.description,
            startDate: data.startDate,
            endDate: data.endDate,
            duration: data.duration,
            timeMode: data.timeMode || TimeMode.GLOBAL,
            globalTime: data.globalTime,
            passPercentage: data.passPercentage || 40,
            proctoring: data.proctoringSettings || { enabled: false },

            organizer: user, // The user who created (User entity)
            company: company || undefined, // The company (if applicable)
            status: AssessmentStatus.DRAFT,
            totalMarks: 0,
            totalQuestions: 0,
        });

        await queryRunner.manager.save(assessment);
        console.log(`✅ Assessment created: ${assessment.id}`);

        let totalQuestions = 0;
        let totalMarks = 0;
        let sectionCount = 0;
        let totalSqlQuestions = 0; // Track SQL questions separately

        // ⭐ Track section-wise data for console table and for timer logic
        const sectionData_table: Array<{
            Section: string;
            Questions: number;
            "Marks/Q": number;
            Total: number;
            Time: string;
            timeLimit?: number;
        }> = [];

        // Create sections and questions if provided
        if (data.sections && Array.isArray(data.sections) && data.sections.length > 0) {
            console.log(`[CREATE_ASSESSMENT] Creating ${data.sections.length} sections...`);

            for (const sectionData of data.sections) {
                // Validate section data
                if (!sectionData.title || sectionData.title.length < 2 || sectionData.title.length > 100) {
                    throw { status: 400, message: "Section title must be between 2 and 100 characters" };
                }

                // Create section
                const section = queryRunner.manager.create(AssessmentSection, {
                    assessment: assessment,
                    type: sectionData.type || "technical",
                    title: sectionData.title,
                    description: sectionData.description,
                    emoji: sectionData.emoji,
                    questionCount: sectionData.questionCount || 0,
                    marksPerQuestion: sectionData.marksPerQuestion || 1,
                    timeLimit: sectionData.timeLimit,
                    negativeMarking: sectionData.negativeMarking || 0,
                    difficulty: sectionData.difficulty || "Medium",
                    enabledPatterns: sectionData.enabledPatterns || [],
                    themeColor: sectionData.themeColor || "blue",
                    order: sectionData.orderIndex !== undefined ? sectionData.orderIndex : sectionCount,
                });

                await queryRunner.manager.save(section);
                console.log(`  ✅ Section created: ${section.title} (order: ${section.order})`);
                sectionCount++;

                let sectionTotalMarks = 0; // Track marks for this section
                let sectionQuestionCount = 0;
                const marksPerQuestion = sectionData.marksPerQuestion || 1; // ⭐ Get marks/q config

                // Create questions for this section if provided
                if (sectionData.questions && Array.isArray(sectionData.questions) && sectionData.questions.length > 0) {
                    console.log(`  [CREATE_QUESTIONS] Creating ${sectionData.questions.length} questions...`);

                    for (const questionData of sectionData.questions) {
                        // Validate type first (needed before other checks)
                        if (!questionData.type) {
                            throw { status: 400, message: "Question type is required" };
                        }

                        // Validate question data - text required for non-coding questions only
                        if (questionData.type !== 'coding' && (!questionData.text || questionData.text.length < 5)) {
                            throw { status: 400, message: "Question text must be at least 5 characters" };
                        }

                        // Validate question type
                        const validTypes = ["single_choice", "multiple_choice", "fill_in_the_blank", "coding"];
                        if (!validTypes.includes(questionData.type)) {
                            throw { status: 400, message: `Invalid question type: ${questionData.type}` };
                        }

                        // Validate options for choice questions
                        if ((questionData.type === "single_choice" || questionData.type === "multiple_choice")) {
                            if (!questionData.options || !Array.isArray(questionData.options) || questionData.options.length < 2) {
                                throw { status: 400, message: "Choice questions must have at least 2 options" };
                            }
                        }

                        // HANDLE CODING QUESTIONS - LINK TO EXISTING PROBLEM
                        if (questionData.type === 'coding') {
                            // Expect problemId from frontend - this is the ID of the existing Problem entity
                            if (!questionData.problemId) {
                                console.error(`    ❌ [CREATE] Coding question missing 'problemId'. Cannot link.`);
                                throw { status: 400, message: "Coding questions must include 'problemId' to link to an existing problem." };
                            }

                            console.log(`    ⚠️ [CREATE] Detected CODING question. Linking to existing Problem ID: ${questionData.problemId}`);

                            // Fetch the existing problem to verify it exists
                            const existingProblem = await queryRunner.manager.findOne(Problem, {
                                where: { id: questionData.problemId }
                            });

                            if (!existingProblem) {
                                console.error(`    ❌ [CREATE] Problem not found with ID: ${questionData.problemId}`);
                                throw { status: 404, message: `Problem with ID ${questionData.problemId} not found.` };
                            }

                            console.log(`    ✅ Found existing Problem: "${existingProblem.title}" (ID: ${existingProblem.id})`);

                            // Create SectionProblem link to the EXISTING problem
                            // 🎯 Capture test case config if provided
                            const testCaseConfig = questionData.testCaseConfig || null;

                            const sectionProblem = queryRunner.manager.create(SectionProblem, {
                                section: section,
                                problem: existingProblem,
                                marks: questionData.marks || sectionData.marksPerQuestion || 10,
                                order: questionData.orderIndex !== undefined ? questionData.orderIndex : totalQuestions,
                                testCaseConfig: testCaseConfig // Save config
                            });

                            const savedSectionProblem = await queryRunner.manager.save(sectionProblem) as unknown as SectionProblem;
                            console.log(`    🔗 Linked Problem to Section via SectionProblem: ${savedSectionProblem.id}`);

                            // 🔍 LOG TEST CASE CONFIG DETAILS FOR USER
                            if (testCaseConfig) {
                                console.log(`       ⚙️ Test Case Config:`);
                                if (testCaseConfig.exampleRange) {
                                    console.log(`          Example Range: [${testCaseConfig.exampleRange.start}, ${testCaseConfig.exampleRange.end}]`);
                                } else if (testCaseConfig.exampleIndices) {
                                    console.log(`          Example Indices: [${testCaseConfig.exampleIndices.join(', ')}]`);
                                } else {
                                    console.log(`          Example: ALL`);
                                }

                                if (testCaseConfig.hiddenRange) {
                                    console.log(`          Hidden Range: [${testCaseConfig.hiddenRange.start}, ${testCaseConfig.hiddenRange.end}]`);
                                } else if (testCaseConfig.hiddenIndices) {
                                    console.log(`          Hidden Indices: [${testCaseConfig.hiddenIndices.join(', ')}]`);
                                } else {
                                    console.log(`          Hidden: ALL`);
                                }
                            } else {
                                console.log(`       ⚙️ Test Case Config: Using ALL test cases (Default)`);
                            }

                            totalQuestions++;
                            sectionQuestionCount++;
                            totalMarks += savedSectionProblem.marks || 0;
                            sectionTotalMarks += savedSectionProblem.marks || 0;

                        } else {
                            // HANDLE STANDARD QUESTIONS (MCQ, Fill-blank)

                            // 🔍 DEBUG: Log what we're receiving from frontend
                            console.log(`    📝 [CREATE_QUESTION] Received from frontend:`);
                            console.log(`       Text: ${questionData.text?.substring(0, 50)}...`);
                            console.log(`       Type: ${questionData.type}`);
                            console.log(`       Pseudocode: ${questionData.pseudocode ? 'YES (' + questionData.pseudocode.substring(0, 30) + '...)' : 'NO (undefined/null)'}`);
                            console.log(`       Division: ${questionData.division || 'undefined'}`);
                            console.log(`       Subdivision: ${questionData.subdivision || 'undefined'}`);
                            console.log(`       Topic: ${questionData.topic || 'undefined'}`);

                            const question = queryRunner.manager.create(Question, {
                                section: section,
                                text: questionData.text,
                                image: questionData.image,
                                type: questionData.type,
                                options: questionData.options,
                                correctAnswer: questionData.correctAnswer,
                                explanation: questionData.explanation,
                                pseudocode: questionData.pseudocode, // ✅ Include pseudocode
                                codeStub: questionData.codeStub,
                                marks: questionData.marks || sectionData.marksPerQuestion || 1,
                                order: questionData.orderIndex !== undefined ? questionData.orderIndex : totalQuestions,
                                tags: questionData.tags,
                                topic: questionData.topic,
                                division: questionData.division,
                                subdivision: questionData.subdivision,
                                difficulty: questionData.difficulty,
                            });

                            await queryRunner.manager.save(question);
                            console.log(`    ✅ Question created (order: ${question.order}, marks: ${question.marks})`);
                            console.log(`       Saved pseudocode: ${question.pseudocode ? 'YES' : 'NO'}`);

                            totalQuestions++;
                            sectionQuestionCount++;
                            totalMarks += question.marks || 0;
                            sectionTotalMarks += question.marks || 0; // Accumulate section marks
                        }
                    }
                }

                // ⭐ HANDLE CODING PROBLEMS (if sent as 'problems' array instead of mixed in 'questions')
                if (sectionData.problems && Array.isArray(sectionData.problems) && sectionData.problems.length > 0) {
                    console.log(`  [CREATE_PROBLEMS] Linking ${sectionData.problems.length} coding problems...`);

                    for (const problemData of sectionData.problems) {
                        // Expect problemId from frontend
                        const problemId = problemData.problemId || problemData.id || problemData.problem?.id;

                        if (!problemId) {
                            console.error(`    ❌ [CREATE] Coding problem missing 'problemId' or 'id'. Cannot link.`);
                            throw { status: 400, message: "Coding problems must include 'problemId' or 'id' to link to an existing problem." };
                        }

                        console.log(`    ⚠️ [CREATE] Detected Coding Problem. Linking to existing Problem ID: ${problemId}`);

                        const existingProblem = await queryRunner.manager.findOne(Problem, {
                            where: { id: problemId }
                        });

                        if (!existingProblem) {
                            throw { status: 404, message: `Problem with ID ${problemId} not found.` };
                        }

                        console.log(`    ✅ Found existing Problem: "${existingProblem.title}" (ID: ${existingProblem.id})`);

                        const testCaseConfig = problemData.testCaseConfig || null;

                        const sectionProblem = queryRunner.manager.create(SectionProblem, {
                            section: section,
                            problem: existingProblem,
                            marks: problemData.marks || sectionData.marksPerQuestion || 10,
                            order: problemData.orderIndex !== undefined ? problemData.orderIndex : totalQuestions,
                            testCaseConfig: testCaseConfig
                        });

                        const savedSectionProblem = await queryRunner.manager.save(sectionProblem) as unknown as SectionProblem;
                        console.log(`    🔗 Linked Problem to Section via SectionProblem: ${savedSectionProblem.id}`);

                        totalQuestions++;
                        sectionQuestionCount++;
                        totalMarks += savedSectionProblem.marks || 0;
                        sectionTotalMarks += savedSectionProblem.marks || 0;
                    }
                }

                // ⭐ HANDLE SQL QUESTIONS - LINK TO EXISTING SQL QUESTIONS
                if (sectionData.sqlQuestions && Array.isArray(sectionData.sqlQuestions) && sectionData.sqlQuestions.length > 0) {
                    console.log(`  [CREATE_SQL_QUESTIONS] Linking ${sectionData.sqlQuestions.length} SQL questions...`);

                    const { SqlQuestion } = await import("../entities/SqlQuestion.entity");
                    const sqlQuestionRepo = AppDataSource.getRepository(SqlQuestion);

                    for (const sqlQuestionData of sectionData.sqlQuestions) {
                        // Expect sqlQuestionId from frontend - this is the ID of the existing SqlQuestion entity
                        const sqlQuestionId = sqlQuestionData.sqlQuestionId || sqlQuestionData.id;

                        if (!sqlQuestionId) {
                            console.error(`    ❌ [CREATE] SQL question missing 'sqlQuestionId' or 'id'. Cannot link.`);
                            throw { status: 400, message: "SQL questions must include 'sqlQuestionId' or 'id' to link to an existing SQL question." };
                        }

                        console.log(`    ⚠️ [CREATE] Detected SQL question. Linking to existing SQL Question ID: ${sqlQuestionId}`);

                        // Fetch the existing SQL question to verify it exists
                        const existingSqlQuestion = await queryRunner.manager.findOne(SqlQuestion, {
                            where: { id: sqlQuestionId }
                        });

                        if (!existingSqlQuestion) {
                            console.error(`    ❌ [CREATE] SQL Question not found with ID: ${sqlQuestionId}`);
                            throw { status: 404, message: `SQL Question with ID ${sqlQuestionId} not found.` };
                        }

                        console.log(`    ✅ Found existing SQL Question: "${existingSqlQuestion.title}" (ID: ${existingSqlQuestion.id})`);

                        // Link SQL question to section by updating its section reference
                        existingSqlQuestion.section = section;
                        existingSqlQuestion.marks = sqlQuestionData.marks || sectionData.marksPerQuestion || 5;

                        await queryRunner.manager.save(existingSqlQuestion);
                        console.log(`    🔗 Linked SQL Question to Section: ${existingSqlQuestion.id}`);

                        totalQuestions++;
                        sectionQuestionCount++;
                        totalMarks += existingSqlQuestion.marks || 0;
                        sectionTotalMarks += existingSqlQuestion.marks || 0;
                        totalSqlQuestions++; // Increment SQL question counter
                    }
                }


                // ⭐ Add section data to table with CORRECT calculation
                // Total = Number of questions × Marks per question
                const sectionTotal = sectionQuestionCount * marksPerQuestion;
                sectionData_table.push({
                    Section: sectionData.title,
                    Questions: sectionQuestionCount,
                    "Marks/Q": marksPerQuestion,
                    Total: sectionTotal,
                    Time: sectionData.timeLimit ? `${sectionData.timeLimit}m` : "No limit",
                    timeLimit: sectionData.timeLimit || null
                });

                // Update section's totalMarks
                section.totalMarks = sectionTotalMarks;
                await queryRunner.manager.save(section);
            }
        }

        // Calculate totalTime from sections
        let totalTime = 0;
        if (data.sections && data.sections.length > 0) {
            for (const sectionData of data.sections) {
                totalTime += sectionData.timeLimit || 0;
            }
        } else if (data.globalTime) {
            totalTime = data.globalTime;
        }

        // Update assessment with calculated totals
        assessment.totalSections = sectionCount;
        assessment.totalQuestions = totalQuestions;
        assessment.totalMarks = totalMarks;
        assessment.totalTime = totalTime;

        // ⭐ AUTO-READY LOGIC ⭐
        // Check if assessment is complete enough to be READY
        let isReady = false;
        if (assessment.totalSections > 0 && assessment.totalQuestions > 0) {
            // Also check basics
            if (assessment.title && assessment.title.length >= 5) {
                isReady = true;
            }
        }

        // Only auto-upgrade to READY if currently DRAFT
        if (assessment.status === AssessmentStatus.DRAFT && isReady) {
            assessment.status = AssessmentStatus.READY;
            console.log(`✨ Auto-upgrading assessment status to READY (Ready for publishing)`);
        }

        await queryRunner.manager.save(assessment);

        // ⭐ Print formatted table with section data + overall summary
        console.log(`\n📊 [ASSESSMENT CREATED] ${data.title}`);
        console.table(sectionData_table);
        console.log(`\n📈 OVERALL SUMMARY:`);
        console.log(`   ✅ Total Sections: ${sectionCount}`);
        console.log(`   ✅ Total Questions: ${totalQuestions}`);
        if (totalSqlQuestions > 0) {
            console.log(`   🗄️  SQL Questions: ${totalSqlQuestions}`);
        }
        console.log(`   ✅ Total Marks: ${totalMarks}`);
        console.log(`   ✅ Total Time: ${totalTime} minutes`);
        console.log(`   ✅ Status: ${assessment.status}`);

        // Commit transaction
        await queryRunner.commitTransaction();
        console.log(`🎉 Transaction committed successfully!`);

        // Return success response
        return {
            success: true,
            data: {
                id: assessment.id,
                title: assessment.title,
                status: assessment.status,
                totalSections: assessment.totalSections,
                totalQuestions: assessment.totalQuestions,
                totalMarks: assessment.totalMarks,
                totalTime: assessment.totalTime,
                createdAt: assessment.createdAt,
            },
        };

    } catch (error: any) {
        // Rollback transaction on error
        await queryRunner.rollbackTransaction();
        console.error(`❌ Transaction rolled back:`, error.message);
        throw error;

    } finally {
        // Release query runner
        await queryRunner.release();
    }
};

// ✅ Get assessments by company ID (for Organizer viewing Company Profile)
export const getAssessmentsByCompany = async (organizerId: string, companyId: string) => {
    // Verify user is an organizer (or has access)
    const user = await userRepo().findOne({ where: { id: organizerId } });
    if (!user || user.role !== UserRole.ORGANIZER) {
        throw { status: 403, message: "Unauthorized. Only organizers can access this." };
    }

    // Fetch assessments for the company
    const assessments = await repo().find({
        where: { company: { id: companyId } },
        relations: ["organizer", "sections"],
        order: { createdAt: "DESC" }
    });

    return assessments;
};

// ✅ Get single assessment by ID with sections and questions
export const getAssessmentById = async (id: string, organizerId: string, skipOwnershipCheck = false): Promise<Assessment> => {
    let assessment = await repo().findOne({
        where: { id },
        relations: [
            "organizer",
            "company",
            "sections",
            "sections.questions",
            "sections.problems",
            "sections.problems.problem",
            "sections.sqlQuestions"  // ✅ Load SQL questions
        ],
    });

    if (!assessment) throw { status: 404, message: "Assessment not found" };

    if (!skipOwnershipCheck) {
        // Only owner can view OR the company approver (Organizer)
        let hasAccess = false;

        // 1. Direct Owner
        if (assessment.organizer?.id === organizerId) hasAccess = true;

        // 2. Company Approver (Organizer)
        // We need to check if this assessment belongs to a company approved by this organizer
        if (!hasAccess && assessment.company?.approvedById === organizerId) hasAccess = true;

        if (!hasAccess) {
            throw { status: 403, message: "Access denied" };
        }
    }

    // Auto-update status if assessment has ended
    assessment = await checkAndUpdateAssessmentStatus(assessment);

    // Sort sections and questions by order
    if (assessment.sections) {
        assessment.sections.sort((a, b) => a.order - b.order);
        for (const section of assessment.sections) {
            // Sort existing MCQs
            if (section.questions) {
                section.questions.sort((a, b) => a.order - b.order);
            }

            // ⭐ UNIFY DATA FOR FRONTEND: Logic Removed - Frontend expects 'problems' key.
        }
    }

    // --- TIMER LOGIC PATCH ---
    // If timeMode is SECTION, ensure each section exposes its timeLimit
    if (assessment.timeMode === 'section' && assessment.sections) {
        assessment.sections.forEach(sec => {
            // If section.timeLimit is not set, fallback to a default (e.g., 0 = no limit)
            if (typeof sec.timeLimit !== 'number') {
                sec.timeLimit = 0;
            }
        });
    }

    // --- DEBUG LOGS FOR ORGANIZER (VERBOSE) ---
    console.log(`\n🔍 [ORGANIZER_VIEW] Fetched Assessment: "${assessment.title}" (${assessment.id})`);
    console.log(`   Total Sections: ${assessment.sections?.length || 0}`);

    assessment.sections?.forEach((sec, idx) => {
        console.log(`\n   📂 Section ${idx + 1}: "${sec.title}" (ID: ${sec.id})`);

        // 1. Log Regular Questions
        const questions = sec.questions || [];
        console.log(`      - Regular Questions: ${questions.length}`);
        questions.forEach((q, qIdx) => {
            console.log(`         ❓ [Q${qIdx + 1}] (${q.type}) Order: ${q.order}, Marks: ${q.marks}`);
            console.log(`             Text: "${q.text?.substring(0, 100)}${q.text && q.text.length > 100 ? '...' : ''}"`);
            if (q.options) console.log(`             Options: ${JSON.stringify(q.options)}`);
            if (q.correctAnswer) console.log(`             Correct Answer: ${q.correctAnswer}`);
            console.log(`             ID: ${q.id}`);
        });

        // 2. Log Coding Problems
        const problems = sec.problems || [];
        console.log(`      - Coding Problems: ${problems.length}`);

        if (problems.length > 0) {
            problems.forEach((sp, pIdx) => {
                const p = sp.problem;
                console.log(`         💻 [P${pIdx + 1}] Title: "${p?.title || 'Unknown'}"`);
                console.log(`             Link ID: ${sp.id}`);
                console.log(`             Prob ID: ${p?.id}`);
                console.log(`             Marks:   ${sp.marks}`);
                console.log(`             -----------------------`);
            });
        } else {
            console.log(`         (No coding problems linked)`);
        }

        // 3. Log SQL Questions
        const sqlQuestions = sec.sqlQuestions || [];
        console.log(`      - SQL Questions: ${sqlQuestions.length}`);

        if (sqlQuestions.length > 0) {
            sqlQuestions.forEach((sqlQ, sqlIdx) => {
                console.log(`         🗄️  [SQL${sqlIdx + 1}] Title: "${sqlQ.title || 'Unknown'}"`);
                console.log(`             ID: ${sqlQ.id}`);
                console.log(`             Marks: ${sqlQ.marks || 'N/A'}`);
                console.log(`             Difficulty: ${sqlQ.difficulty}`);
                console.log(`             -----------------------`);
            });
        } else {
            console.log(`         (No SQL questions linked)`);
        }
    });
    console.log(`--------------------------------------------------\n`);

    // Log the EXACT response being sent to frontend (for debugging)
    console.log(`📤 [ORGANIZER] Sending to Frontend (sections summary):`);
    assessment.sections?.forEach((sec, idx) => {
        console.log(`   Section ${idx + 1}: "${sec.title}"`);
        console.log(`      questions: ${sec.questions?.length || 0}`);
        console.log(`      problems: ${sec.problems?.length || 0}`);
        if (assessment.timeMode === 'section') {
            console.log(`      timeLimit: ${sec.timeLimit} minutes`);
        }
        if (sec.problems && sec.problems.length > 0) {
            sec.problems.forEach(sp => {
                console.log(`         → problem.id: ${sp.problem?.id}`);
                console.log(`         → problem.title: ${sp.problem?.title}`);
                if (sp.testCaseConfig) {
                    console.log(`           ⚙️ Config: Example=${JSON.stringify(sp.testCaseConfig.exampleRange || sp.testCaseConfig.exampleIndices || "ALL")}, Hidden=${JSON.stringify(sp.testCaseConfig.hiddenRange || sp.testCaseConfig.hiddenIndices || "ALL")}`);
                } else {
                    console.log(`           ⚙️ Config: ALL test cases`);
                }
                console.log(`         → problem.description: ${sp.problem?.description?.substring(0, 50)}...`);
            });
        }
        if (sec.sqlQuestions && sec.sqlQuestions.length > 0) {
            console.log(`      sqlQuestions: ${sec.sqlQuestions.length}`);
            sec.sqlQuestions.forEach(sqlQ => {
                console.log(`         → sqlQuestion.id: ${sqlQ.id}`);
                console.log(`         → sqlQuestion.title: ${sqlQ.title}`);
                console.log(`         → sqlQuestion.difficulty: ${sqlQ.difficulty}`);
            });
        }
    });

    return assessment;
};

// ✅ List assessments for organizer with pagination and filters
export interface ListAssessmentsFilters {
    status?: AssessmentStatus;
    page?: number;
    limit?: number;
    sortBy?: "createdAt" | "title" | "startDate";
    order?: "asc" | "desc";
}

export const listAssessments = async (
    organizerId: string,
    filters: ListAssessmentsFilters = {}
): Promise<{ data: Assessment[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;
    const sortBy = filters.sortBy || "createdAt";
    const order = filters.order?.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const orderBy = `assessment.${sortBy}`;

    const query = repo().createQueryBuilder("assessment")
        .leftJoinAndSelect("assessment.organizer", "organizer")
        .leftJoinAndSelect("assessment.sections", "sections")
        .leftJoinAndSelect("assessment.company", "company")
        .where(new Brackets(qb => {
            qb.where("organizer.id = :organizerId", { organizerId })
                .orWhere("company.approvedById = :organizerId", { organizerId });
        }));

    if (filters.status) {
        query.andWhere("assessment.status = :status", { status: filters.status });
    }

    query
        .orderBy(orderBy, order)
        .skip(skip)
        .take(limit);

    const [data, total] = await query.getManyAndCount();

    // Auto-update status for assessments that have ended
    for (let i = 0; i < data.length; i++) {
        data[i] = await checkAndUpdateAssessmentStatus(data[i]);
    }

    // 🔍 DEBUG: Log summary of what we are sending
    console.log(`📋 [LIST_ASSESSMENTS] Returning ${data.length} items (Total: ${total})`);
    if (data.length > 0) {
        data.slice(0, 3).forEach((ass, idx) => {
            console.log(`   🔸 [${idx + 1}] "${ass.title}"`);
            console.log(`       ID: ${ass.id}`);
            console.log(`       Status: ${ass.status}`);
            console.log(`       Questions: ${ass.totalQuestions} | Marks: ${ass.totalMarks}`);
            console.log(`       Sections: ${ass.sections?.length || 0}`);
        });
    }

    return {
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

// ✅ Update assessment
export const updateAssessment = async (id: string, organizerId: string, data: any): Promise<Assessment> => {
    const assessment = await repo().findOne({
        where: { id },
        relations: ["organizer", "sections", "sections.questions", "sections.problems"], // ✅ Load full tree
    });

    if (!assessment) throw { status: 404, message: "Assessment not found" };

    // ⭐ PRE-PROCESS DATA: separate Coding questions from regular Questions
    if (data.sections && Array.isArray(data.sections)) {
        console.log(`[UPDATE_DEBUG] Processing ${data.sections.length} sections from payload`);

        for (const section of data.sections) {
            console.log(`   [UPDATE_DEBUG] Section: ${section.title} (ID: ${section.id})`);
            console.log(`      -> Keys received: ${Object.keys(section).join(', ')}`);
            console.log(`      -> Questions provided: ${section.questions?.length || 0}`);
            console.log(`      -> Problems provided: ${section.problems?.length || 0}`);

            if (section.questions && Array.isArray(section.questions)) {
                // Find existing section entity to check for existing links
                const existingSection = assessment.sections?.find(s => s.id === section.id);

                const codingQuestions: any[] = [];
                const regularQuestions: any[] = [];

                for (const q of section.questions) {
                    if (q.type === 'coding') {
                        // 🔍 Robustly find Problem ID (frontend might send problemId or nested problem object)
                        let pid = q.problemId || q.problem?.id;

                        // ⭐ FALLBACK: If problemId is missing but we have an ID (SectionProblem ID),
                        // try to find it in existing data
                        if (!pid && q.id && existingSection?.problems) {
                            const existingProblem = existingSection.problems.find(p => p.id === q.id);
                            if (existingProblem) {
                                pid = existingProblem.problem?.id;
                                console.log(`   🔍 [FALLBACK] Found problemId from existing data: ${pid} for SP_ID: ${q.id}`);
                            }
                        }

                        if (!pid) {
                            // This is expected if the frontend sends the Coding Question in 'questions' array (incomplete) 
                            // AND in 'problems' array (complete). We skip this one and rely on 'problems' array.
                            console.log(`   ℹ️ [UPDATE] Skipping incomplete coding question in 'questions' list (missing problemId). Expecting it in 'problems' list. ID: ${q.id}`);
                            continue;
                        }

                        // ⭐ SMART MATCH: If ID is missing, check if this problem is already linked
                        let spId = q.id;
                        if (!spId && existingSection?.problems) {
                            const existingLink = existingSection.problems.find(p => p.problem?.id === pid);
                            if (existingLink) {
                                spId = existingLink.id;
                                console.log(`   💡 [SMART_MATCH] Found existing link for Problem ${pid} -> Using SP_ID: ${spId}`);
                            }
                        }

                        // Transform to SectionProblem structure
                        codingQuestions.push({
                            id: spId, // Use explicit or discovered ID
                            problem: { id: pid }, // Link to Problem entity
                            order: q.order !== undefined ? q.order : 0,
                            marks: q.marks !== undefined ? q.marks : (q.problem?.marks || 10),
                            testCaseConfig: q.testCaseConfig
                        });
                        console.log(`   🔄 [TRANSFORM] Mapped Coding Question: SP_ID=${spId || 'NEW'}, Problem_ID=${pid}`);
                    } else {
                        regularQuestions.push(q);
                    }
                }

                // Reassign to correct properties for TypeORM Cascade
                section.questions = regularQuestions;

                // Merge with existing problems or set new ones
                // Note: If frontend manages the whole list, we might want to overwrite
                // But typically problems might be sent as 'questions' by unified frontend editors
                if (codingQuestions.length > 0) {
                    section.problems = codingQuestions;
                }
            }

            // ⭐ ALSO PRE-PROCESS 'PROBLEMS' ARRAY (If frontend sends them separately)
            if (section.problems && Array.isArray(section.problems)) {
                // Find existing section entity to check for existing links
                const existingSection = assessment.sections?.find(s => s.id === section.id);

                for (const p of section.problems) {
                    // Check if problem ID is accessible (could be 'problem.id' or 'problemId' or just embedded)
                    const pid = p.problem?.id || p.problemId;

                    if (pid) {
                        // ⭐ SMART MATCH: If Link ID is missing, find it
                        if (!p.id && existingSection?.problems) {
                            const existingLink = existingSection.problems.find(ep => ep.problem?.id === pid);
                            if (existingLink) {
                                p.id = existingLink.id; // Inject existing ID
                                console.log(`   💡 [SMART_MATCH_PROBLEMS] Found existing link for Problem ${pid} -> Using SP_ID: ${p.id}`);
                            }
                        }

                        // ⭐ NORMALIZATION: Ensure 'problem' relation object exists for TypeORM
                        // TypeORM requires { problem: { id: ... } } to save the relation.
                        if (!p.problem) {
                            p.problem = { id: pid };
                        } else if (!p.problem.id) {
                            p.problem.id = pid;
                        }
                    }
                }
            }
        }
    }

    // Only owner can update OR the company approver (Organizer)
    let hasAccess = false;
    if (assessment.organizer?.id === organizerId) hasAccess = true;
    // We need to fetch company relation if not fetched, but findOne above only gets organizer.
    // Let's refetch with company for check if first check fails
    if (!hasAccess) {
        const fullErrAssessment = await repo().findOne({ where: { id }, relations: ["company"] });
        if (fullErrAssessment?.company?.approvedById === organizerId) {
            hasAccess = true;
        }
    }

    if (!hasAccess) {
        throw { status: 403, message: "Access denied" };
    }

    // Cannot update if active or completed
    if (assessment.status === AssessmentStatus.ACTIVE || assessment.status === AssessmentStatus.COMPLETED) {
        throw { status: 409, message: "Cannot update an active or completed assessment" };
    }

    // Validate title if provided
    if (data.title !== undefined) {
        if (data.title.length < 5 || data.title.length > 200) {
            throw { status: 400, message: "Title must be between 5 and 200 characters" };
        }
    }

    // Validate description if provided
    if (data.description !== undefined && data.description.length > 2000) {
        throw { status: 400, message: "Description must not exceed 2000 characters" };
    }

    // Validate pass percentage if provided
    if (data.passPercentage !== undefined) {
        if (typeof data.passPercentage !== 'number' || data.passPercentage < 0 || data.passPercentage > 100) {
            throw { status: 400, message: "Pass percentage must be a number between 0 and 100" };
        }
    }

    // Validate dates
    const startDate = data.startDate ? new Date(data.startDate) : assessment.startDate;
    const endDate = data.endDate ? new Date(data.endDate) : assessment.endDate;
    if (startDate && endDate && endDate <= startDate) {
        throw { status: 400, message: "End date must be after start date" };
    }

    // Don't allow changing status directly
    delete data.status;
    delete data.publishedAt;
    delete data.organizer;

    // Don't allow changing status directly via generic update
    // delete data.status; // Handled by selective update

    // ⚠️ CRITICAL: Extract sections to update them manually
    const sectionsData = data.sections;

    // ⭐ SAFE UPDATE: Only update allowed top-level fields
    // This prevents accidental overwriting of 'sections' or other relations
    if (data.title) assessment.title = data.title;
    if (data.description !== undefined) assessment.description = data.description;
    if (data.startDate) assessment.startDate = new Date(data.startDate);
    if (data.endDate) assessment.endDate = new Date(data.endDate);
    if (data.timeMode) assessment.timeMode = data.timeMode;
    if (data.globalTime !== undefined) assessment.globalTime = data.globalTime;
    if (data.duration !== undefined) assessment.duration = data.duration;
    if (data.passPercentage !== undefined) assessment.passPercentage = data.passPercentage;
    if (data.allowPreviousNavigation !== undefined) assessment.allowPreviousNavigation = data.allowPreviousNavigation;
    if (data.allowMarkForReview !== undefined) assessment.allowMarkForReview = data.allowMarkForReview;

    // Update JSONB configs strictly if provided
    if (data.proctoring) {
        assessment.proctoring = { ...assessment.proctoring, ...data.proctoring };
    }

    // ⭐ Manually update sections to preserve entity tracking
    if (sectionsData && Array.isArray(sectionsData)) {
        console.log(`[UPDATE] Processing ${sectionsData.length} sections manually...`);
        for (const sectionData of sectionsData) {
            const existingSection = assessment.sections?.find(s => s.id === sectionData.id);

            if (existingSection) {
                // Update existing section
                Object.assign(existingSection, {
                    title: sectionData.title,
                    description: sectionData.description,
                    type: sectionData.type,
                    questionCount: sectionData.questionCount,
                    marksPerQuestion: sectionData.marksPerQuestion,
                    timeLimit: sectionData.timeLimit,
                    negativeMarking: sectionData.negativeMarking,
                    difficulty: sectionData.difficulty,
                    enabledPatterns: sectionData.enabledPatterns,
                    themeColor: sectionData.themeColor,
                    order: sectionData.orderIndex || sectionData.order
                });

                // Update questions and problems arrays (these are already processed/normalized above)
                if (sectionData.questions !== undefined) {
                    existingSection.questions = sectionData.questions;
                }
                if (sectionData.problems !== undefined) {
                    // ⚠️ CRITICAL: Convert plain objects to TypeORM entities
                    const sectionProblemRepo = AppDataSource.getRepository("SectionProblem");
                    existingSection.problems = sectionData.problems.map((p: any) => {
                        // If it has an ID, it's an update; otherwise it's new
                        return sectionProblemRepo.create({
                            id: p.id,
                            problem: p.problem,
                            section: existingSection,
                            marks: p.marks,
                            order: p.order,
                            testCaseConfig: p.testCaseConfig
                        });
                    });
                }
            }
        }
    }

    await repo().save(assessment);

    // ⭐ Recalculate totals (marks, questions) after update
    // This ensures Dashboard List View has accurate counts even for DRAFTs
    await recalculateTotals(assessment.id);

    // Fetch fresh copy to return with updated totals
    return await getAssessmentById(assessment.id, organizerId, true);
};

export const deleteAssessment = async (id: string, userId: string): Promise<{ message: string }> => {
    const assessment = await repo().findOne({
        where: { id },
        relations: ["organizer", "company"], // Need company to check perms
    });

    if (!assessment) throw { status: 404, message: "Assessment not found" };

    const user = await userRepo().findOne({ where: { id: userId }, relations: ["company"] });
    if (!user) throw { status: 404, message: "User not found" };

    // 🛡️ ACCESS CONTROL
    if (user.role === UserRole.ORGANIZER) {
        // 1. Direct Owner
        let hasAccess = false;
        if (assessment.organizer?.id === userId) hasAccess = true;

        // 2. Company Approver
        if (!hasAccess && assessment.company?.approvedById === userId) hasAccess = true;

        if (!hasAccess) {
            throw { status: 403, message: "Access denied" };
        }
    } else if (user.role === UserRole.ADMIN) {
        // Company Admin Logic
        // 1. Must belong to same company
        if (assessment.company?.id !== user.company?.id) {
            throw { status: 403, message: "Access denied. Not your company's assessment." };
        }
        // 2. Must have DELETE permission
        if (!user.company.permissions?.deleteAssessment) {
            throw { status: 403, message: "Your company does not have permission to delete assessments." };
        }
    } else {
        throw { status: 403, message: "Unauthorized action" };
    }

    if (assessment.status !== AssessmentStatus.DRAFT && assessment.status !== AssessmentStatus.READY) {
        throw { status: 409, message: "Can only delete assessments in draft or ready status" };
    }

    await repo().remove(assessment);
    return { message: "Assessment deleted successfully" };
};

export const publishAssessment = async (id: string, organizerId: string): Promise<Assessment> => {
    const assessment = await repo().findOne({
        where: { id },
        relations: [
            "organizer",
            "sections",
            "sections.questions",
            "sections.problems",
            "sections.problems.problem"
        ],
    });

    if (!assessment) throw { status: 404, message: "Assessment not found" };

    // Ownership check (Direct or Company Approver)
    let hasAccess = false;
    if (assessment.organizer?.id === organizerId) hasAccess = true;
    if (!hasAccess) {
        // Refetch with company relation if needed? 
        // relations already includes `sections...` but maybe not `company`.
        // Let's rely on finding one with company or assume relations update.
        // Wait, publishAssessment relations list does NOT have company.
        const fullAss = await repo().findOne({ where: { id }, relations: ["company"] });
        if (fullAss?.company?.approvedById === organizerId) hasAccess = true;
    }

    if (!hasAccess) {
        throw { status: 403, message: "Access denied" };
    }

    if (assessment.status !== AssessmentStatus.DRAFT && assessment.status !== AssessmentStatus.READY) {
        throw { status: 409, message: "Only draft or ready assessments can be published" };
    }

    // Validation: must have at least 1 section
    if (!assessment.sections || assessment.sections.length === 0) {
        throw { status: 422, message: "Assessment must have at least one section" };
    }

    // Validation: each section must have at least 1 question OR coding problem
    for (const section of assessment.sections) {
        const questionCount = (section.questions?.length || 0) + (section.problems?.length || 0);
        if (questionCount === 0) {
            throw { status: 422, message: `Section "${section.title}" must have at least one question` };
        }
    }

    // Validation: start date must be in future
    if (assessment.startDate && new Date(assessment.startDate) <= new Date()) {
        throw { status: 422, message: "Start date must be in the future" };
    }

    // Calculate totals
    let totalMarks = 0;
    let totalQuestions = 0;
    for (const section of assessment.sections) {
        // Count regular questions
        if (section.questions) {
            totalQuestions += section.questions.length;
            for (const question of section.questions) {
                totalMarks += question.marks || section.marksPerQuestion;
            }
        }

        // Count coding problems
        if (section.problems) {
            totalQuestions += section.problems.length;
            for (const sp of section.problems) {
                totalMarks += sp.marks || 10; // Default 10 marks for coding if not set
            }
        }
    }

    assessment.status = AssessmentStatus.PUBLISHED;
    assessment.publishedAt = new Date();
    assessment.totalMarks = totalMarks;
    assessment.totalQuestions = totalQuestions;

    return await repo().save(assessment) as unknown as Assessment;
};

// ✅ Recalculate totals for an assessment
export const recalculateTotals = async (assessmentId: string): Promise<void> => {
    const assessment = await repo().findOne({
        where: { id: assessmentId },
        relations: ["sections", "sections.questions", "sections.problems", "sections.sqlQuestions"],
    });

    if (!assessment) return;

    let totalMarks = 0;
    let totalQuestions = 0;
    let totalSectionTime = 0;

    for (const section of assessment.sections || []) {
        let sectionQuestionCount = 0; // Track per-section count to update section entity

        // Count regular questions
        const qCount = (section.questions || []).length;
        sectionQuestionCount += qCount;
        totalQuestions += qCount;
        for (const question of section.questions || []) {
            totalMarks += question.marks || section.marksPerQuestion;
        }

        // Count coding problems
        const pCount = (section.problems || []).length;
        sectionQuestionCount += pCount;
        totalQuestions += pCount;
        for (const sp of section.problems || []) {
            totalMarks += sp.marks || 10;
        }

        // Count SQL questions
        const sCount = (section.sqlQuestions || []).length;
        sectionQuestionCount += sCount;
        totalQuestions += sCount;
        for (const sqlQ of section.sqlQuestions || []) {
            totalMarks += sqlQ.marks || 10;
        }

        // Update section's cached question count if it differs
        if (section.questionCount !== sectionQuestionCount) {
            section.questionCount = sectionQuestionCount;
            await AppDataSource.getRepository(AssessmentSection).save(section);
        }

        // Sum section time
        totalSectionTime += section.timeLimit || 0;
    }

    assessment.totalMarks = totalMarks;
    assessment.totalQuestions = totalQuestions;
    assessment.totalSections = assessment.sections?.length || 0; // ⭐ Update section count

    // Auto-update totalTime if in section mode
    if (assessment.timeMode === 'section' || !assessment.totalTime) {
        assessment.totalTime = totalSectionTime;
    }

    // ⭐ AUTO-STATUS UPDATE ⭐
    // Only affect DRAFT or READY states
    if (assessment.status === AssessmentStatus.DRAFT || assessment.status === AssessmentStatus.READY) {
        const isComplete = assessment.totalSections > 0 && assessment.totalQuestions > 0 && (assessment.title?.length || 0) >= 5;

        console.log(`🔍 [STATUS_CHECK] ID: ${assessment.id} | Complete: ${isComplete}`);
        console.log(`   Stats: Sections=${assessment.totalSections}, Questions=${assessment.totalQuestions}, TitleLen=${assessment.title?.length}`);

        if (isComplete && assessment.status === AssessmentStatus.DRAFT) {
            assessment.status = AssessmentStatus.READY;
            console.log(`✨ [AUTO] Upgraded Assessment ${assessment.id} to READY`);
        } else if (!isComplete && assessment.status === AssessmentStatus.READY) {
            assessment.status = AssessmentStatus.DRAFT;
            console.log(`📉 [AUTO] Downgraded Assessment ${assessment.id} to DRAFT (Incomplete)`);
        }
    }

    await repo().save(assessment);
};
// 🕵️ Plagiarism Configuration Methods

/**
 * Get plagiarism configuration for an assessment
 */
export const getPlagiarismConfig = async (assessmentId: string, organizerId: string): Promise<any> => {
    const assessment = await repo().findOne({ where: { id: assessmentId } });

    if (!assessment) {
        const err: any = new Error("Assessment not found");
        err.status = 404;
        throw err;
    }

    // Check if organizer owns this assessment
    if (assessment.organizer?.id !== organizerId) {
        const err: any = new Error("Unauthorized");
        err.status = 403;
        throw err;
    }

    return assessment.plagiarismConfig || getDefaultPlagiarismConfig();
};

/**
 * Update plagiarism configuration for an assessment
 */
export const updatePlagiarismConfig = async (assessmentId: string, organizerId: string, configData: any): Promise<any> => {
    const assessment = await repo().findOne({ where: { id: assessmentId } });

    if (!assessment) {
        const err: any = new Error("Assessment not found");
        err.status = 404;
        throw err;
    }

    // Check if organizer owns this assessment
    if (assessment.organizer?.id !== organizerId) {
        const err: any = new Error("Unauthorized");
        err.status = 403;
        throw err;
    }

    // Get current config or default
    const currentConfig = assessment.plagiarismConfig || getDefaultPlagiarismConfig();

    // Merge with new data
    const updatedConfig = {
        ...currentConfig,
        ...configData,
        reportConfig: {
            ...currentConfig.reportConfig,
            ...configData.reportConfig
        }
    };

    assessment.plagiarismConfig = updatedConfig;
    await repo().save(assessment);

    console.log(`✅ [PLAGIARISM_CONFIG] Updated for assessment ${assessmentId}`);
    console.log(`   -> Strictness: ${updatedConfig.strictness}`);
    console.log(`   -> Threshold: ${updatedConfig.similarityThreshold}%`);
    console.log(`   -> AI Sensitivity: ${updatedConfig.aiSensitivity}`);

    return updatedConfig;
};

/**
 * Reset plagiarism configuration to defaults
 */
export const resetPlagiarismConfig = async (assessmentId: string, organizerId: string): Promise<any> => {
    const assessment = await repo().findOne({ where: { id: assessmentId } });

    if (!assessment) {
        const err: any = new Error("Assessment not found");
        err.status = 404;
        throw err;
    }

    // Check if organizer owns this assessment
    if (assessment.organizer?.id !== organizerId) {
        const err: any = new Error("Unauthorized");
        err.status = 403;
        throw err;
    }

    const defaultConfig = getDefaultPlagiarismConfig();
    assessment.plagiarismConfig = defaultConfig;
    await repo().save(assessment);

    console.log(`✅ [PLAGIARISM_CONFIG] Reset to defaults for assessment ${assessmentId}`);

    return defaultConfig;
};

/**
 * Get default plagiarism configuration (Safety defaults)
 */
const getDefaultPlagiarismConfig = (): any => ({
    enabled: true,
    strictness: "Medium" as const,
    similarityThreshold: 75, // 75% is the default threshold
    aiSensitivity: "Medium" as const,
    reportConfig: {
        includeSourceCode: true,
        includeMatches: true,
        includeAiAnalysis: true,
        includeVerdict: true
    }
});