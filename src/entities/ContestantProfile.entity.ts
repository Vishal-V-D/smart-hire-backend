import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Assessment } from "./Assessment.entity";

@Entity("contestant_profiles")
export class ContestantProfile {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn()
    user: User;

    @ManyToOne(() => Assessment, { onDelete: "CASCADE" })
    assessment: Assessment;

    // Personal Details
    @Column()
    fullName: string;

    @Column()
    email: string;

    @Column({ nullable: true })
    college: string;

    @Column({ nullable: true })
    department: string;

    @Column({ nullable: true })
    registrationNumber: string;

    @Column({ type: "decimal", precision: 4, scale: 2, nullable: true })
    cgpa: number;

    // Document Uploads (Supabase URLs)
    @Column({ nullable: true })
    resumeUrl: string;

    @Column({ nullable: true })
    idCardUrl: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
