import { AppDataSource } from "../config/db";
import { Problem, ProblemAccess } from "../entities/problem.entity";
import { TestCase } from "../entities/testcase.entity";
import { User } from "../entities/user.entity";
import { ContestProblem } from "../entities/contestProblem.entity";
import { Contest } from "../entities/contest.entity";

const repo = () => AppDataSource.getRepository(Problem);
const tcRepo = () => AppDataSource.getRepository(TestCase);
const userRepo = () => AppDataSource.getRepository(User);
const cpRepo = () => AppDataSource.getRepository(ContestProblem);
const contestRepo = () => AppDataSource.getRepository(Contest);

const normalizeTags = (tags: string | string[] | undefined): string[] | undefined => {
  if (!tags) return undefined;

  if (Array.isArray(tags)) {
    const normalized = tags.map((tag) => tag?.trim()).filter(Boolean);
    return normalized.length ? normalized : undefined;
  }

  if (typeof tags === "string") {
    const normalized = tags.split(",").map((tag) => tag.trim()).filter(Boolean);
    return normalized.length ? normalized : undefined;
  }

  return undefined;
};

// ✅ Create a problem (linked to organizer)
export const createProblem = async (data: any, creatorId: string): Promise<Problem> => {
  const creator = await userRepo().findOneBy({ id: creatorId });
  if (!creator) throw { status: 404, message: "Creator not found" };

  const tags = normalizeTags(data.tags);

  const problem = repo().create({
    ...data,
    ...(tags ? { tags } : {}),
    createdBy: creator,
    accessType: data.accessType || ProblemAccess.PRIVATE,
  });

  return await repo().save(problem) as unknown as Problem;
};

// ✅ Get single problem (accessible by public, creator, or registered contest user)
export const getProblem = async (id: string, userId?: string) => {
  // Fetch problem with testcases and creator
  const problem = await repo().findOne({
    where: { id },
    relations: ["testcases", "createdBy"],
  });
  if (!problem) throw { status: 404, message: "Problem not found" };

  // Public problem → anyone can see
  if (problem.accessType === ProblemAccess.PUBLIC) return problem;

  // Creator can see
  if (problem.createdBy?.id === userId) return problem;

  // Check if user has special access (Organizer or Authorized Admin)
  // If userId is provided, fetch user details
  let user: User | null = null;
  if (userId) {
    user = await userRepo().findOne({ where: { id: userId }, relations: ["company"] });
  }

  if (user) {
    console.log(`🔍 [GET_PROBLEM] Checking access for User: ${user.email} | Role: ${user.role}`);
    if (user.role === 'ADMIN') {
      console.log(`   🏢 Company: ${user.company?.name} | Permission (createAssessment): ${user.company?.permissions?.createAssessment}`);
    }

    // 1. ORGANIZER: Full access to all problems
    if (user.role === "ORGANIZER") return problem;

    // 2. ADMIN: Access if they have 'createAssessment' permission (Can view ALL problems to select from bank)
    if (user.role === "ADMIN" && user.company?.permissions?.createAssessment) {
      return problem;
    }

    // 3. CONTESTANT/GENERAL: Check contest registration
    const contestProblems = await cpRepo().find({
      where: { problem: { id } },
      relations: ["contest", "contest.contestant"],
    });

    // Check if user is registered in ANY contest that contains this problem
    const hasAccess = contestProblems.some((cp) =>
      cp?.contest?.contestant?.some((u) => u.id === userId)
    );

    if (hasAccess) return problem;
  }

  // Otherwise, deny access
  throw { status: 403, message: "Access denied" };
};

// ✅ List problems — PUBLIC + user's PRIVATE ones + Organizer's ones (if Company Admin)
export const listProblems = async (userId?: string, skip = 0, take = 20) => {
  const whereConditions: any[] = [
    { accessType: ProblemAccess.PUBLIC }
  ];

  if (userId) {
    const user = await userRepo().findOne({ where: { id: userId }, relations: ["company"] });

    if (user) {
      console.log(`🔍 [LIST_PROBLEMS] Checking access for User: ${user.email} | Role: ${user.role}`);
      if (user.role === 'ADMIN') {
        console.log(`   🏢 Company: ${user.company?.name} | Permission (createAssessment): ${user.company?.permissions?.createAssessment}`);
      }
    }

    // 1. ORGANIZER: See everything
    if (user?.role === "ORGANIZER") {
      return await repo().find({
        skip,
        take,
        relations: ["createdBy", "testcases"],
      });
    }

    // 2. Own Problems
    whereConditions.push({ createdBy: { id: userId } });

    // 3. ADMIN: Show ALL problems if they have permission (Global Question Bank Access)
    if (user?.role === "ADMIN" && user.company?.permissions?.createAssessment) {
      // Return everything (Public + Private + Others) just like Organizers
      return await repo().find({
        skip,
        take,
        relations: ["createdBy", "testcases"],
      });
    }
  }

  return await repo().find({
    where: whereConditions,
    skip,
    take,
    relations: ["createdBy", "testcases"],
  });
};

// ✅ Add test case
export const addTestCase = async (
  problemId: string,
  input: string,
  expectedOutput: string,
  isHidden = false
) => {
  const problem = await repo().findOneBy({ id: problemId });
  if (!problem) throw { status: 404, message: "Problem not found" };

  const tc = tcRepo().create({ input, expectedOutput, isHidden, problem });
  return await tcRepo().save(tc);
};

// ✅ Update problem (Organizer owns it)
export const updateProblem = async (id: string, userId: string, data: any) => {
  const problem = await repo().findOne({
    where: { id },
    relations: ["createdBy"],
  });
  if (!problem) throw { status: 404, message: "Problem not found" };

  if (problem.createdBy.id !== userId)
    throw { status: 403, message: "Access denied" };

  const normalizedTags = normalizeTags(data.tags);
  if (normalizedTags) data.tags = normalizedTags;

  Object.assign(problem, data);
  return await repo().save(problem);
};

// ✅ Delete problem (Organizer owns it)
export const deleteProblem = async (id: string, userId: string) => {
  const problem = await repo().findOne({
    where: { id },
    relations: ["createdBy"],
  });
  if (!problem) throw { status: 404, message: "Problem not found" };
  if (problem.createdBy.id !== userId)
    throw { status: 403, message: "Access denied" };

  await repo().remove(problem);
  return { message: "Problem deleted successfully" };
};

// ✅ Update problem image URL (after Supabase upload)
export const updateProblemImage = async (id: string, imageUrl: string) => {
  const problem = await repo().findOneBy({ id });
  if (!problem) throw { status: 404, message: "Problem not found" };

  problem.imageUrl = imageUrl;
  return await repo().save(problem);
};

