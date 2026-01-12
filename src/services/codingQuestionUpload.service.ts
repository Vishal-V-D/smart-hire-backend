import { AppDataSource } from "../config/db";
import { Problem, ProblemAccess } from "../entities/problem.entity";
import { User } from "../entities/user.entity";
import { SectionProblem } from "../entities/SectionProblem.entity";
import { AssessmentSection } from "../entities/AssessmentSection.entity";

const problemRepo = () => AppDataSource.getRepository(Problem);
const userRepo = () => AppDataSource.getRepository(User);
const sectionProblemRepo = () => AppDataSource.getRepository(SectionProblem);
const sectionRepo = () => AppDataSource.getRepository(AssessmentSection);

// Validation error interface
interface ValidationError {
    field: string;
    message: string;
}

// Upload result interface
interface UploadResult {
    success: boolean;
    problem?: Problem;
    errors?: ValidationError[];
}

// Bulk upload result
interface BulkUploadResult {
    total: number;
    success: number;
    failed: number;
    problems: Problem[];
    errors: Array<{ index: number; errors: ValidationError[] }>;
}

/**
 * Generate slug from title
 */
const generateSlug = (title: string): string => {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "") // Remove special characters
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .replace(/-+/g, "-"); // Replace multiple hyphens with single
};

/**
 * Validate coding question JSON data
 */
export const validateCodingQuestion = (data: any): ValidationError[] => {
    const errors: ValidationError[] = [];

    // Required fields
    if (!data.QuestionTitle && !data.questionTitle && !data.title) {
        errors.push({ field: "QuestionTitle", message: "Question title is required" });
    }

    if (!data.Content && !data.content && !data.description) {
        errors.push({ field: "Content", message: "Question content/description is required" });
    }

    // Validate difficulty if provided
    const difficulty = data.Difficulty || data.difficulty;
    if (difficulty && !["Easy", "Medium", "Hard"].includes(difficulty)) {
        errors.push({ field: "Difficulty", message: "Difficulty must be Easy, Medium, or Hard" });
    }

    return errors;
};

/**
 * Upload a single coding question from JSON
 */
