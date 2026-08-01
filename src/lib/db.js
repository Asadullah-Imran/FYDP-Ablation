import mongoose from 'mongoose';
import DatasetSection from '@/models/DatasetSection';
import User from '@/models/User';
import bcrypt from 'bcrypt';

// Disable buffering commands in Mongoose for fast failure in serverless environments
mongoose.set('bufferCommands', false);

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const seedDatabase = async () => {
  console.log("Checking database seeds...");
  
  const defaultSections = [
    { name: "Human_Lymph_Node_A1", groundTruth: 10 },
    { name: "Human_Lymph_Node_D1", groundTruth: 11 },
    { name: "Mouse_Brain_ATAC" },
    { name: "Mouse_Brain_H3K27ac" },
    { name: "Mouse_Brain_H3K27me" },
    { name: "Mouse_Brain_H3K4me" },
    { name: "Mouse_Spleen" },
    { name: "Mouse_Thymus" },
    { name: "Mouse_Brain_E11_S1" },
    { name: "Mouse_Brain_E13_S1" },
    { name: "Mouse_Brain_E15_S1" },
    { name: "Mouse_Brain_E18_S1" },
  ];

  // Fetch all existing sections in one single query
  const sectionNames = defaultSections.map(s => s.name);
  const existingSections = await DatasetSection.find({ name: { $in: sectionNames } });
  const existingMap = new Map(existingSections.map(s => [s.name, s]));

  const bulkOps = [];
  for (const sectionData of defaultSections) {
    const exists = existingMap.get(sectionData.name);
    if (!exists) {
      bulkOps.push({
        insertOne: {
          document: {
            name: sectionData.name,
            description: `Performance benchmark leaderboard for dataset: ${sectionData.name.replace(/_/g, " ")}`,
            groundTruth: sectionData.groundTruth,
          }
        }
      });
      console.log(`Prepared seed for dataset section: ${sectionData.name}`);
    } else if (sectionData.groundTruth !== undefined && exists.groundTruth !== sectionData.groundTruth) {
      bulkOps.push({
        updateOne: {
          filter: { name: sectionData.name },
          update: { $set: { groundTruth: sectionData.groundTruth } }
        }
      });
      console.log(`Prepared groundTruth update for dataset section: ${sectionData.name}`);
    }
  }

  if (bulkOps.length > 0) {
    await DatasetSection.bulkWrite(bulkOps);
    console.log(`Seeded/Updated dataset sections using bulkWrite (${bulkOps.length} ops)`);
  }

  // Auto-seed default Admin user if none exists
  const adminExists = await User.findOne({ role: "admin" }).select("_id");
  if (!adminExists) {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@gmail.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin";
    const adminName = "System Admin";

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    await User.create({
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      role: "admin",
    });
    console.log(`Seeded admin account: ${adminEmail}`);
  }
};

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      serverSelectionTimeoutMS: 5000,
    };
    
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/spatialablate";
    console.log("Initiating new MongoDB connection...");
    cached.promise = mongoose.connect(mongoUri, opts).then((conn) => {
      console.log("MongoDB Connected successfully");
      return conn;
    }).catch((err) => {
      cached.promise = null; // Reset cache on failure
      console.error(`Database connection failed: ${err.message}`);
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  // Run seeding if it hasn't been completed yet
  if (!global.isSeedingCompleted) {
    try {
      await seedDatabase();
      global.isSeedingCompleted = true;
    } catch (err) {
      console.error(`Database seeding failed: ${err.message}`);
    }
  }

  return cached.conn;
}

export default connectDB;
