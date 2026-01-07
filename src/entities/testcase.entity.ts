import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { Problem } from "./problem.entity";

@Entity("testcases")
export class TestCase {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("text")
  input: string;

  @Column("text")
  expectedOutput: string;

  @Column({ default: false })
  isHidden: boolean;

  @ManyToOne(() => Problem, (p) => p.testcases, { onDelete: "CASCADE" })
  problem: Problem;
}
