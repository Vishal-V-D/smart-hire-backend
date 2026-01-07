import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
} from "typeorm";
import { Assessment } from "./Assessment.entity";

@Entity("assessment_otps")
export class AssessmentOTP {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    email: string;

    @Column()
    otp: string; // 6-digit code

    @ManyToOne(() => Assessment, { onDelete: "CASCADE" })
    assessment: Assessment;

    @Column({ type: "timestamp" })
    expiresAt: Date; // 10 minutes validity

    @Column({ default: false })
    verified: boolean;

    @CreateDateColumn()
    createdAt: Date;
}