export const uploadCodingQuestion = async (
    data: any,
    creatorId: string
): Promise<UploadResult> => {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📥 [CODING_QUESTION_SERVICE] Processing upload...`);
    console.log(`${"=".repeat(60)}`);

    // Log incoming data structure
    console.log(`\n📋 [INCOMING_DATA] Keys received:`, Object.keys(data));
    console.log(`   Creator ID: ${creatorId}`);

    // Validate
    console.log(`\n🔍 [VALIDATION] Checking required fields...`);
    const errors = validateCodingQuestion(data);
    if (errors.length > 0) {
        console.log(`   ❌ Validation failed:`, errors);
        return { success: false, errors };
    }
    console.log(`   ✅ Validation passed`);

    // Get creator
    console.log(`\n👤 [CREATOR] Looking up user: ${creatorId}`);
    const creator = await userRepo().findOneBy({ id: creatorId });
    if (!creator) {
        console.log(`   ❌ Creator not found!`);
        return { success: false, errors: [{ field: "creatorId", message: "Creator not found" }] };
    }
    console.log(`   ✅ Creator found: ${creator.email || creator.username}`);

    // Extract and normalize data (handle different casing)
    const title = data.QuestionTitle || data.questionTitle || data.title;
    const titleSlug = data.TitleSlug || data.titleSlug || generateSlug(title);
    const description = data.Content || data.content || data.description;
    const difficulty = data.Difficulty || data.difficulty;
    const topicTags = data.TopicTags || data.topicTags || [];

    console.log(`\n📝 [EXTRACTED_DATA]`);
    console.log(`   Title: "${title}"`);
    console.log(`   Slug: "${titleSlug}"`);
    console.log(`   Difficulty: ${difficulty || "Not specified"}`);
    console.log(`   Description length: ${description?.length || 0} chars`);
    console.log(`   Topic Tags: ${JSON.stringify(topicTags)}`);

    // Function names
    const pythonFunctionName = data.pythonFunctionName || data.PythonFunctionName || "";
    const cppFunctionName = data.CppFunctionName || data.cppFunctionName || "";
    const javaFunctionName = data.javaFunctionName || data.JavaFunctionName || "";

    console.log(`\n⚙️ [FUNCTION_NAMES]`);
    console.log(`   Python: "${pythonFunctionName || "N/A"}"`);
    console.log(`   C++: "${cppFunctionName || "N/A"}"`);
    console.log(`   Java: "${javaFunctionName || "N/A"}"`);

    // Solutions
    const solutions = data.Solution || data.solution || data.solutions || {};
    console.log(`\n💡 [SOLUTIONS]`);
    console.log(`   Python: ${solutions.python ? `${solutions.python.length} chars` : "Not provided"}`);
    console.log(`   C++: ${solutions["c++"] ? `${solutions["c++"].length} chars` : "Not provided"}`);
    console.log(`   Java: ${solutions.java ? `${solutions.java.length} chars` : "Not provided"}`);

    // Testcases
    const exampleTestcases = data.ExampleTestcaseList || data.exampleTestcases || data.exampleTestcaseList || [];
    const hiddenTestcases = data.HiddenTestcaseList || data.hiddenTestcases || data.hiddenTestcaseList || [];

    console.log(`\n🧪 [TESTCASES]`);
    console.log(`   Example testcases: ${exampleTestcases.length}`);
    console.log(`   Hidden testcases: ${hiddenTestcases.length}`);
    if (exampleTestcases.length > 0) {
        console.log(`   First example input preview: "${exampleTestcases[0]?.input?.substring(0, 50)}..."`);
    }

    // Driver and Starter code
    const driverCode = data.DriverCode || data.driverCode || {};
    const starterCode = data.StarterCode || data.starterCode || {};

    console.log(`\n📄 [DRIVER_CODE]`);
    console.log(`   Python: ${driverCode.python ? `${driverCode.python.length} chars` : "Not provided"}`);
    console.log(`   C++: ${driverCode["c++"] ? `${driverCode["c++"].length} chars` : "Not provided"}`);
    console.log(`   Java: ${driverCode.java ? `${driverCode.java.length} chars` : "Not provided"}`);

    console.log(`\n📝 [STARTER_CODE]`);
    console.log(`   Python: ${starterCode.python ? `${starterCode.python.length} chars` : "Not provided"}`);
    console.log(`   C++: ${starterCode["c++"] ? `${starterCode["c++"].length} chars` : "Not provided"}`);
    console.log(`   Java: ${starterCode.java ? `${starterCode.java.length} chars` : "Not provided"}`);

    // Tags from topic tags
    const tags = topicTags.map((t: any) => t.name || t);
    console.log(`\n🏷️ [TAGS] Extracted: ${JSON.stringify(tags)}`);

    // Check if slug already exists
    console.log(`\n🔎 [DUPLICATE_CHECK] Checking if slug "${titleSlug}" exists...`);
    const existing = await problemRepo().findOneBy({ titleSlug });
    if (existing) {
        console.log(`   ❌ Duplicate found! Problem ID: ${existing.id}`);
        return {
            success: false,
            errors: [{ field: "TitleSlug", message: `Problem with slug '${titleSlug}' already exists` }]
        };
    }
    console.log(`   ✅ Slug is unique`);

    // Create problem
    console.log(`\n💾 [DATABASE] Creating problem entity...`);
    const problem = problemRepo().create({
        title,
        titleSlug,
        description,
        difficulty,
        tags,
        topicTags,
        pythonFunctionName,
        cppFunctionName,
        javaFunctionName,
        solutions,
        exampleTestcases,
        hiddenTestcases,
        driverCode,
        starterCode,
        createdBy: creator,
        accessType: data.accessType || ProblemAccess.PRIVATE,
    });

    console.log(`\n💾 [DATABASE] Saving to database...`);
    const saved = await problemRepo().save(problem);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ [SUCCESS] Problem created successfully!`);
    console.log(`   ID: ${saved.id}`);
    console.log(`   Title: ${saved.title}`);
    console.log(`   Slug: ${saved.titleSlug}`);
    console.log(`${"=".repeat(60)}\n`);

    return { success: true, problem: saved as Problem };
};

/**
 * Bulk upload coding questions from JSON array
 */
export const uploadCodingQuestionsBulk = async (
    questions: any[],
    creatorId: string
): Promise<BulkUploadResult> => {
    const result: BulkUploadResult = {
        total: questions.length,
        success: 0,
        failed: 0,
        problems: [],
        errors: [],
    };

    for (let i = 0; i < questions.length; i++) {
        const uploadResult = await uploadCodingQuestion(questions[i], creatorId);

        if (uploadResult.success && uploadResult.problem) {
            result.success++;
            result.problems.push(uploadResult.problem);
        } else {
            result.failed++;
            result.errors.push({ index: i, errors: uploadResult.errors || [] });
        }
    }

    return result;
};

