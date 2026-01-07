import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { User } from "./user.entity";
import { TestCase } from "./testcase.entity";
import { ContestProblem } from "./contestProblem.entity";

export enum ProblemAccess {
  PUBLIC = "PUBLIC",
  PRIVATE = "PRIVATE",
}

@Entity("problems")
export class Problem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  title: string;

  @Column("text")
  description: string;

  @Column({ nullable: true })
  difficulty: string;

  @Column({ nullable: true })
  constraints: string;

  @Column({ nullable: true })
  inputFormat: string;

  @Column({ nullable: true })
  outputFormat: string;

  @Column({ nullable: true })
  additionalInfo: string;

  @Column("text", { array: true, nullable: true })
  tags?: string[];

  // 👇 Examples with input, output, and explanation (dynamic array)
  @Column({ type: "jsonb", nullable: true, default: [] })
  examples?: Array<{
    input: string;
    output: string;
    explanation: string;
    imageUrl?: string; // Optional image URL for this example
  }>;

  // 👇 Optional image URL (uploaded to Supabase)
  @Column({ type: "varchar", length: 500, nullable: true })
  imageUrl?: string;

  // 👇 Organizer who created this problem
  @ManyToOne(() => User, { onDelete: "SET NULL", eager: true })
  createdBy: User;

  // 👇 Whether the problem is visible to all or restricted
  @Column({
    type: "enum",
    enum: ProblemAccess,
    default: ProblemAccess.PRIVATE,
  })
  accessType: ProblemAccess;

  // 👇 Whether the problem has a constrained template (stricter plagiarism check)
  @Column({ default: false })
  templateConstrained: boolean;

  // 👇 URL-friendly slug for the problem title
  @Column({ nullable: true, unique: true })
  titleSlug: string;

  // 👇 Topic tags for categorization (e.g., [{ name: "Sliding Window", slug: "sliding-window" }])
  @Column({ type: "jsonb", nullable: true, default: [] })
  topicTags?: Array<{ name: string; slug: string }>;

  // 👇 Function names for each language
  @Column({ nullable: true })
  pythonFunctionName: string;

  @Column({ nullable: true })
  cppFunctionName: string;

  @Column({ nullable: true })
  javaFunctionName: string;

  // 👇 Solutions in multiple languages
  @Column({ type: "jsonb", nullable: true })
  solutions?: {
    python?: string;
    "c++"?: string;
    java?: string;
  };

  // 👇 Example testcases (visible to users)
  @Column({ type: "jsonb", nullable: true, default: [] })
  exampleTestcases?: Array<{ input: string; output: string }>;

  // 👇 Hidden testcases for evaluation
  @Column({ type: "jsonb", nullable: true, default: [] })
  hiddenTestcases?: Array<{ input: string; output: string }>;

  // 👇 Driver code for each language (boilerplate to run user's code)
  @Column({ type: "jsonb", nullable: true })
  driverCode?: {
    python?: string;
    "c++"?: string;
    java?: string;
  };

  // 👇 Starter code for each language (initial template shown to users)
  @Column({ type: "jsonb", nullable: true })
  starterCode?: {
    python?: string;
    "c++"?: string;
    java?: string;
  };

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => TestCase, (t) => t.problem)
  testcases: TestCase[];

  @OneToMany(() => ContestProblem, (cp) => cp.problem)
  contestProblems: ContestProblem[];
}
