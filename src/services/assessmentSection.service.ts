import { AppDataSource } from "../config/db";
import { Assessment, AssessmentStatus } from "../entities/Assessment.entity";
import { AssessmentSection, SectionDifficulty, SectionType, ThemeColor } from "../entities/AssessmentSection.entity";
import { SqlQuestion } from "../entities/SqlQuestion.entity";
import { recalculateTotals } from "./assessment.service";
import { In } from "typeorm";

const repo = () => AppDataSource.getRepository(AssessmentSection);
const assessmentRepo = () => AppDataSource.getRepository(Assessment);
const sqlQuestionRepo = () => AppDataSource.getRepository(SqlQuestion);

// ✅ Verify assessment ownership
const verifyAssessmentOwnership = async (assessmentId: string, organizerId: string): Promise<Assessment> => {
  const assessment = await assessmentRepo().findOne({
    where: { id: assessmentId },
    relations: ["organizer"],
  });

  if (!assessment) throw { status: 404, message: "Assessment not found" };

  if (assessment.organizer?.id !== organizerId) {
    throw { status: 403, message: "Access denied" };
  }

  return assessment;
};

// ✅ Verify section ownership (returns section and assessment)
const verifySectionOwnership = async (sectionId: string, organizerId: string): Promise<{ section: AssessmentSection; assessment: Assessment }> => {
  const section = await repo().findOne({
    where: { id: sectionId },
    relations: ["assessment", "assessment.organizer"],
  });

  if (!section) throw { status: 404, message: "Section not found" };

  if (section.assessment?.organizer?.id !== organizerId) {
    throw { status: 403, message: "Access denied" };
  }

  return { section, assessment: section.assessment };
};

// ✅ Create a new section
export const createSection = async (assessmentId: string, data: any, organizerId: string): Promise<AssessmentSection> => {
  const assessment = await verifyAssessmentOwnership(assessmentId, organizerId);

  // Only draft assessments can have sections added
  if (assessment.status !== AssessmentStatus.DRAFT) {
    throw { status: 409, message: "Can only add sections to draft assessments" };
  }

  // Validate title
  if (!data.title || data.title.length < 5 || data.title.length > 100) {
    throw { status: 400, message: "Section title must be between 5 and 100 characters" };
  }

  // Validate description
  if (data.description && data.description.length > 500) {
    throw { status: 400, message: "Section description must not exceed 500 characters" };
  }

  // Validate questionCount
  if (data.questionCount !== undefined && (data.questionCount < 1 || data.questionCount > 200)) {
    throw { status: 400, message: "Question count must be between 1 and 200" };
  }

  // Validate marksPerQuestion
  if (data.marksPerQuestion !== undefined && (data.marksPerQuestion < 1 || data.marksPerQuestion > 100)) {
    throw { status: 400, message: "Marks per question must be between 1 and 100" };
  }

  // Validate timeLimit
  if (data.timeLimit !== undefined && (data.timeLimit < 1 || data.timeLimit > 300)) {
    throw { status: 400, message: "Time limit must be between 1 and 300 minutes" };
  }

  // Validate negativeMarking
  if (data.negativeMarking !== undefined && (data.negativeMarking < 0 || data.negativeMarking > 1)) {
    throw { status: 400, message: "Negative marking must be between 0 and 1" };
  }

  // Get max order for positioning
  const maxOrderResult = await repo()
    .createQueryBuilder("section")
    .where("section.assessmentId = :assessmentId", { assessmentId })
    .select("MAX(section.order)", "maxOrder")
    .getRawOne();

  const nextOrder = (maxOrderResult?.maxOrder || 0) + 1;

  const section = repo().create({
    ...data,
    assessment,
    order: nextOrder,
  });

  const savedSection = await repo().save(section) as unknown as AssessmentSection;
  await recalculateTotals(assessmentId);

  return savedSection;
};

// ✅ List sections for an assessment
export const listSections = async (assessmentId: string, organizerId: string): Promise<AssessmentSection[]> => {
  await verifyAssessmentOwnership(assessmentId, organizerId);

  return await repo().find({
    where: { assessment: { id: assessmentId } },
    relations: ["questions"],
    order: { order: "ASC" },
  });
};

