import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn
} from "typeorm";
import { User } from "./user.entity";
import { Company } from "./Company.entity";

export enum RequestAction {
    REGISTER_COMPANY = "REGISTER_COMPANY",
    APPROVE_COMPANY = "APPROVE_COMPANY",
    REJECT_COMPANY = "REJECT_COMPANY",
    REQUEST_ADMIN = "REQUEST_ADMIN",
    APPROVE_ADMIN = "APPROVE_ADMIN",
    REJECT_ADMIN = "REJECT_ADMIN",
    UPDATE_PERMISSIONS = "UPDATE_PERMISSIONS"
}

@Entity("company_request_logs")
export class CompanyRequestLog {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({
        type: "enum",
        enum: RequestAction
    })
    action: RequestAction;

    // Who performed the action (Organizer or Comapny Admin requesting)
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: "actorId" })
    actor: User;

    @Column({ nullable: true })
    actorId: string;

    // Target Company
    @ManyToOne(() => Company, { nullable: true, onDelete: "CASCADE" })
    @JoinColumn({ name: "companyId" })
    company: Company;

    @Column({ nullable: true })
    companyId: string;

    // Target User (for admin requests)
    @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "targetUserId" })
    targetUser: User;

    @Column({ nullable: true })
    targetUserId: string;

    // Details (e.g., rejection reason, permission changes)
    @Column("jsonb", { nullable: true })
    details: any;

    @CreateDateColumn()
    createdAt: Date;
}
