import { createClient } from "redis";

export const redisClient = createClient();
await redisClient.connect();