/**
 * List coding questions with filters and pagination
 */
export const listCodingQuestions = async (options: {
    userId?: string;
    difficulty?: string;
    tags?: string[];
    search?: string;
    skip?: number;
    take?: number;
}) => {
    const { userId, difficulty, tags, search, skip = 0, take = 20 } = options;

    const query = problemRepo().createQueryBuilder("problem")
        .leftJoinAndSelect("problem.createdBy", "creator");

    // Filter by access (public or owned OR admin override)
    let hasFullAccess = false;

    if (userId) {
        // Check for admin permission
        const user = await userRepo().findOne({ where: { id: userId }, relations: ["company"] });

        if (user?.role === "ORGANIZER" || (user?.role === "ADMIN" && user.company?.permissions?.createAssessment)) {
            hasFullAccess = true;
        }

        if (hasFullAccess) {
            // Admin/Organizer can see ALL problems (no restriction on createdBy)
            // We still might want to filter by public/private if needed, but usually they want to seclect from ALL
        } else {
            // Regular user: Public OR Owned
            query.where(
                "(problem.accessType = :public OR problem.createdBy.id = :userId)",
                { public: ProblemAccess.PUBLIC, userId }
            );
        }
    } else {
        // Guest: Public only
        query.where("problem.accessType = :public", { public: ProblemAccess.PUBLIC });
    }

    // Filter by difficulty
    if (difficulty) {
        query.andWhere("problem.difficulty = :difficulty", { difficulty });
    }

    // Filter by tags
    if (tags && tags.length > 0) {
        console.log(`   🏷️ Filtering by tags:`, tags);

        // Convert frontend tags (kebab-case) to match database format
        // e.g., "sliding-window" -> "Sliding Window"
        const normalizedTags = tags.map(tag => {
            // Convert kebab-case to Title Case with spaces
            return tag
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
        });

        console.log(`   🔄 Normalized tags:`, normalizedTags);

        // Use ILIKE for case-insensitive matching on JSONB array
        // Check both tags array and topicTags array
        // Note: PostgreSQL column names are case-sensitive, need quotes for camelCase
        const tagConditions = normalizedTags.map((tag, index) => {
            return `(
                problem.tags::text ILIKE '%"${tag}"%' OR 
                problem."topicTags"::text ILIKE '%"${tag}"%'
            )`;
        }).join(' OR ');

        query.andWhere(`(${tagConditions})`);
    }

    // Search by title or description
    if (search) {
        query.andWhere(
            "(problem.title ILIKE :search OR problem.description ILIKE :search)",
            { search: `%${search}%` }
        );
    }

    // Order by creation date
    query.orderBy("problem.createdAt", "DESC");

    // Pagination
    query.skip(skip).take(take);

    const [problems, total] = await query.getManyAndCount();

    return { problems, total, skip, take };
};

/**
 * Get a single coding question by ID
 */
export const getCodingQuestionById = async (id: string, userId?: string) => {
    const problem = await problemRepo().findOne({
        where: { id },
        relations: ["createdBy", "testcases"],
    });

    if (!problem) {
        throw { status: 404, message: "Coding question not found" };
    }

    // Check access
    if (problem.accessType === ProblemAccess.PRIVATE && problem.createdBy?.id !== userId) {
        throw { status: 403, message: "Access denied" };
    }

    return problem;
};

/**
 * Get a coding question by slug
 */
export const getCodingQuestionBySlug = async (slug: string, userId?: string) => {
    const problem = await problemRepo().findOne({
        where: { titleSlug: slug },
        relations: ["createdBy", "testcases"],
    });

    if (!problem) {
        throw { status: 404, message: "Coding question not found" };
    }

    // Check access
    if (problem.accessType === ProblemAccess.PRIVATE && problem.createdBy?.id !== userId) {
        throw { status: 403, message: "Access denied" };
    }

    return problem;
};

/**
 * Update a coding question
 */
