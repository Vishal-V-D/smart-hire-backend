import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
} from "typeorm";
import { AssessmentSection } from "./AssessmentSection.entity";
import { Problem } from "./problem.entity";

/**
 * Configuration for which test cases to use in this assessment
 */
export interface TestCaseConfig {
    // Option 1: Use a continuous range
    exampleRange?: {
        start: number;  // 0-based index (inclusive)
        end: number;    // 0-based index (inclusive)
    };
    hiddenRange?: {
        start: number;
        end: number;
    };

    // Option 2: Use specific indices (non-continuous)
    exampleIndices?: number[];  // e.g., [0, 2, 5, 7]
    hiddenIndices?: number[];   // e.g., [1, 3, 8, 12, 15]
}

/**
 * Join table to link Problems (coding questions) to AssessmentSections.
 * This allows coding problems to be added to assessment sections
 * similar to how Questions work for MCQ/fill-in-blank types.
 */
@Entity("section_problems")
export class SectionProblem {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    // Parent section
    @ManyToOne(() => AssessmentSection, (section) => section.problems, {
        onDelete: "CASCADE",
    })
    section: AssessmentSection;

    // Linked problem (coding question)
    @ManyToOne(() => Problem, { onDelete: "CASCADE", eager: true })
    problem: Problem;

    // Order for sorting within section
    @Column({ type: "int", default: 0 })
    order: number;

    // Override marks for this problem in this section (optional)
    @Column({ type: "int", nullable: true })
    marks: number;

    // 🎯 Assessment-specific test case configuration
    // If null, use ALL test cases from the problem
    @Column({ type: "jsonb", nullable: true })
    testCaseConfig?: TestCaseConfig | null;

    @CreateDateColumn()
    createdAt: Date;
}
