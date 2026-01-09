import { AppDataSource } from "../config/db";
import { SectionProblem, TestCaseConfig } from "../entities/SectionProblem.entity";
import { Problem } from "../entities/problem.entity";

const sectionProblemRepo = () => AppDataSource.getRepository(SectionProblem);

/**
 * Configure which test cases to use for a problem in a specific assessment
 * @param sectionProblemId - The ID of the SectionProblem link
 * @param config - Test case configuration (null = use all test cases)
 */
export const configureTestCases = async (
    sectionProblemId: string,
    config: TestCaseConfig | null
) => {
    console.log(`\n🎯 [TEST_CASE_CONFIG] Configuring test cases for section problem ${sectionProblemId}`);

    // Get the section problem with its linked problem AND assessment details for logging
    const sectionProblem = await sectionProblemRepo().findOne({
        where: { id: sectionProblemId },
        relations: ["problem", "section", "section.assessment"]
    });

    if (sectionProblem) {
        const assessmentTitle = sectionProblem.section?.assessment?.title || "Unknown Assessment";
        const sectionTitle = sectionProblem.section?.title || "Unknown Section";
        const problemTitle = sectionProblem.problem.title;

        console.log(`   📘 Assessment: "${assessmentTitle}"`);
        console.log(`   📂 Section:    "${sectionTitle}"`);
        console.log(`   💻 Problem:    "${problemTitle}"`);
    }

    if (!sectionProblem) {
        throw { status: 404, message: "Section problem not found" };
    }

    const problem = sectionProblem.problem;

    // If config is null, use all test cases (no validation needed)
    if (!config) {
        sectionProblem.testCaseConfig = null;
        await sectionProblemRepo().save(sectionProblem);

        console.log(`   ✅ Configuration cleared - will use ALL test cases`);
        console.log(`      Example: All ${problem.exampleTestcases?.length || 0} cases`);
        console.log(`      Hidden: All ${problem.hiddenTestcases?.length || 0} cases`);

        return {
            success: true,
            message: "Will use all test cases",
            totalExampleCases: problem.exampleTestcases?.length || 0,
            totalHiddenCases: problem.hiddenTestcases?.length || 0
        };
    }

    // Validate the configuration
    const exampleCount = problem.exampleTestcases?.length || 0;
    const hiddenCount = problem.hiddenTestcases?.length || 0;

    // Validate example range
    if (config.exampleRange) {
        const { start, end } = config.exampleRange;

        if (start < 0 || end >= exampleCount || start > end) {
            throw {
                status: 400,
                message: `Invalid example range [${start}, ${end}]. Problem has ${exampleCount} example test cases (valid: 0-${exampleCount - 1})`
            };
        }

        console.log(`   📊 Example Range: ${start} to ${end} (${end - start + 1} cases)`);
    }

    // Validate hidden range
    if (config.hiddenRange) {
        const { start, end } = config.hiddenRange;

        if (start < 0 || end >= hiddenCount || start > end) {
            throw {
                status: 400,
                message: `Invalid hidden range [${start}, ${end}]. Problem has ${hiddenCount} hidden test cases (valid: 0-${hiddenCount - 1})`
            };
        }

        console.log(`   📊 Hidden Range: ${start} to ${end} (${end - start + 1} cases)`);
    }

    // Validate example indices
    if (config.exampleIndices) {
        const invalidIndices = config.exampleIndices.filter(i => i < 0 || i >= exampleCount);

        if (invalidIndices.length > 0) {
            throw {
                status: 400,
                message: `Invalid example indices: [${invalidIndices.join(', ')}]. Valid range: 0-${exampleCount - 1}`
            };
        }

        console.log(`   📊 Example Indices: [${config.exampleIndices.join(', ')}] (${config.exampleIndices.length} cases)`);
    }

    // Validate hidden indices
    if (config.hiddenIndices) {
        const invalidIndices = config.hiddenIndices.filter(i => i < 0 || i >= hiddenCount);

        if (invalidIndices.length > 0) {
            throw {
                status: 400,
                message: `Invalid hidden indices: [${invalidIndices.join(', ')}]. Valid range: 0-${hiddenCount - 1}`
            };
        }

        console.log(`   📊 Hidden Indices: [${config.hiddenIndices.join(', ')}] (${config.hiddenIndices.length} cases)`);
    }

    // Save the configuration
    sectionProblem.testCaseConfig = config;
    await sectionProblemRepo().save(sectionProblem);

    // 🔍 Calculate and log what percentage will be used
    let exampleUsage = 100;
    let hiddenUsage = 100;
    let filteredExampleCount = exampleCount;
    let filteredHiddenCount = hiddenCount;

    if (config.exampleRange) {
        filteredExampleCount = config.exampleRange.end - config.exampleRange.start + 1;
        exampleUsage = Math.round((filteredExampleCount / exampleCount) * 100);
    } else if (config.exampleIndices) {
        filteredExampleCount = config.exampleIndices.length;
        exampleUsage = Math.round((filteredExampleCount / exampleCount) * 100);
    }

    if (config.hiddenRange) {
        filteredHiddenCount = config.hiddenRange.end - config.hiddenRange.start + 1;
        hiddenUsage = Math.round((filteredHiddenCount / hiddenCount) * 100);
    } else if (config.hiddenIndices) {
        filteredHiddenCount = config.hiddenIndices.length;
        hiddenUsage = Math.round((filteredHiddenCount / hiddenCount) * 100);
    }

    console.log(`   ✅ Test case configuration saved successfully`);
    console.log(`   📊 Assessment will use:`);
    console.log(`      Example: ${filteredExampleCount}/${exampleCount} cases (${exampleUsage}%)`);
    console.log(`      Hidden: ${filteredHiddenCount}/${hiddenCount} cases (${hiddenUsage}%)`);

    return {
        success: true,
        message: "Test case configuration saved",
        config: sectionProblem.testCaseConfig,
        problemTotalCases: {
            example: exampleCount,
            hidden: hiddenCount
        },
        usagePercentage: {
            example: exampleUsage,
            hidden: hiddenUsage
        }
    };
};

