import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    console.log("🔧 Attempting MongoDB connection...");
    console.log("   - MONGO_URL preview:", process.env.MONGO_URL?.substring(0, 40) + "...");
    const conn = await mongoose.connect(process.env.MONGO_URL as string);
    console.log(`✅ MongoDB Connected: successfully`);
  } catch (error: any) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};