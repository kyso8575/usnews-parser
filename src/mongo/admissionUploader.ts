import * as fs from "fs";
import * as path from "path";
import { connectToMongoDB, disconnectFromMongoDB, getDatabase } from "./client";

interface AdmissionCalculatorData {
  [key: string]: unknown;
}

function getUniversityDirs(htmlRoot: string): string[] {
  if (!fs.existsSync(htmlRoot)) return [];
  return fs
    .readdirSync(htmlRoot)
    .filter((item) => {
      const p = path.join(htmlRoot, item);
      return fs.statSync(p).isDirectory();
    })
    .sort();
}

function readAdmissionCalculatorFile(universityDir: string): AdmissionCalculatorData | null {
  const candidates = [
    path.join(universityDir, "admission_calculator.json"),
    path.join(universityDir, "admissions_calculator.json"),
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      return JSON.parse(raw) as AdmissionCalculatorData;
    } catch (error) {
      console.error(`❌ Failed to parse JSON: ${filePath}`, error);
      return null;
    }
  }
  return null;
}

async function uploadAdmissionCalculators(): Promise<void> {
  const htmlRoot = path.resolve("./data/html");
  const dirs = getUniversityDirs(htmlRoot);

  if (dirs.length === 0) {
    console.log("⚠️ No university directories found under data/html");
    return;
  }

  console.log(`📂 Found ${dirs.length} university directories`);

  await connectToMongoDB();
  try {
    const db = getDatabase();
    const collection = db.collection("admission_calculators");
    let inserted = 0;
    let skippedMissingFile = 0;

    for (const dirName of dirs) {
      const dirPath = path.join(htmlRoot, dirName);
      const data = readAdmissionCalculatorFile(dirPath);
      if (!data) {
        skippedMissingFile++;
        continue;
      }

      const universityName = dirName.replace(/_/g, " ");
      const document = {
        universityName,
        directoryName: dirName,
        admissionCalculator: data,
        uploadedAt: new Date()
      };

      try {
        const res = await collection.insertOne(document);
        inserted++;
        console.log(`✅ Inserted admission calculator for '${universityName}'`);
      } catch (error) {
        console.error(`❌ Failed to insert '${universityName}'`, error);
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("📊 Admission calculator upload summary");
    console.log("=".repeat(50));
    console.log(`Inserted: ${inserted}`);
    console.log(`Missing file: ${skippedMissingFile}`);
  } finally {
    await disconnectFromMongoDB();
  }
}

// CLI
if (require.main === module) {
  uploadAdmissionCalculators()
    .then(() => {
      console.log("✨ Admission calculator upload completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Admission calculator upload failed", error);
      process.exit(1);
    });
}

export default uploadAdmissionCalculators;
