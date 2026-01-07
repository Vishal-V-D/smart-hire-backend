
import { AppDataSource } from "./src/config/db";
import { Problem } from "./src/entities/problem.entity";

async function findProblem() {
    try {
        await AppDataSource.initialize();
        const problemRepo = AppDataSource.getRepository(Problem);
        const problems = await problemRepo.createQueryBuilder("problem")
            .where("problem.title ILIKE :title", { title: "%Three Sum%" })
            .orWhere("problem.slug ILIKE :slug", { slug: "%three-sum%" })
            .getMany();

        console.log("JSON_START");
        console.log(JSON.stringify(problems, null, 2));
        console.log("JSON_END");
    } catch (e) {
        console.error(e);
    } finally {
        await AppDataSource.destroy();
    }
}

findProblem();
