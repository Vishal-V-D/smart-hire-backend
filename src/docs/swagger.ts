import swaggerJSDoc from "swagger-jsdoc";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Quantum-Judge — User Contest Service",
    version: "1.1.0",
    description: "User & Contest microservice API with Problems, Contests, and Registration endpoints",
  },

  servers: [
    {
      url: "http://localhost:4000",
      description: "Local Development Server",
    },
  ],

  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },

    schemas: {
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          email: { type: "string" },
          username: { type: "string" },
          role: { type: "string", enum: ["ORGANIZER", "CONTESTANT"] },
        },
      },

      Contest: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          startTime: { type: "string", format: "date-time" },
          endTime: { type: "string", format: "date-time" },
          createdBy: { $ref: "#/components/schemas/User" },
        },
      },

      Problem: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          difficulty: { type: "string" },
          visibility: { type: "string", enum: ["PUBLIC", "PRIVATE"] },
          createdBy: { $ref: "#/components/schemas/User" },
        },
      },

      TestCase: {
        type: "object",
        properties: {
          id: { type: "string" },
          input: { type: "string" },
          expectedOutput: { type: "string" },
          isHidden: { type: "boolean" },
        },
      },
    },
  },

  security: [{ bearerAuth: [] }],

  paths: {
    // ---------------------------------------------------
    // AUTH
    // ---------------------------------------------------
    "/api/auth/signup/organizer": {
      post: {
        tags: ["Auth"],
        summary: "Register organizer",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["email", "username", "password"],
                properties: {
                  email: { type: "string" },
                  username: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Organizer created" } },
      },
    },

    "/api/auth/signup/contestant": {
      post: {
        tags: ["Auth"],
        summary: "Register contestant",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["email", "username", "password"],
                properties: {
                  email: { type: "string" },
                  username: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Contestant created" } },
      },
    },

    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["identifier", "password"],
                properties: {
                  identifier: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Login successful" } },
      },
    },

    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout user",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "User logged out" } },
      },
    },

    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current authenticated user",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Authenticated user data" } },
      },
    },

    // ---------------------------------------------------
    // CONTESTS
    // ---------------------------------------------------
    "/api/contests": {
      post: {
        tags: ["Contests"],
        summary: "Create a new contest",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/Contest" } },
          },
        },
        responses: { 201: { description: "Contest created" } },
      },
      get: {
        tags: ["Contests"],
        summary: "List all contests",
        parameters: [
          { name: "skip", in: "query", schema: { type: "integer" } },
          { name: "take", in: "query", schema: { type: "integer" } },
        ],
        responses: { 200: { description: "Contest list" } },
      },
    },

    "/api/contests/{id}": {
      get: {
        tags: ["Contests"],
        summary: "Get contest by ID",
        parameters: [{ name: "id", in: "path", required: true }],
        responses: { 200: { description: "Contest data" }, 404: { description: "Not found" } },
      },
    },

    "/api/contests/{id}/problems": {
      post: {
        tags: ["Contests"],
        summary: "Add problem to contest",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["problemId"],
                properties: {
                  problemId: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Problem added to contest" } },
      },
    },

    "/api/contests/problems/{cpId}": {
      delete: {
        tags: ["Contests"],
        summary: "Remove problem from contest",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "cpId", in: "path", required: true }],
        responses: { 204: { description: "Problem removed" } },
      },
    },

    "/api/contests/{id}/register": {
      post: {
        tags: ["Contests"],
        summary: "Register for a contest",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true }],
        responses: { 201: { description: "User registered for contest" } },
      },
    },

    "/api/contests/created": {
      get: {
        tags: ["Contests"],
        summary: "Get contests created by current organizer",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Organizer contests list" } },
      },
    },

    "/api/contests/registered": {
      get: {
        tags: ["Contests"],
        summary: "Get contests current contestant registered for",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Registered contests list" } },
      },
    },

    // ---------------------------------------------------
    // PROBLEMS
    // ---------------------------------------------------
    "/api/problems": {
      post: {
        tags: ["Problems"],
        summary: "Create a problem (public/private)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["title", "description", "visibility"],
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  difficulty: { type: "string" },
                  visibility: { type: "string", enum: ["PUBLIC", "PRIVATE"] },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Optional labels for the problem",
                  },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Problem created" } },
      },
      get: {
        tags: ["Problems"],
        summary: "List all public problems",
        parameters: [
          { name: "skip", in: "query", schema: { type: "integer" } },
          { name: "take", in: "query", schema: { type: "integer" } },
        ],
        responses: { 200: { description: "Public problems list" } },
      },
    },

    "/api/problems/{id}": {
      get: {
        tags: ["Problems"],
        summary: "Get a problem by ID",
        parameters: [{ name: "id", in: "path", required: true }],
        responses: { 200: { description: "Problem data" }, 404: { description: "Not found" } },
      },
      put: {
        tags: ["Problems"],
        summary: "Update a problem (Organizer only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Problem ID",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  accessType: { type: "string", enum: ["PUBLIC", "PRIVATE"] },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Optional labels that help categorize the problem",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Problem updated successfully" },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden (not your problem)" },
          404: { description: "Problem not found" },
        },
      },
      delete: {
        tags: ["Problems"],
        summary: "Delete a problem (Organizer only)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Problem ID",
          },
        ],
        responses: {
          200: { description: "Problem deleted successfully" },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden (not your problem)" },
          404: { description: "Problem not found" },
        },
      },
    },
    

    "/api/problems/{id}/testcases": {
      post: {
        tags: ["Problems"],
        summary: "Add a testcase to a problem",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                required: ["input", "expectedOutput"],
                properties: {
                  input: { type: "string" },
                  expectedOutput: { type: "string" },
                  isHidden: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Testcase added" } },
      },
    },

    // ---------------------------------------------------
    // HEALTH
    // ---------------------------------------------------
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Service health check",
        responses: { 200: { description: "OK" } },
      },
    },
  },
};

const options: swaggerJSDoc.Options = {
  definition: swaggerDefinition,
  apis: [],
};

export default swaggerJSDoc(options);
