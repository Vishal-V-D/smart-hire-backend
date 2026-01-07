import { AppDataSource } from "../config/db";
import { Question, QuestionDifficulty, QuestionType } from "../entities/Question.entity";
import { ILike } from "typeorm";

const repo = () => AppDataSource.getRepository(Question);

/**
 * List questions with advanced filtering
 */
export interface QuestionBankFilters {
    division?: string;
    subdivision?: string;
    subdivisions?: string[];  // Array of subdivisions to match (OR logic)
    topic?: string;
    tags?: string[];  // Array of tags to match (OR logic)
    difficulty?: QuestionDifficulty;
    type?: QuestionType;
    search?: string;  // Search in question text
    page?: number;
    limit?: number;
}

export const listQuestions = async (filters: QuestionBankFilters = {}) => {
    const {
        division,
        subdivision,
        subdivisions,
        topic,
        tags,
        difficulty,
        type,
        search,
        page = 1,
        limit = 50
    } = filters;

    console.log("🔍 [SERVICE] Building query with filters:", {
        division,
        subdivision,
        subdivisions,
        topic,
        tags,
        difficulty,
        type,
        search,
        page,
        limit
    });

    const queryBuilder = repo()
        .createQueryBuilder("question")
        .where("question.section IS NULL"); // Only standalone questions

    console.log("📝 [SERVICE] Base query: question.section IS NULL");

    // Apply filters
    if (division) {
        queryBuilder.andWhere("question.division = :division", { division });
        console.log(`📝 [SERVICE] Added filter: division = "${division}"`);
    }

    if (subdivision) {
        queryBuilder.andWhere("question.subdivision = :subdivision", { subdivision });
        console.log(`📝 [SERVICE] Added filter: subdivision = "${subdivision}"`);
    }

    // Handle multiple subdivisions (OR logic - match any)
    if (subdivisions && subdivisions.length > 0) {
        queryBuilder.andWhere("question.subdivision IN (:...subdivisions)", { subdivisions });
        console.log(`📝 [SERVICE] Added filter: subdivision IN [${subdivisions.join(", ")}]`);
    }

    if (topic) {
        queryBuilder.andWhere("question.topic ILIKE :topic", { topic: `%${topic}%` });
        console.log(`📝 [SERVICE] Added filter: topic ILIKE "%${topic}%"`);
    }

    if (difficulty) {
        queryBuilder.andWhere("question.difficulty = :difficulty", { difficulty });
        console.log(`📝 [SERVICE] Added filter: difficulty = "${difficulty}"`);
    }

    if (type) {
        queryBuilder.andWhere("question.type = :type", { type });
        console.log(`📝 [SERVICE] Added filter: type = "${type}"`);
    }

    if (tags && tags.length > 0) {
        // Match any of the provided tags (OR logic)
        queryBuilder.andWhere("question.tags && :tags", { tags });
        console.log(`📝 [SERVICE] Added filter: tags && [${tags.join(", ")}]`);
    }

    if (search) {
        queryBuilder.andWhere("question.text ILIKE :search", { search: `%${search}%` });
        console.log(`📝 [SERVICE] Added filter: text ILIKE "%${search}%"`);
    }

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Order by order field (S.No from CSV)
    queryBuilder.orderBy("question.order", "ASC");

    // Log the SQL query
    const sql = queryBuilder.getSql();
    console.log("🔍 [SERVICE] Generated SQL:", sql);

    const [questions, total] = await queryBuilder.getManyAndCount();

    console.log("✅ [SERVICE] Query results:", {
        found: questions.length,
        total: total,
        sampleQuestion: questions[0] ? {
            id: questions[0].id,
            division: questions[0].division,
            subdivision: questions[0].subdivision,
            topic: questions[0].topic
        } : null
    });

    return {
        questions,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

/**
 * Get question by ID
 */
export const getQuestionById = async (id: string) => {
    const question = await repo().findOne({
        where: { id, section: null as any } // Only standalone questions
    });

    if (!question) {
        throw { status: 404, message: "Question not found" };
    }

    return question;
};

/**
 * Update question
 */
export const updateQuestion = async (id: string, data: any) => {
    const question = await getQuestionById(id);

    // Validate data
    if (data.text !== undefined) {
        if (data.text.length < 10 || data.text.length > 2000) {
            throw { status: 400, message: "Question text must be between 10 and 2000 characters" };
        }
    }

    if (data.options !== undefined) {
        if (!Array.isArray(data.options) || data.options.length < 2 || data.options.length > 6) {
            throw { status: 400, message: "Options must be an array with 2-6 items" };
        }
    }

    // Don't allow changing section
    delete data.section;

    // Update question
    Object.assign(question, data);
    return await repo().save(question);
};

/**
 * Delete question
 */
export const deleteQuestion = async (id: string) => {
    const question = await getQuestionById(id);
    await repo().remove(question);
    return { message: "Question deleted successfully" };
};

/**
 * Get question statistics
 */
export const getStats = async () => {
    console.log("📊 [STATS] Fetching question statistics...");

    // Total count
    const total = await repo()
        .createQueryBuilder("question")
        .where("question.section IS NULL")
        .getCount();

    // Count by division
    const byDivisionRaw = await repo()
        .createQueryBuilder("question")
        .select("question.division", "division")
        .addSelect("COUNT(*)", "count")
        .where("question.section IS NULL")
        .andWhere("question.division IS NOT NULL")
        .groupBy("question.division")
        .getRawMany();

    const byDivision: Record<string, number> = {};
    byDivisionRaw.forEach(r => { byDivision[r.division] = parseInt(r.count); });

    // Count by difficulty
    const byDifficultyRaw = await repo()
        .createQueryBuilder("question")
        .select("question.difficulty", "difficulty")
        .addSelect("COUNT(*)", "count")
        .where("question.section IS NULL")
        .andWhere("question.difficulty IS NOT NULL")
        .groupBy("question.difficulty")
        .getRawMany();

    const byDifficulty: Record<string, number> = {};
    byDifficultyRaw.forEach(r => { byDifficulty[r.difficulty] = parseInt(r.count); });

    // Count by type
    const byTypeRaw = await repo()
        .createQueryBuilder("question")
        .select("question.type", "type")
        .addSelect("COUNT(*)", "count")
        .where("question.section IS NULL")
        .groupBy("question.type")
        .getRawMany();

    const byType: Record<string, number> = {};
    byTypeRaw.forEach(r => { byType[r.type] = parseInt(r.count); });

    // Count by subdivision
    const bySubdivisionRaw = await repo()
        .createQueryBuilder("question")
        .select("question.subdivision", "subdivision")
        .addSelect("COUNT(*)", "count")
        .where("question.section IS NULL")
        .andWhere("question.subdivision IS NOT NULL")
        .groupBy("question.subdivision")
        .getRawMany();

    const bySubdivision: Record<string, number> = {};
    bySubdivisionRaw.forEach(r => { bySubdivision[r.subdivision] = parseInt(r.count); });

    // Count by topic
    const byTopicRaw = await repo()
        .createQueryBuilder("question")
        .select("question.topic", "topic")
        .addSelect("COUNT(*)", "count")
        .where("question.section IS NULL")
        .andWhere("question.topic IS NOT NULL")
        .groupBy("question.topic")
        .getRawMany();

    const byTopic: Record<string, number> = {};
    byTopicRaw.forEach(r => { byTopic[r.topic] = parseInt(r.count); });

    const stats = {
        total,
        byDivision,
        byDifficulty,
        byType,
        bySubdivision,
        byTopic
    };

    console.log("✅ [STATS] Statistics computed:", JSON.stringify(stats, null, 2));

    return stats;
};

/**
 * Bulk delete questions
 * @param ids - Array of question IDs to delete
 * @param filter - Filter criteria (division, subdivision, difficulty, topic)
 */
export interface BulkDeleteFilter {
    division?: string;
    subdivision?: string;
    difficulty?: string;
    topic?: string;
}

export const bulkDelete = async (ids?: string[], filter?: BulkDeleteFilter) => {
    console.log("🗑️  [BULK_DELETE] Request:", { ids: ids?.length || 0, filter });

    if (ids && ids.length > 0) {
        // Delete by IDs
        const result = await repo()
            .createQueryBuilder()
            .delete()
            .from(Question)
            .where("id IN (:...ids)", { ids })
            .andWhere("section IS NULL") // Only standalone questions
            .execute();

        console.log(`✅ [BULK_DELETE] Deleted ${result.affected} questions by IDs`);
        return { deleted: result.affected || 0, message: `${result.affected} questions deleted successfully` };
    }

    if (filter && Object.keys(filter).length > 0) {
        // Delete by filter
        const queryBuilder = repo()
            .createQueryBuilder()
            .delete()
            .from(Question)
            .where("section IS NULL"); // Only standalone questions

        if (filter.division) {
            queryBuilder.andWhere("division = :division", { division: filter.division });
        }
        if (filter.subdivision) {
            queryBuilder.andWhere("subdivision = :subdivision", { subdivision: filter.subdivision });
        }
        if (filter.difficulty) {
            queryBuilder.andWhere("difficulty = :difficulty", { difficulty: filter.difficulty });
        }
        if (filter.topic) {
            queryBuilder.andWhere("topic = :topic", { topic: filter.topic });
        }

        const result = await queryBuilder.execute();

        console.log(`✅ [BULK_DELETE] Deleted ${result.affected} questions by filter`);
        return { deleted: result.affected || 0, message: `${result.affected} questions deleted successfully` };
    }

    throw { status: 400, message: "Either 'ids' array or 'filter' object is required" };
};

/**
 * Get unique filter values for frontend dropdowns
 * @param division - Optional division to filter subdivisions/topics by
 * @param subdivision - Optional subdivision to filter topics/tags by (requires division)
 */
export const getFilterOptions = async (division?: string, subdivision?: string) => {
    const divisions = await repo()
        .createQueryBuilder("question")
        .select("DISTINCT question.division", "value")
        .where("question.section IS NULL")
        .andWhere("question.division IS NOT NULL")
        .getRawMany();

    // Build subdivisions query - filter by division if provided
    const subdivisionsQuery = repo()
        .createQueryBuilder("question")
        .select("DISTINCT question.subdivision", "value")
        .where("question.section IS NULL")
        .andWhere("question.subdivision IS NOT NULL");

    if (division) {
        subdivisionsQuery.andWhere("question.division = :division", { division });
    }
    const subdivisions = await subdivisionsQuery.getRawMany();

    // Build topics query - filter by division and/or subdivision if provided
    const topicsQuery = repo()
        .createQueryBuilder("question")
        .select("DISTINCT question.topic", "value")
        .where("question.section IS NULL")
        .andWhere("question.topic IS NOT NULL");

    if (division) {
        topicsQuery.andWhere("question.division = :division", { division });
    }
    if (subdivision) {
        topicsQuery.andWhere("question.subdivision = :subdivision", { subdivision });
    }
    const topics = await topicsQuery.getRawMany();

    // Build tags query - filter by division and/or subdivision if provided
    const tagsQuery = repo()
        .createQueryBuilder("question")
        .select("DISTINCT unnest(question.tags)", "value")
        .where("question.section IS NULL")
        .andWhere("question.tags IS NOT NULL");

    if (division) {
        tagsQuery.andWhere("question.division = :division", { division });
    }
    if (subdivision) {
        tagsQuery.andWhere("question.subdivision = :subdivision", { subdivision });
    }
    const tags = await tagsQuery.getRawMany();

    const subdivisionValues = subdivisions.map(s => s.value);
    const topicValues = topics.map(t => t.value);
    const tagValues = tags.map(t => t.value);

    console.log(`\n📋 [FILTER_OPTIONS] Filters: division=${division || "ALL"}, subdivision=${subdivision || "ALL"}`);
    console.log(`   📂 Subdivisions (${subdivisionValues.length}):`, subdivisionValues);
    console.log(`   📚 Topics (${topicValues.length}):`, topicValues);
    console.log(`   🏷️  Tags (${tagValues.length}):`, tagValues);

    return {
        divisions: divisions.map(d => d.value),
        subdivisions: subdivisions.map(s => s.value),
        topics: topics.map(t => t.value),
        tags: tags.map(t => t.value),
        difficulties: Object.values(QuestionDifficulty),
        types: Object.values(QuestionType)
    };
};
