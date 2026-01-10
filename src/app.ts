import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./docs/swagger";
import routes from "./routes";

import userRoutes from "./routes/user.routes";
import organizerRoutes from "./routes/organizer.routes";
import errorMiddleware from "./middleware/error.middleware";
import { requestLogger } from "./middleware/requestLogger";
import logger from "./utils/logger";
import contestRoutes from "./routes/contest.routes";
import contestInviteRoutes from "./routes/contestInvite.routes";
import contestRegistrationRoutes from "./routes/contestRegistration.routes";
import contestMonitoringRoutes from "./routes/contestMonitoring.routes";
import contestSubmissionRoutes from "./routes/contestSubmission.routes";
import contestReportRoutes from "./routes/contestReport.routes";
import contestAdminRoutes from "./routes/contestAdmin.routes";
import contestSubmitAllRoutes from "./routes/contestSubmitAll.routes";
import secureLeaderboardRoutes from "./routes/secureLeaderboard.routes";
import secureContestRoutes from "./routes/secureContest.routes";
import secureContestResultRoutes from "./routes/secureContestResult.routes";
import assessmentRoutes from "./routes/assessment.routes";
import assessmentSectionRoutes from "./routes/assessmentSection.routes";
import questionRoutes from "./routes/question.routes";
import questionBankRoutes from "./routes/questionBank.routes";
import invitationRoutes from "./routes/invitation.routes";
import codingQuestionRoutes from "./routes/codingQuestionUpload.routes";
import contestantRoutes from "./routes/contestant.routes";
import monitorRoutes from "./routes/monitor.routes";
import codeExecutionRoutes from "./routes/codeExecution.routes";
import adminMonitorRoutes from "./routes/adminMonitor.routes";
import assessmentReportRoutes from "./routes/assessmentReport.routes";
import authenticationRoutes from "./routes/authentication.routes";
import sectionProblemRoutes from "./controllers/sectionProblem.controller";
import sqlExecutionRoutes from "./routes/sqlExecution.routes";

dotenv.config();

const app = express();

// ... (keep existing middleware config)

// 🔐 Security, CORS, and parsers
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://localhost:3001",
"https://smart-hire-proctoring-platform.vercel.app",
 
  "https://dk1cx0l60ut7o.cloudfront.net"
];

app.use(
  cors({
    origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Authorization"],
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// 🔍 Debug Middleware: Log body parsing errors
app.use((err: any, req: any, res: any, next: any) => {
  if (err instanceof SyntaxError && "body" in err) {
    console.error("❌ [Middleware] JSON Parsing Error:", err.message);
    return res.status(400).json({ message: "Invalid JSON payload", error: err.message });
  }
  if (err.type === 'entity.too.large') {
    console.error("❌ [Middleware] Payload Too Large:", err.message);
    return res.status(413).json({ message: "Payload too large", error: err.message });
  }
  next();
});

// 🧠 Request Logger (logs all API hits)
app.use(requestLogger);


// 🧩 Routes
app.use("/", routes);

// 🔐 AUTHENTICATION ROUTES (Public)
app.use("/api/auth", authenticationRoutes);

app.use("/api/users", userRoutes);
app.use("/api/organizer", organizerRoutes);
app.use("/api/contests", contestRoutes);
app.use("/api/contests", contestInviteRoutes);
app.use("/api", contestInviteRoutes); // 👈 Support /api/invitations/... for frontend compatibility
app.use("/api/contests", contestRegistrationRoutes);
app.use("/api/contest-registration", contestRegistrationRoutes); // 👈 Support /api/contest-registration/... for frontend compatibility
app.use("/api/contests", contestMonitoringRoutes);
app.use("/api/contests", contestSubmissionRoutes);
app.use("/api/contests", contestReportRoutes);
app.use("/api/contests", contestAdminRoutes);
app.use("/api/contests", contestSubmitAllRoutes);

// 🏆 Secure Contest Management (NEW - separate from existing)
app.use("/api/secure-leaderboard", secureLeaderboardRoutes);
app.use("/api/secure-contests", secureContestRoutes);
app.use("/api/secure-results", secureContestResultRoutes);

// 📝 Assessment Management API
app.use("/api/assessments", assessmentRoutes);
app.use("/api/sections", assessmentSectionRoutes);
app.use("/api/questions", questionRoutes);

// 📚 Question Bank API (Standalone Questions)
app.use("/api/question-bank", questionBankRoutes);

// 📧 Assessment Invitation API
app.use("/api/invitations", invitationRoutes);

// 💻 Coding Questions API (DSA/Coding problems)
app.use("/api/coding-questions", codingQuestionRoutes);

// 🎓 Contestant API (Assessment taking flow)
app.use("/api/contestant", contestantRoutes);
app.use("/api/contestant/monitor", monitorRoutes); // Monitor violations

// 💻 Code Execution API (Run & Submit code with Judge0)
app.use("/api/code", codeExecutionRoutes);

// 🗄️ SQL Execution API (Run & Submit SQL queries)
app.use("/api/sql", sqlExecutionRoutes);

// 🔴 Admin Monitoring API (Realtime Violation Feed for Organizers)
app.use("/api/admin", adminMonitorRoutes);

// 📊 Admin Reports API (Final Reports for Organizers)
app.use("/api/admin", assessmentReportRoutes);

// 🎯 Section Problem API (Test case configuration for coding problems)
app.use("/api/section-problems", sectionProblemRoutes);

// ❌ Centralized Error Handling + Logging
app.use((err: any, req: any, res: any, next: any) => {
  logger.error(
    `${req.method} ${req.url} | ${err.message} | Stack: ${err.stack?.split("\n")[0]}`
  );
  errorMiddleware(err, req, res, next);
});

export default app;
