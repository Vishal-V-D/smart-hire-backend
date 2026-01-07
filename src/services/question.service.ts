import { AppDataSource } from "../config/db";
import { Assessment, AssessmentStatus } from "../entities/Assessment.entity";
import { AssessmentSection } from "../entities/AssessmentSection.entity";
import { Question, QuestionDifficulty, QuestionType } from "../entities/Question.entity";
import { recalculateTotals } from "./assessment.service";

const repo = () => AppDataSource.getRepository(Question);
const sectionRepo = () => AppDataSource.getRepository(AssessmentSection);

// ✅ Verify section ownership (returns section, assessment)
const verifySectionOwnership = async (sectionId: string, organizerId: string): Promise<{ section: AssessmentSection; assessment: Assessment }> => {
    const section = await sectionRepo().findOne({
        where: { id: sectionId },
        relations: ["assessment", "assessment.organizer"],
    });

    if (!section) throw { status: 404, message: "Section not found" };

    if (section.assessment?.organizer?.id !== organizerId) {
        throw { status: 403, message: "Access denied" };
    }

    return { section, assessment: section.assessment };
};

// ✅ Verify question ownership
const verifyQuestionOwnership = async (questionId: string, organizerId: string): Promise<{ question: Question; section: AssessmentSection; assessment: Assessment }> => {
    const question = await repo().findOne({
        where: { id: questionId },
        relations: ["section", "section.assessment", "section.assessment.organizer"],
    });

    if (!question) throw { status: 404, message: "Question not found" };

    if (question.section?.assessment?.organizer?.id !== organizerId) {
        throw { status: 403, message: "Access denied" };
    }

    return { question, section: question.section, assessment: question.section.assessment };
};

// ✅ Validate question data
const validateQuestionData = (data: any, isUpdate = false): void => {
    // Validate text
    if (!isUpdate || data.text !== undefined) {
        if (!data.text && !isUpdate) {
            throw { status: 400, message: "Question text is required" };
        }
        if (data.text && (data.text.length < 10 || data.text.length > 1000)) {
            throw { status: 400, message: "Question text must be between 10 and 1000 characters" };
        }
    }

    // Validate options for choice types
    const type = data.type;
    if (type === QuestionType.SINGLE_CHOICE || type === QuestionType.MULTIPLE_CHOICE) {
        if (data.options !== undefined) {
            if (!Array.isArray(data.options) || data.options.length < 2 || data.options.length > 6) {
                throw { status: 400, message: "Choice questions must have 2-6 options" };
            }
            for (const opt of data.options) {
                if (typeof opt !== "string" || opt.length < 1 || opt.length > 200) {
                    throw { status: 400, message: "Each option must be between 1 and 200 characters" };
                }
            }
        }
    }

    // Validate explanation
    if (data.explanation && data.explanation.length > 2000) {
        throw { status: 400, message: "Explanation must not exceed 2000 characters" };
    }

    // Validate codeStub
    if (data.codeStub && data.codeStub.length > 5000) {
        throw { status: 400, message: "Code stub must not exceed 5000 characters" };
    }

    // Validate topic
    if (data.topic && data.topic.length > 100) {
        throw { status: 400, message: "Topic must not exceed 100 characters" };
    }
};

// ✅ Create a question
export const createQuestion = async (sectionId: string, data: any, organizerId: string): Promise<Question> => {
    const { section, assessment } = await verifySectionOwnership(sectionId, organizerId);

    // Only draft assessments can have questions added
    if (assessment.status !== AssessmentStatus.DRAFT) {
        throw { status: 409, message: "Can only add questions to draft assessments" };
    }

    validateQuestionData(data);

    // Get max order for positioning
    const maxOrderResult = await repo()
        .createQueryBuilder("question")
        .where("question.sectionId = :sectionId", { sectionId })
        .select("MAX(question.order)", "maxOrder")
        .getRawOne();

    const nextOrder = (maxOrderResult?.maxOrder || 0) + 1;

    const question = repo().create({
        ...data,
        section,
        order: nextOrder,
    });

    const savedQuestion = await repo().save(question) as unknown as Question;
    await recalculateTotals(assessment.id);

    return savedQuestion;
};

