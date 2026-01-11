
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import { User } from "./user.entity";

export enum CompanyStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
}

@Entity("companies")
export class Company {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ unique: true })
    name: string;

    @Column({ type: "text", nullable: true })
    description: string;

    @Column({ nullable: true })
    website: string;

    @Column({ nullable: true })
    industry: string;

    @Column({ nullable: true })
    contactEmail: string;

    @Column({ nullable: true })
    contactPhone: string;

    @Column({
        type: "enum",
        enum: CompanyStatus,
        default: CompanyStatus.PENDING,
    })
    status: CompanyStatus;

    // Permissions granted by Organizer
    @Column("jsonb", { default: { createAssessment: false, deleteAssessment: false, viewAllAssessments: false } })
    permissions: {
        createAssessment: boolean;
        deleteAssessment: boolean;
        viewAllAssessments: boolean;
    };

    // The organizer/admin who approved this company
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: "approvedById" })
    approvedBy: User;

    @Column({ nullable: true })
    approvedById: string;

    // Users belonging to this company (Admins, Recruiters, etc.)
    @OneToMany(() => User, (user) => user.company, { cascade: true, onDelete: "CASCADE" })
    users: User[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
