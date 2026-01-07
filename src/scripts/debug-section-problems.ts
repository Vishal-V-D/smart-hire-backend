
import { AppDataSource } from "../config/db";
import { AssessmentSection } from "../entities/AssessmentSection.entity";
import { Question } from "../entities/Question.entity";
import { SectionProblem } from "../entities/SectionProblem.entity";
import { Problem } from "../entities/problem.entity";

const main = async () => {
    try {
        await AppDataSource.initialize();
        console.log("Database connected");

        const sectionId = "75f8be8b-9697-45e6-a29a-602b1a6c7d5e";

        // 1. Check Section
        const section = await AppDataSource.getRepository(AssessmentSection).findOne({
            where: { id: sectionId }
        });
        console.log("Section found:", section ? section.title : "No");

        // 2. Check Questions in this section
        const questions = await AppDataSource.getRepository(Question).find({
            where: { section: { id: sectionId } }
        });

        // 3. Check SectionProblems in this section
        const sectionProblems = await AppDataSource.getRepository(SectionProblem).find({
            where: { section: { id: sectionId } },
            relations: ["problem"]
        });

        // 4. Check if "Sliding Window Median" exists in Problem table
        const problem = await AppDataSource.getRepository(Problem).findOne({
            where: { title: "Sliding Window Median" }
        });

        const result = {
            section: section ? { id: section.id, title: section.title } : null,
            questions: questions.map(q => ({ id: q.id, text: q.text, type: q.type })),
            sectionProblems: sectionProblems.map(sp => ({ id: sp.id, problemTitle: sp.problem?.title })),
            checkProblem: problem ? { id: problem.id, title: problem.title } : null
        };

        const fs = require('fs');
        fs.writeFileSync('debug_result.json', JSON.stringify(result, null, 2));
        console.log("Debug result written to debug_result.json");

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await AppDataSource.destroy();
    }
};

main();
