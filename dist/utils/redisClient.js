import { Redis } from "@upstash/redis";
import dotenv from "dotenv";
dotenv.config();
console.log("🔧 RedisClient module loading...");
console.log("   - URL:", process.env.UPSTASH_REDIS_REST_URL);
console.log("   - Token length:", process.env.UPSTASH_REDIS_REST_TOKEN?.length);
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error("❌ Upstash Redis env variables are missing");
    throw new Error("Upstash Redis env variables are missing");
}
console.log("🔧 Creating redisClient instance...");
export const redisClient = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
console.log("✅ redisClient created successfully");
