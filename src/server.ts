import "reflect-metadata";
import { AppDataSource } from "./config/db";
import app from "./app";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./docs/swagger";
import http from "http";
import { initSocket } from "./utils/socket";
import { testSupabaseConnection } from "./services/supabase.service";

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);
const io = initSocket(server);

AppDataSource.initialize()
  .then(async () => {
    app.use(
      "/api/docs",
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec, {
        swaggerOptions: {
          withCredentials: true,
        },
      })
    );

    // Test Supabase connection on startup
    console.log('\n🔍 Testing Supabase configuration...');
    await testSupabaseConnection();

    server.listen(PORT, () => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`✅ DB Connected`);
      console.log(`🚀 User-Contest Service running on port ${PORT}`);
      console.log(`📘 Swagger Docs available at: http://localhost:${PORT}/api/docs`);
      console.log(`💓 Health Check: http://localhost:${PORT}/health`);
      console.log(`🛰️ Contest WebSocket active on port ${PORT}`);
      console.log(`${'='.repeat(60)}\n`);
    });
  })
  .catch((err) => {
    console.error("❌ Data Source initialization error:", err);
    process.exit(1);
  });

export { io };