// ✅ Update section
export const updateSection = async (sectionId: string, data: any, organizerId: string): Promise<AssessmentSection> => {
  const { section, assessment } = await verifySectionOwnership(sectionId, organizerId);

  // Cannot update if assessment is active or completed
  if (assessment.status === AssessmentStatus.ACTIVE || assessment.status === AssessmentStatus.COMPLETED) {
    throw { status: 409, message: "Cannot update sections in an active or completed assessment" };
  }

  // Validate title if provided
  if (data.title !== undefined) {
    if (data.title.length < 5 || data.title.length > 100) {
      throw { status: 400, message: "Section title must be between 5 and 100 characters" };
    }
  }

  // Validate description if provided
  if (data.description !== undefined && data.description.length > 500) {
    throw { status: 400, message: "Section description must not exceed 500 characters" };
  }

  // Don't allow changing assessment
  delete data.assessment;

  Object.assign(section, data);
  const savedSection = await repo().save(section) as unknown as AssessmentSection;
  await recalculateTotals(assessment.id);

  return savedSection;
};

// ✅ Delete section
export const deleteSection = async (sectionId: string, organizerId: string): Promise<{ message: string }> => {
  const { section, assessment } = await verifySectionOwnership(sectionId, organizerId);

  // Only draft assessments can have sections deleted
  if (assessment.status !== AssessmentStatus.DRAFT) {
    throw { status: 409, message: "Can only delete sections from draft assessments" };
  }

  await repo().remove(section);
  await recalculateTotals(assessment.id);

  return { message: "Section deleted successfully" };
};

// ✅ Reorder sections
export const reorderSections = async (
  assessmentId: string,
  sectionIds: string[],
  organizerId: string
): Promise<{ message: string }> => {
  const assessment = await verifyAssessmentOwnership(assessmentId, organizerId);

  // Only draft assessments can have sections reordered
  if (assessment.status !== AssessmentStatus.DRAFT) {
    throw { status: 409, message: "Can only reorder sections in draft assessments" };
  }

  // Verify all sections belong to this assessment
  const sections = await repo().find({
    where: { assessment: { id: assessmentId } },
  });

  const existingIds = new Set(sections.map(s => s.id));
  for (const id of sectionIds) {
    if (!existingIds.has(id)) {
      throw { status: 400, message: `Section ${id} does not belong to this assessment` };
    }
  }

  // Update order for each section
  for (let i = 0; i < sectionIds.length; i++) {
    await repo().update(sectionIds[i], { order: i + 1 });
  }

  return { message: "Sections reordered successfully" };
};

// ✅ Add SQL questions to section
export const addSqlQuestions = async (
  sectionId: string,
  questionIds: string[],
  organizerId: string
): Promise<{ added: number; message: string }> => {
  console.log(`🔍 [ADD_SQL_QUESTIONS] Looking for section: ${sectionId}, User: ${organizerId}`);
  const { section, assessment } = await verifySectionOwnership(sectionId, organizerId);

  // Only draft assessments can have questions added
  if (assessment.status !== AssessmentStatus.DRAFT) {
    throw { status: 409, message: "Can only add questions to draft assessments" };
  }

  // Verify section type
  if (section.type !== SectionType.SQL) {
    throw { status: 400, message: "Can only add SQL questions to an SQL section" };
  }

  if (!questionIds || questionIds.length === 0) {
    throw { status: 400, message: "No question IDs provided" };
  }

  // Find questions
  const questions = await sqlQuestionRepo().findBy({
    id: In(questionIds),
  });

  if (questions.length === 0) {
    throw { status: 404, message: "No matching SQL questions found" };
  }

  // Update section for these questions
  // We use save to trigger listeners if any (though plain update is more efficient, save handles relations better usually)
  // For bulk updates, pure SQL or QueryBuilder is better.

  await sqlQuestionRepo()
    .createQueryBuilder()
    .update(SqlQuestion)
    .set({ section: section })
    .whereInIds(questions.map(q => q.id))
    .execute();

  await recalculateTotals(assessment.id);

  return { added: questions.length, message: `Successfully added ${questions.length} SQL questions to section` };
};
