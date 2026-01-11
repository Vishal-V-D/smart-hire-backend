import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  ManyToOne,
} from "typeorm";
import { Contest } from "./contest.entity";
import { Company } from "./Company.entity";

export enum UserRole {
  ORGANIZER = "ORGANIZER",
  CONTESTANT = "CONTESTANT",
  ADMIN = "ADMIN",
  COMPANY = "COMPANY",
}

export enum AdminStatus {
  ACTIVE = "active",
  PENDING = "pending",
  DISABLED = "disabled",
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  username: string;

  @Column({ nullable: true })
  organizationName: string; // For organizers - company/institution name

  @Column({ nullable: true })
  password: string;

  @Column({
    type: "enum",
    enum: UserRole,
    default: UserRole.CONTESTANT,
  })
  role: UserRole;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ nullable: true, select: false }) // Don't return token by default
  verificationToken: string;

  @Column({ unique: true, nullable: true })
  googleId: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  photoUrl: string;

  @Column({ nullable: true })
  photoOptimizedUrl: string;

  @Column({ nullable: true })
  photoThumbnailUrl: string;

  @Column({ type: "jsonb", nullable: true })
  faceDescriptor: any;

  @Column({ default: "Student" })
  rank: string;

  // New relation for Company Admins
  @ManyToOne(() => Company, (company) => company.users, { nullable: true })
  company: Company;

  @Column({ nullable: true })
  companyId: string;

  // 🔐 ADMIN/AUTHENTICATION FIELDS
  @Column({ nullable: true })
  fullName: string; // Full name for admins/organizers

  @Column({ nullable: true })
  assignedOrganizerId: string; // For ADMIN/COMPANY - which organizer they work for

  @Column({
    type: "enum",
    enum: AdminStatus,
    default: AdminStatus.PENDING,
  })
  status: AdminStatus; // active, pending, disabled

  @Column({ type: "timestamp", nullable: true })
  lastLogin: Date;

  @Column({ type: "int", default: 0 })
  assessmentsViewedCount: number;

  @Column({ type: "int", default: 0 })
  reportsDownloadedCount: number;

  // Password reset token
  @Column({ nullable: true, select: false })
  resetToken: string;

  @Column({ type: "timestamp", nullable: true })
  resetTokenExpiry: Date;

  // Magic login token
  @Column({ nullable: true, select: false })
  magicLoginToken: string;

  @Column({ type: "timestamp", nullable: true })
  magicLoginTokenExpiry: Date;

  // Track if user has set their own password (for first-time login flow)
  @Column({ default: false })
  hasSetPassword: boolean;

  // ✅ END ADMIN/AUTHENTICATION FIELDS
  refreshToken: string;

  @Column({ default: false })
  isBanned: boolean;

  @Column({ type: "text", nullable: true })
  banReason: string;

  @Column({ type: "timestamp", nullable: true })
  bannedAt: Date;

  // 🧑‍💼 Contests created by this user (Organizer)
  @OneToMany(() => Contest, (contest) => contest.createdBy)
  createdContests: Contest[];

  // 🧍 Contests the user registered for (Contestant)
  @ManyToMany(() => Contest, (contest) => contest.contestant)
  registeredContests: Contest[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
