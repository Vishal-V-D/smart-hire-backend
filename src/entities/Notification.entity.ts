import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index
} from "typeorm";
import { User } from "./user.entity"; // Assuming you have a User entity
import { Company } from "./Company.entity"; // Assuming you have a Company entity

export enum NotificationType {
    // Organizer Types
    NEW_COMPANY_REQUEST = "new_company_request",
    NEW_ADMIN_REQUEST = "new_admin_request",

    // Company Types
    COMPANY_APPROVED = "company_approved",
    ADMIN_APPROVED = "admin_approved",
    ADMIN_ADDED = "admin_added",
    ASSESSMENT_ASSIGNED = "assessment_assigned",

    // General
    INFO = "info",
    WARNING = "warning",
    ERROR = "error"
}

@Entity("notifications")
export class Notification {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({
        type: "enum",
        enum: NotificationType,
        default: NotificationType.INFO
    })
    type: NotificationType;

    @Column()
    title: string;

    @Column("text")
    message: string;

    @Column("jsonb", { nullable: true })
    data: any; // Store extra details like companyId, user email, etc.

    @Column({ default: false })
    isRead: boolean;

    // 1. Specific User Notification (Optional)
    // If set, only this user sees it (e.g., Organizer or specific Admin)
    @ManyToOne(() => User, { nullable: true, onDelete: "CASCADE" })
    @JoinColumn({ name: "userId" })
    user: User;

    @Column({ nullable: true })
    userId: string;

    // 2. Company-wide Notification (Optional)
    // If set, ALL admins in this company see it
    @ManyToOne(() => Company, { nullable: true, onDelete: "CASCADE" })
    @JoinColumn({ name: "companyId" })
    company: Company;

    @Column({ nullable: true })
    companyId: string;

    // 3. Global Organizer Notification (Flag)
    // If true, ALL organizers see it (usually just one)
    @Column({ default: false })
    isGlobalOrganizer: boolean;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt: Date;
}