// ✅ Bulk create questions
export const bulkCreateQuestions = async (
    sectionId: string,
    questions: any[],
    organizerId: string
): Promise<{ created: number; failed: number; errors: { index: number; message: string }[] }> => {
    const { section, assessment } = await verifySectionOwnership(sectionId, organizerId);

    if (assessment.status !== AssessmentStatus.DRAFT) {
        throw { status: 409, message: "Can only add questions to draft assessments" };
    }

    if (!Array.isArray(questions) || questions.length === 0) {
        throw { status: 400, message: "Questions array is required" };
    }

    if (questions.length > 100) {
        throw { status: 400, message: "Cannot create more than 100 questions at once" };
    }

    // Get max order
    const maxOrderResult = await repo()
        .createQueryBuilder("question")
        .where("question.sectionId = :sectionId", { sectionId })
        .select("MAX(question.order)", "maxOrder")
        .getRawOne();

    let nextOrder = (maxOrderResult?.maxOrder || 0) + 1;

    const results = {
        created: 0,
        failed: 0,
        errors: [] as { index: number; message: string }[],
    };

    for (let i = 0; i < questions.length; i++) {
        try {
            validateQuestionData(questions[i]);

            const question = repo().create({
                ...questions[i],
                section,
                order: nextOrder++,
            });

            await repo().save(question);
            results.created++;
        } catch (err: any) {
            results.failed++;
            results.errors.push({ index: i, message: err.message || "Unknown error" });
        }
    }

    await recalculateTotals(assessment.id);

    return results;
};

// ✅ List questions with filters
export interface ListQuestionsFilters {
    type?: QuestionType;
    tags?: string[];
    topic?: string;
    difficulty?: QuestionDifficulty;
}

export const listQuestions = async (
    sectionId: string,
    organizerId: string,
    filters: ListQuestionsFilters = {}
): Promise<Question[]> => {
    await verifySectionOwnership(sectionId, organizerId);

    const queryBuilder = repo()
        .createQueryBuilder("question")
        .where("question.sectionId = :sectionId", { sectionId });

    // Apply filters
    if (filters.type) {
        queryBuilder.andWhere("question.type = :type", { type: filters.type });
    }

    if (filters.topic) {
        queryBuilder.andWhere("question.topic ILIKE :topic", { topic: `%${filters.topic}%` });
    }

    if (filters.difficulty) {
        queryBuilder.andWhere("question.difficulty = :difficulty", { difficulty: filters.difficulty });
    }

    if (filters.tags && filters.tags.length > 0) {
        // Match any of the provided tags
        queryBuilder.andWhere("question.tags && :tags", { tags: filters.tags });
    }

    queryBuilder.orderBy("question.order", "ASC");

    return await queryBuilder.getMany();
};

// ✅ Update question
export const updateQuestion = async (questionId: string, data: any, organizerId: string): Promise<Question> => {
    const { question, assessment } = await verifyQuestionOwnership(questionId, organizerId);

    if (assessment.status === AssessmentStatus.ACTIVE || assessment.status === AssessmentStatus.COMPLETED) {
        throw { status: 409, message: "Cannot update questions in an active or completed assessment" };
    }

    validateQuestionData(data, true);

    // Don't allow changing section
    delete data.section;

    Object.assign(question, data);
    const savedQuestion = await repo().save(question) as unknown as Question;
    await recalculateTotals(assessment.id);

    return savedQuestion;
};

// ✅ Delete question
export const deleteQuestion = async (questionId: string, organizerId: string): Promise<{ message: string }> => {
    const { question, assessment } = await verifyQuestionOwnership(questionId, organizerId);

    if (assessment.status !== AssessmentStatus.DRAFT) {
        throw { status: 409, message: "Can only delete questions from draft assessments" };
    }

    await repo().remove(question);
    await recalculateTotals(assessment.id);

    return { message: "Question deleted successfully" };
};
