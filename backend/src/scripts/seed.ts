import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import { User, Config, Department } from "../models";

// Load environment variables from project root or backend folder
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/nagrik";

async function runSeed() {
  try {
    console.log(`[Seeder] Connecting to MongoDB at ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI);
    console.log("[Seeder] Connected successfully.");

    console.log("[Seeder] Ensuring indexes are built...");
    await User.ensureIndexes();
    await Department.ensureIndexes();
    console.log("[Seeder] Indexes successfully created.");

    // Seeding config
    console.log("[Seeder] Seeding global configuration document...");
    await Config.findOneAndUpdate(
      { _id: "global" },
      {
        mergeRadiusMeters: 50,
        mergeTimeWindowHours: 72,
        categorySlaHours: {
          pothole: 72,
          water_leak: 24,
          streetlight: 48,
          garbage: 24,
          drainage: 48,
          road_damage: 96,
          other: 72
        },
        escalationIntervalHours: 6,
        civicPointsPerReport: 10,
        civicPointsPerConfirmation: 5
      },
      { upsert: true }
    );

    // Seeding departments
    console.log("[Seeder] Seeding municipal departments directory...");
    const seedData = [
      { name: "Ward 1 Roads & PWD Department", category: "pothole", ward: "Ward 1", contactEmail: "roads.ward1@nagrik.gov", contactPhone: "+91 11 2345 6783" },
      { name: "Ward 1 Sanitation & Garbage Board", category: "garbage", ward: "Ward 1", contactEmail: "sanitation.ward1@nagrik.gov", contactPhone: "+91 11 2345 6781" },
      { name: "Ward 1 Electricity and Lighting Division", category: "streetlight", ward: "Ward 1", contactEmail: "power.ward1@nagrik.gov", contactPhone: "+91 11 2345 6782" },
      { name: "Ward 1 Water Supply Board", category: "water_leak", ward: "Ward 1", contactEmail: "water.ward1@nagrik.gov", contactPhone: "+91 11 2345 6784" },
      { name: "Ward 1 Drainage and Sewerage Division", category: "drainage", ward: "Ward 1", contactEmail: "drainage.ward1@nagrik.gov", contactPhone: "+91 11 2345 6785" },
      { name: "Citywide PWD Roads fallback", category: "pothole", ward: "citywide", contactEmail: "pwd.roads@nagrik.gov", contactPhone: "+91 11 2345 0000" },
      { name: "Citywide Water Supply fallback", category: "water_leak", ward: "citywide", contactEmail: "water.city@nagrik.gov", contactPhone: "+91 11 2345 0001" },
      { name: "Citywide Sanitation fallback", category: "garbage", ward: "citywide", contactEmail: "waste.city@nagrik.gov", contactPhone: "+91 11 2345 0002" },
      { name: "Citywide Power and Streetlights fallback", category: "streetlight", ward: "citywide", contactEmail: "light.city@nagrik.gov", contactPhone: "+91 11 2345 0003" },
      { name: "Citywide Public Safety and Infrastructure fallback", category: "other", ward: "citywide", contactEmail: "safety.city@nagrik.gov", contactPhone: "+91 11 2345 0004" }
    ];

    let deptsCreated = 0;
    for (const dept of seedData) {
      const existing = await Department.findOne({ category: dept.category, ward: dept.ward });
      if (!existing) {
        await Department.create(dept);
        deptsCreated++;
      }
    }
    console.log(`[Seeder] Seeded ${deptsCreated} new departments.`);

    // Pre-create staff account
    const staffEmail = "staff@nagrik.gov";
    let staffUser = await User.findOne({ authUserId: staffEmail });
    if (!staffUser) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("password123", salt);
      staffUser = await User.create({
        authUserId: staffEmail,
        displayName: "Municipal Staff Officer",
        role: "staff",
        authProvider: "email",
        fcmToken: hashedPassword
      });
      console.log(`[Seeder] Pre-provisioned staff account: ${staffEmail} (password: password123)`);
    } else {
      console.log(`[Seeder] Staff account already exists: ${staffEmail}`);
    }

    console.log("[Seeder] Database seeding completed successfully!");
  } catch (err) {
    console.error("[Seeder] Seeding error:", err);
  } finally {
    await mongoose.connection.close();
    console.log("[Seeder] Connection closed.");
  }
}

runSeed();
