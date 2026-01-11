import { DataSource } from "typeorm";
import dotenv from "dotenv";
import { User } from "../entities/user.entity";
import { Problem } from "../entities/problem.entity";
import { TestCase } from "../entities/testcase.entity";
import { Contest } from "../entities/contest.entity";
import { ContestProblem } from "../entities/contestProblem.entity";

import { ContestViolation } from "../entities/contestViolation.entity";

import { ContestInvitation } from "../entities/contestInvitation.entity";
import { ContestSubmission } from "../entities/contestSubmission.entity";
import { ContestMonitoringPhoto } from "../entities/contestMonitoringPhoto.entity";
import { ContestReport } from "../entities/contestReport.entity";
import { ContestRegistration } from "../entities/contestRegistration.entity";
import { ContestSession } from "../entities/contestSession.entity";
import { PlagiarismResult } from "../entities/plagiarismResult.entity";
import { SecureContestResult } from "../entities/SecureContestResult.entity";
import { Assessment } from "../entities/Assessment.entity";
import { AssessmentSection } from "../entities/AssessmentSection.entity";
import { Question } from "../entities/Question.entity";
import { AssessmentInvitation } from "../entities/AssessmentInvitation.entity";
import { SectionProblem } from "../entities/SectionProblem.entity";
import { AssessmentOTP } from "../entities/AssessmentOTP.entity";
import { ContestantProfile } from "../entities/ContestantProfile.entity";
import { AssessmentSession } from "../entities/AssessmentSession.entity";
import { AssessmentViolation } from "../entities/AssessmentViolation.entity";
import { AssessmentSubmission } from "../entities/AssessmentSubmission.entity";
import { AssessmentAnswer } from "../entities/AssessmentAnswer.entity";
import { AdminAssessmentAccess } from "../entities/AdminAssessmentAccess.entity";
import { Company } from "../entities/Company.entity";
import { SqlQuestion } from "../entities/SqlQuestion.entity";
import { Notification } from "../entities/Notification.entity";
import { CompanyRequestLog } from "../entities/CompanyRequestLog.entity";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
  synchronize: true, // Enabled to ensure tables are created for the new service
  logging: false,
  entities: [
    User,
    Problem,
    TestCase,
    Contest,
    ContestProblem,

    ContestViolation,
    ContestInvitation,
    ContestSubmission,
    ContestMonitoringPhoto,
    ContestReport,
    ContestRegistration,
    ContestSession,
    PlagiarismResult,
    SecureContestResult,
    Assessment,
    AssessmentSection,
    Question,
    SqlQuestion,
    AssessmentInvitation,
    SectionProblem,
    AssessmentOTP,
    ContestantProfile,
    AssessmentSession,
    AssessmentViolation,
    AssessmentSubmission,
    AssessmentAnswer,
    AdminAssessmentAccess,
    Company,
    Notification,
    CompanyRequestLog,
  ],
});
