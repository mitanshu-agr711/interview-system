import { Redis } from "@upstash/redis";
import dotenv from "dotenv";

dotenv.config();


if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error("Upstash Redis env variables are missing");
  throw new Error("Upstash Redis env variables are missing");
}

export const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
console.log("redisClient created successfully");