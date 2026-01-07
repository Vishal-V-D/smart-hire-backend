import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Assessment } from "./Assessment.entity";

export enum AccessType {
  WHOLE = "WHOLE", // Access to all assessments
  PARTIAL = "PARTIAL", // Access to specific assessments
}

@Entity("admin_assessment_access")
@Unique(["adminUserId", "assessmentId"])
@Index(["adminUserId", "organizerId"])
@Index(["assessmentId"])
export class AdminAssessmentAccess {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  adminUserId: string;

  @Column("uuid")
  organizerId: string;

  @Column("uuid", { nullable: true })
  assessmentId: string; // NULL if WHOLE access, specific ID if PARTIAL

  @Column({
    type: "enum",
    enum: AccessType,
    default: AccessType.PARTIAL,
  })
  accessType: AccessType;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "adminUserId" })
  admin: User;

  @ManyToOne(() => Assessment, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "assessmentId" })
  assessment: Assessment;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
