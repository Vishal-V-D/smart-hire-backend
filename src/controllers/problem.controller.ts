import { Request, Response } from "express";
import * as problemService from "../services/problem.service";
import { uploadProblemImage, uploadExampleImage } from "../services/supabase.service";

// ✅ Create Problem (Organizer Only)
export const createProblem = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const payload = req.body;

    console.log("📌 [CREATE_PROBLEM] User:", user?.id);
    console.log("📌 [CREATE_PROBLEM] Incoming payload:", JSON.stringify(payload));

    // Parse examples if it's a JSON string
    if (payload.examples && typeof payload.examples === 'string') {
      try {
        payload.examples = JSON.parse(payload.examples);
      } catch (err) {
        console.error("❌ [CREATE_PROBLEM] Failed to parse examples:", err);
        payload.examples = [];
      }
    }

    // Parse tags if it's a JSON string
    if (payload.tags && typeof payload.tags === 'string') {
      try {
        payload.tags = JSON.parse(payload.tags);
      } catch (err) {
        console.error("❌ [CREATE_PROBLEM] Failed to parse tags:", err);
        payload.tags = [];
      }
    }

    // Create problem first
    const problem = await problemService.createProblem(payload, user.id);

    // Handle file uploads
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    // Upload overall problem image if provided
    if (files?.image && files.image[0]) {
      try {
        console.log("📤 [CREATE_PROBLEM] Uploading overall image for problem:", problem.id);
        const imageUrl = await uploadProblemImage(files.image[0], problem.id);

        // Update problem with image URL
        await problemService.updateProblemImage(problem.id, imageUrl);
        problem.imageUrl = imageUrl;

        console.log("✅ [CREATE_PROBLEM] Overall image uploaded:", imageUrl);
      } catch (err: any) {
        console.error("❌ [CREATE_PROBLEM] Overall image upload failed:", err.message);
        // Continue without image - don't fail the whole request
      }
    }

    // Upload example images if provided
    if (files?.exampleImages && files.exampleImages.length > 0 && problem.examples) {
      console.log(`📤 [CREATE_PROBLEM] Uploading ${files.exampleImages.length} example images`);

      for (let i = 0; i < files.exampleImages.length && i < problem.examples.length; i++) {
        try {
          const exampleImageUrl = await uploadExampleImage(files.exampleImages[i], problem.id, i);
          problem.examples[i].imageUrl = exampleImageUrl;
          console.log(`✅ [CREATE_PROBLEM] Example ${i} image uploaded:`, exampleImageUrl);
        } catch (err: any) {
          console.error(`❌ [CREATE_PROBLEM] Example ${i} image upload failed:`, err.message);
          // Continue without this example image
        }
      }

      // Update problem with example images
      await problemService.updateProblem(problem.id, user.id, { examples: problem.examples });
    }

    res.status(201).json(problem);
  } catch (err: any) {
    console.error("❌ [CREATE_PROBLEM] Failed to create problem:", err);
    console.error("❌ [CREATE_PROBLEM] Payload was:", JSON.stringify(req.body));
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
};

// ✅ Get Single Problem
export const getProblem = async (req: Request, res: Response) => {
  console.log("📌 [GET_PROBLEM] Incoming request...");

  try {
    const user = (req as any).user;
    const problemId = req.params.id;

    console.log("🔹 User:", user?.id || "No user");
    console.log("🔹 Problem ID:", problemId);

    // ✅ Call service, userId is optional (undefined for guests)
    const problem = await problemService.getProblem(problemId, user?.id);

    console.log("✅ [GET_PROBLEM] Problem data fetched successfully:");
    console.log(JSON.stringify(problem, null, 2));

    return res.json(problem);

  } catch (err: any) {
    console.error("❌ [GET_PROBLEM] Error occurred:", err);
    return res.status(err.status || 500).json({
      message: err.message || "Server error",
      error: err,
    });
  }
};

// ✅ List Problems
export const listProblems = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const skip = Number(req.query.skip) || 0;
    const take = Number(req.query.take) || 20;

    console.log("📥 [Controller] listProblems called:");
    console.log("   ➤ Authenticated user:", user ? `${user.id} (${user.role})` : "No user");
    console.log("   ➤ Query Params => skip:", skip, "| take:", take);

    const list = await problemService.listProblems(user?.id, skip, take);

    console.log(`✅ [Controller] listProblems fetched ${list.length} problems`);
    res.json(list);
  } catch (err: any) {
    console.error("❌ [Controller] Error listing problems:", err.message);
    res
      .status(err.status || 500)
      .json({ message: err.message || "Server error" });
  }
};

// ✅ Add Test Case
export const addTestCase = async (req: Request, res: Response) => {
  try {
    const { input, expectedOutput, isHidden } = req.body;
    const tc = await problemService.addTestCase(
      req.params.id,
      input,
      expectedOutput,
      Boolean(isHidden)
    );
    res.status(201).json(tc);
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
};

// ✅ Update Problem
export const updateProblem = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const updated = await problemService.updateProblem(req.params.id, user.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
};

// ✅ Delete Problem
export const deleteProblem = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const result = await problemService.deleteProblem(req.params.id, user.id);
    res.json(result);
  } catch (err: any) {
    res.status(err.status || 500).json({ message: err.message || "Server error" });
  }
};
