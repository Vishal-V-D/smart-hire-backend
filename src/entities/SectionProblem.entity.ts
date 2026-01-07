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

    @CreateDateColumn()
    createdAt: Date;
}