/**
 * Get the filtered test cases for a section problem based on its config
 * @param problem - The problem entity
 * @param config - Test case configuration
 * @returns Filtered test cases
 */
export const getFilteredTestCases = (
    problem: Problem,
    config: TestCaseConfig | null | undefined
) => {
    let exampleTestcases = problem.exampleTestcases || [];
    let hiddenTestcases = problem.hiddenTestcases || [];

    // If no config, return all test cases
    if (!config) {
        console.log(`   📋 No config - using ALL test cases (${exampleTestcases.length} example, ${hiddenTestcases.length} hidden)`);
        return { exampleTestcases, hiddenTestcases };
    }

    console.log(`   🎯 Applying test case filter...`);

    // Filter example test cases
    if (config.exampleRange) {
        const { start, end } = config.exampleRange;
        exampleTestcases = exampleTestcases.slice(start, end + 1);
        console.log(`      Example: Range [${start}, ${end}] → ${exampleTestcases.length} cases`);
    } else if (config.exampleIndices) {
        exampleTestcases = config.exampleIndices
            .map(i => exampleTestcases[i])
            .filter(tc => tc !== undefined);
        console.log(`      Example: Indices [${config.exampleIndices.join(', ')}] → ${exampleTestcases.length} cases`);
    }

    // Filter hidden test cases
    if (config.hiddenRange) {
        const { start, end } = config.hiddenRange;
        hiddenTestcases = hiddenTestcases.slice(start, end + 1);
        console.log(`      Hidden: Range [${start}, ${end}] → ${hiddenTestcases.length} cases`);
    } else if (config.hiddenIndices) {
        hiddenTestcases = config.hiddenIndices
            .map(i => hiddenTestcases[i])
            .filter(tc => tc !== undefined);
        console.log(`      Hidden: Indices [${config.hiddenIndices.join(', ')}] → ${hiddenTestcases.length} cases`);
    }

    return { exampleTestcases, hiddenTestcases };
};

/**
 * Get current test case configuration for a section problem
 */
export const getTestCaseConfig = async (sectionProblemId: string) => {
    const sectionProblem = await sectionProblemRepo().findOne({
        where: { id: sectionProblemId },
        relations: ["problem", "section", "section.assessment"]
    });

    if (sectionProblem) {
        console.log(`\n🔍 [TEST_CASE_VIEW] Fetching config for section problem ${sectionProblemId}`);
        console.log(`   📘 Assessment: "${sectionProblem.section?.assessment?.title || 'Unknown'}"`);
        console.log(`   📂 Section:    "${sectionProblem.section?.title || 'Unknown'}"`);
        console.log(`   💻 Problem:    "${sectionProblem.problem.title}"`);
    }

    if (!sectionProblem) {
        throw { status: 404, message: "Section problem not found" };
    }

    return {
        config: sectionProblem.testCaseConfig,
        problemTotalCases: {
            example: sectionProblem.problem.exampleTestcases?.length || 0,
            hidden: sectionProblem.problem.hiddenTestcases?.length || 0
        }
    };
};
