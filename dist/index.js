import Express from "express";
import cors from "cors";
import { Redis } from "@upstash/redis";
import router from "./routes/router.auth.js";
import img from "./routes/upload.js";
import workspaceRouter from "./routes/workspace.js";
import interviewRouter from "./routes/router.interview.js";
import { connectDB } from "./model/connect.js";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
dotenv.config();
// console.log("✅ Step 2: .env loaded");
// console.log("🔍 Step 3: Checking environment variables:");
// console.log("   - MONGO_URL exists:", !!process.env.MONGO_URL);
// console.log("   - UPSTASH_REDIS_REST_URL:", process.env.UPSTASH_REDIS_REST_URL);
// console.log("   - UPSTASH_REDIS_REST_TOKEN length:", process.env.UPSTASH_REDIS_REST_TOKEN?.length);
// console.log("   - UPSTASH_REDIS_REST_TOKEN preview:", process.env.UPSTASH_REDIS_REST_TOKEN?.substring(0, 30) + "...");
// console.log("🔧 Step 4: Creating Redis client...");
try {
    const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    // console.log("✅ Step 5: Redis client created successfully");
    const app = Express();
    // console.log("🔧 Step 6: Connecting to MongoDB...");
    connectDB();
    // CORS configuration
    const corsOptions = {
        origin: ['http://localhost:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    };
    app.use(cors(corsOptions));
    app.options('/*any', cors(corsOptions));
    ; // Enable pre-flight for all routes
    app.use(Express.json());
    app.use(Express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.get("/", (req, res) => {
        res.send("checking......");
    });
    app.get("/redis-test", async (_, res) => {
        try {
            // console.log("🔧 Testing Redis connection...");
            await redis.set("server-test", "working", { ex: 60 });
            const value = await redis.get("server-test");
            // console.log("✅ Redis test successful:", value);
            res.json({ redis: value });
        }
        catch (error) {
            // console.error("❌ Redis test failed:", error.message);
            res.status(500).json({ error: error.message });
        }
    });
    app.use("/auth", router);
    app.use("/image", img);
    app.use("/api/interview", interviewRouter);
    app.use("/api/workspace", workspaceRouter);
    app.listen(5000, () => {
        console.log("✅ Step 7: Server is running on port 5000");
    });
}
catch (error) {
    console.error("❌ Error during initialization:", error.message);
    console.error("Full error:", error);
}
