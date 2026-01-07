import { Entity, PrimaryGeneratedColumn, ManyToOne } from "typeorm";
import { Contest } from "./contest.entity";
import { Problem } from "./problem.entity";

@Entity("contest_problems")
export class ContestProblem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Contest, (c) => c.contestProblems, { onDelete: "CASCADE" })
  contest: Contest;

  @ManyToOne(() => Problem, (p) => p.contestProblems, { onDelete: "CASCADE" })
  problem: Problem;
}
