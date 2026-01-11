import { Server } from "socket.io";
import http from "http";

let io: Server | undefined;

const ALLOWED_ORIGINS = [
  "http://localhost:8000",
  "http://localhost:4000",
  "http://localhost:5000",
  "http://localhost:5173",
];

export const initSocket = (server: http.Server): Server => {
  io = new Server(server, {
    cors: {
      origin: ALLOWED_ORIGINS,
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log(`⚡ [Socket] Connected: ${socket.id}`);

    // Allow organizer to join a special room for notifications
    socket.on("join_organizer_room", () => {
      socket.join("organizer");
      console.log(`👑 [Socket] Organizer joined notification room: ${socket.id}`);
    });

    // Allow organizer to leave the room
    socket.on("leave_organizer_room", () => {
      socket.leave("organizer");
      console.log(`👋 [Socket] Organizer left notification room: ${socket.id}`);
    });

    // Allow company admin to join their company's room
    socket.on("join_company_room", (companyId: string) => {
      socket.join(`company_${companyId}`);
      console.log(`🏢 [Socket] Company admin joined room: company_${companyId} (${socket.id})`);
    });

    // Allow company admin to leave their company's room
    socket.on("leave_company_room", (companyId: string) => {
      socket.leave(`company_${companyId}`);
      console.log(`👋 [Socket] Company admin left room: company_${companyId} (${socket.id})`);
    });

    socket.on("disconnect", () => {
      console.log(`❌ [Socket] Disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error("Socket.io not initialized in user-contest-service");
  }
  return io;
};

export interface ContestNotificationPayload {
  type:
  | "contest_created"
  | "contest_updated"
  | "contest_deleted"
  | "contest_registration"
  | "violation_reported"
  | "monitoring_photo_captured"
  | "participant_joined"
  | "participant_status_changed";
  title: string;
  message: string;
  contestId: string;
  contestTitle?: string;
  startsAt?: string;
  userId?: string;
  violation?: any;
  photoUrl?: string;
}

export const emitContestNotification = (payload: ContestNotificationPayload) => {
  if (!io) return;
  io.emit("contestNotification", payload);
};

// 🔔 Organizer Notification Types
export interface OrganizerNotificationPayload {
  id: string;
  type:
  | "new_company_request"
  | "new_admin_request"
  | "company_approved"
  | "admin_approved";
  title: string;
  message: string;
  data: any;
  timestamp: Date;
}

// 🔔 Emit notification to organizer room
export const emitOrganizerNotification = (payload: OrganizerNotificationPayload) => {
  if (!io) {
    console.warn("⚠️ [Socket] Socket.io not initialized, cannot send notification");
    return;
  }
  io.to("organizer").emit("organizer_notification", payload);
  console.log(`📢 [Socket] Notification sent to organizer: ${payload.type}`);
};

// 🏢 Company Notification Types
export interface CompanyNotificationPayload {
  id: string;
  type:
  | "company_approved"
  | "admin_approved"
  | "admin_added"
  | "assessment_assigned"
  | "invitation_sent"
  | "assessment_completed";
  title: string;
  message: string;
  data: any;
  timestamp: Date;
}

// 🏢 Emit notification to all admins of a specific company
export const emitCompanyNotification = (companyId: string, payload: CompanyNotificationPayload) => {
  if (!io) {
    console.warn("⚠️ [Socket] Socket.io not initialized, cannot send notification");
    return;
  }
  io.to(`company_${companyId}`).emit("company_notification", payload);
  console.log(`📢 [Socket] Notification sent to company ${companyId}: ${payload.type}`);
};