export const updateCodingQuestion = async (id: string, data: any, userId: string) => {
    const problem = await problemRepo().findOne({
        where: { id },
        relations: ["createdBy"],
    });

    if (!problem) {
        throw { status: 404, message: "Coding question not found" };
    }

    if (problem.createdBy?.id !== userId) {
        throw { status: 403, message: "Access denied" };
    }

    // Update fields
    if (data.QuestionTitle || data.title) {
        problem.title = data.QuestionTitle || data.title;
    }
    if (data.TitleSlug || data.titleSlug) {
        problem.titleSlug = data.TitleSlug || data.titleSlug;
    }
    if (data.Content || data.description) {
        problem.description = data.Content || data.description;
    }
    if (data.Difficulty || data.difficulty) {
        problem.difficulty = data.Difficulty || data.difficulty;
    }
    if (data.TopicTags || data.topicTags) {
        problem.topicTags = data.TopicTags || data.topicTags;
    }
    if (data.Solution || data.solutions) {
        problem.solutions = data.Solution || data.solutions;
    }
    if (data.ExampleTestcaseList || data.exampleTestcases) {
        problem.exampleTestcases = data.ExampleTestcaseList || data.exampleTestcases;
    }
    if (data.HiddenTestcaseList || data.hiddenTestcases) {
        problem.hiddenTestcases = data.HiddenTestcaseList || data.hiddenTestcases;
    }
    if (data.DriverCode || data.driverCode) {
        problem.driverCode = data.DriverCode || data.driverCode;
    }
    if (data.StarterCode || data.starterCode) {
        problem.starterCode = data.StarterCode || data.starterCode;
    }

    return await problemRepo().save(problem);
};

/**
 * Delete a coding question
 */
export const deleteCodingQuestion = async (id: string, userId: string) => {
    const problem = await problemRepo().findOne({
        where: { id },
        relations: ["createdBy"],
    });

    if (!problem) {
        throw { status: 404, message: "Coding question not found" };
    }

    if (problem.createdBy?.id !== userId) {
        throw { status: 403, message: "Access denied" };
    }

    await problemRepo().remove(problem);
    return { message: "Coding question deleted successfully" };
};

/**
 * Add a coding problem to a section
 */
export const addProblemToSection = async (
    sectionId: string,
    problemId: string,
    marks?: number,
    order?: number
) => {
    const section = await sectionRepo().findOneBy({ id: sectionId });
    if (!section) {
        throw { status: 404, message: "Section not found" };
    }

    const problem = await problemRepo().findOneBy({ id: problemId });
    if (!problem) {
        throw { status: 404, message: "Problem not found" };
    }

    // Check if already added
    const existing = await sectionProblemRepo().findOne({
        where: { section: { id: sectionId }, problem: { id: problemId } },
    });
    if (existing) {
        throw { status: 400, message: "Problem already added to this section" };
    }

    // Get max order if not provided
    if (order === undefined) {
        const maxOrder = await sectionProblemRepo()
            .createQueryBuilder("sp")
            .where("sp.section.id = :sectionId", { sectionId })
            .select("MAX(sp.order)", "max")
            .getRawOne();
        order = (maxOrder?.max || 0) + 1;
    }

    const sectionProblem = sectionProblemRepo().create({
        section,
        problem,
        marks,
        order,
    });

    return await sectionProblemRepo().save(sectionProblem);
};

/**
 * Remove a coding problem from a section
 */
export const removeProblemFromSection = async (sectionId: string, problemId: string) => {
    const sectionProblem = await sectionProblemRepo().findOne({
        where: { section: { id: sectionId }, problem: { id: problemId } },
    });

    if (!sectionProblem) {
        throw { status: 404, message: "Problem not found in section" };
    }

    await sectionProblemRepo().remove(sectionProblem);
    return { message: "Problem removed from section" };
};

/**
 * Get problems in a section
 */
export const getSectionProblems = async (sectionId: string) => {
    const sectionProblems = await sectionProblemRepo().find({
        where: { section: { id: sectionId } },
        relations: ["problem", "problem.createdBy"],
        order: { order: "ASC" },
    });

    return sectionProblems;
};

/**
 * Get all unique tags from coding questions
 */
export const getAllTags = async (): Promise<string[]> => {
    console.log(`\n🏷️ [CODING_QUESTIONS] Getting all unique tags...`);

    const problems = await problemRepo().find({
        select: ["tags", "topicTags"],
    });

    // Collect all tags
    const tagsSet = new Set<string>();

    problems.forEach((problem) => {
        // Add tags from tags array
        if (problem.tags && Array.isArray(problem.tags)) {
            problem.tags.forEach((tag) => tagsSet.add(tag));
        }

        // Add tags from topicTags array
        if (problem.topicTags && Array.isArray(problem.topicTags)) {
            problem.topicTags.forEach((topicTag: any) => {
                if (topicTag.name) {
                    tagsSet.add(topicTag.name);
                }
            });
        }
    });

    const uniqueTags = Array.from(tagsSet).sort();

    console.log(`   Found ${uniqueTags.length} unique tags:`, uniqueTags);

    return uniqueTags;
};

