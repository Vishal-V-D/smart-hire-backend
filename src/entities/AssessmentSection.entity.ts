import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
} from "typeorm";
import { Assessment } from "./Assessment.entity";
import { Question } from "./Question.entity";
import { SectionProblem } from "./SectionProblem.entity";
import { SqlQuestion } from "./SqlQuestion.entity";
import { ColumnNumericTransformer } from "./AssessmentSubmission.entity";

export enum SectionType {
    APTITUDE = "aptitude",
    TECHNICAL = "technical",
    CODING = "coding",
    SQL = "sql",
    SUBJECTIVE = "subjective",
}

export enum SectionDifficulty {
    EASY = "Easy",
    MEDIUM = "Medium",
    HARD = "Hard",
    ADAPTIVE = "Adaptive",
}

export enum ThemeColor {
    GREEN = "green",
    PURPLE = "purple",
    BLUE = "blue",
    ORANGE = "orange",
    GRAY = "gray",
    CYAN = "cyan",
    RED = "red",
    TEAL = "teal",
}

@Entity("assessment_sections")
export class AssessmentSection {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    // Parent assessment
    @ManyToOne(() => Assessment, (assessment) => assessment.sections, {
        onDelete: "CASCADE",
    })
    assessment: Assessment;

    @Column({
        type: "enum",
        enum: SectionType,
        default: SectionType.TECHNICAL,
    })
    type: SectionType;

    @Column({ length: 100 })
    title: string;

    @Column({ type: "text", nullable: true })
    description: string;

    @Column({ nullable: true })
    emoji: string;

    @Column({ type: "int", default: 0 })
    questionCount: number;

    @Column({ type: "int", default: 1 })
    marksPerQuestion: number;

    // Time limit in minutes
    @Column({ type: "int", nullable: true })
    timeLimit: number;

    // Negative marking as decimal (0-1)
    @Column({ type: "decimal", precision: 3, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
    negativeMarking: number;

    // Calculated total marks for this section (sum of all question marks)
    @Column({ type: "int", default: 0 })
    totalMarks: number;

    @Column({
        type: "enum",
        enum: SectionDifficulty,
        default: SectionDifficulty.MEDIUM,
    })
    difficulty: SectionDifficulty;

    // Enabled patterns (array of pattern IDs)
    @Column({ type: "text", array: true, nullable: true })
    enabledPatterns: string[];

    @Column({
        type: "enum",
        enum: ThemeColor,
        default: ThemeColor.BLUE,
    })
    themeColor: ThemeColor;

    // Order for sorting sections
    @Column({ type: "int", default: 0 })
    order: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    // Questions in this section (MCQ, fill-in-blank, etc.)
    @OneToMany(() => Question, (question) => question.section, {
        cascade: true, // ✅ Allows saving nested questions
    })
    questions: Question[];

    // Coding problems in this section
    @OneToMany(() => SectionProblem, (sp) => sp.section, {
        cascade: true,
    })
    problems: SectionProblem[];

    // SQL questions in this section
    @OneToMany(() => SqlQuestion, (sqlQuestion) => sqlQuestion.section, {
        cascade: true,
    })
    sqlQuestions: SqlQuestion[];
}
