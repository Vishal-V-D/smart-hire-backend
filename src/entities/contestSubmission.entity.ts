import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from "typeorm";
import { Contest } from "./contest.entity";
import { User } from "./user.entity";
import { Problem } from "./problem.entity";

@Entity("contest_submissions")
export class ContestSubmission {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    contestId: string;

    @Column()
    userId: string;

    @Column()
    problemId: string;

    @Column("text")
    code: string;

    @Column()
    language: string;

    @Column({ default: false })
    isAutoSubmitted: boolean;

    @Column({ type: "jsonb", nullable: true })
    result: any; // Execution result

    @Column({ type: "int", default: 0 })
    score: number;

    @Column({ default: "pending" })
    status: string; // pending, accepted, wrong_answer, tle, etc.

    @Column({ type: "float", nullable: true })
    executionTime: number;

    @Column({ type: "float", nullable: true })
    memoryUsed: number;

    @Column({ type: "int", nullable: true })
    passedTests: number;

    @Column({ type: "int", nullable: true })
    totalTests: number;

    @Column({ type: "text", nullable: true })
    output: string;

    @CreateDateColumn()
    submittedAt: Date;

    @ManyToOne(() => Contest, { onDelete: "CASCADE" })
    @JoinColumn({ name: "contestId" })
    contest: Contest;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "userId" })
    user: User;

    @ManyToOne(() => Problem, { onDelete: "CASCADE" })
    @JoinColumn({ name: "problemId" })
    problem: Problem;
}
