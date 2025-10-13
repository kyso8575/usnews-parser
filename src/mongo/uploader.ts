import * as fs from "fs";
import * as path from "path";
import { connectToMongoDB, disconnectFromMongoDB, uploadUniversityData, getUniversityCount, getDatabase } from './client';
import { UniversityDocument } from './config';

async function uploadDataToMongoDB(): Promise<void> {
  try {
    console.log('🚀 Starting MongoDB upload process...\n');
    
    // 1. MongoDB 연결
    await connectToMongoDB();
    
    // 2. JSON 파일에서 데이터 읽기
    const jsonPath = path.resolve('./output/output-unified.json');
    
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`JSON file not found: ${jsonPath}`);
    }
    
    console.log(`📖 Reading data from: ${jsonPath}`);
    const jsonData = fs.readFileSync(jsonPath, 'utf8');
    const universities: UniversityDocument[] = JSON.parse(jsonData);
    
    console.log(`📊 Found ${universities.length} universities in JSON file`);
    
    if (universities.length === 0) {
      console.log('⚠️ No universities found in JSON file');
      return;
    }
    
    // 3. 데이터 검증
    console.log('🔍 Validating data...');
    validateUniversityData(universities);
    
    // 4. US News ID 추가
    console.log('🔄 Adding US News IDs...');
    const universitiesWithIds = addUsNewsIds(universities);
    
    // 5. 기존 데이터 삭제 후 새로 업로드
    console.log('🗑️ Clearing existing data...');
    await clearUniversitiesCollection();
    
    // 6. MongoDB에 업로드
    await uploadUniversityData(universitiesWithIds);
    
    // 7. 업로드 검증
    const uploadedCount = await getUniversityCount();
    console.log(`✅ Verification: ${uploadedCount} universities in database`);
    
    if (uploadedCount !== universitiesWithIds.length) {
      console.warn(`⚠️ Count mismatch: Expected ${universitiesWithIds.length}, got ${uploadedCount}`);
    }
    
    console.log('\n🎉 MongoDB upload completed successfully!');
    
    // 8. Admission Calculator 데이터 업로드
    console.log('\n🔄 Uploading admission calculator data...');
    await uploadAdmissionCalculators();
    
  } catch (error) {
    console.error('❌ Upload failed:', error);
    throw error;
  } finally {
    await disconnectFromMongoDB();
  }
}

function validateUniversityData(universities: UniversityDocument[]): void {
  const validUniversities = universities.filter(uni => {
    return uni._id && uni.name && typeof uni._id === 'string' && typeof uni.name === 'string';
  });
  
  if (validUniversities.length !== universities.length) {
    const invalidCount = universities.length - validUniversities.length;
    console.warn(`⚠️ Found ${invalidCount} invalid universities (missing _id or name)`);
  }
  
  // 중복 ID 체크
  const ids = new Set(universities.map(uni => uni._id));
  if (ids.size !== universities.length) {
    console.warn(`⚠️ Found duplicate IDs in university data`);
  }
  
  console.log(`✅ Data validation completed: ${validUniversities.length}/${universities.length} valid universities`);
}

function addUsNewsIds(universities: UniversityDocument[]): UniversityDocument[] {
  return universities.map(uni => {
    // admission_calculators 컬렉션에서 school_id 찾기
    const htmlDir = path.resolve("./data/html");
    const dirName = uni.name.replace(/ /g, "_");
    const candidates = [
      path.join(htmlDir, dirName, "admission_calculator.json"),
      path.join(htmlDir, dirName, "admissions_calculator.json"),
    ];

    let usnewsId = null;
    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, "utf8");
          const data = JSON.parse(raw);
          usnewsId = data.data?.admissions_calculator?.school?.school_id || null;
          if (usnewsId) break;
        } catch (error) {
          // 파일 읽기 실패시 계속 진행
        }
      }
    }

    return {
      ...uni,
      usnews_id: usnewsId
    };
  });
}

async function clearUniversitiesCollection(): Promise<void> {
  const db = getDatabase();
  const collection = db.collection("universities");
  const result = await collection.deleteMany({});
  console.log(`🗑️ Deleted ${result.deletedCount} existing documents`);
}

async function uploadAdmissionCalculators(): Promise<void> {
  const htmlRoot = path.resolve("./data/html");
  
  if (!fs.existsSync(htmlRoot)) {
    console.log("⚠️ No data/html directory found");
    return;
  }

  const dirs = fs
    .readdirSync(htmlRoot)
    .filter((item) => {
      const p = path.join(htmlRoot, item);
      return fs.statSync(p).isDirectory();
    })
    .sort();

  if (dirs.length === 0) {
    console.log("⚠️ No university directories found");
    return;
  }

  console.log(`📂 Found ${dirs.length} university directories`);

  const db = getDatabase();
  const collection = db.collection("admission_calculators");
  let inserted = 0;
  let skippedMissingFile = 0;

  for (const dirName of dirs) {
    const dirPath = path.join(htmlRoot, dirName);
    const candidates = [
      path.join(dirPath, "admission_calculator.json"),
      path.join(dirPath, "admissions_calculator.json"),
    ];

    let data = null;
    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, "utf8");
          data = JSON.parse(raw);
          break;
        } catch (error) {
          console.error(`❌ Failed to parse JSON: ${filePath}`, error);
        }
      }
    }

    if (!data) {
      skippedMissingFile++;
      continue;
    }

    const universityName = dirName.replace(/_/g, " ");
    
    // 필요한 데이터만 추출
    const cleanData = {
      universityName,
      school: data.data?.admissions_calculator?.school || null,
      userTestScores: data.data?.admissions_calculator?.user_test_scores || null,
      hasEnoughData: data.data?.admissions_calculator?.has_enough_data_to_display || false,
      dataPoints: data.data?.admissions_calculator?.adms_calc_datapoints || [],
      validScoreConditions: data.data?.admissions_calculator?.valid_score_conditions || null,
      uploadedAt: new Date()
    };

    try {
      const result = await collection.replaceOne(
        { universityName: universityName },
        cleanData,
        { upsert: true }
      );
      
      if (result.upsertedCount > 0) {
        inserted++;
        console.log(`✅ Inserted admission calculator for '${universityName}'`);
      } else if (result.modifiedCount > 0) {
        inserted++;
        console.log(`🔄 Updated admission calculator for '${universityName}'`);
      } else {
        console.log(`ℹ️ No changes for '${universityName}'`);
      }
    } catch (error) {
      console.error(`❌ Failed to upsert '${universityName}'`, error);
    }
  }

  console.log(`\n📊 Admission calculator upload summary:`);
  console.log(`  Processed: ${inserted}`);
  console.log(`  Missing file: ${skippedMissingFile}`);
}

// Default export
export default uploadDataToMongoDB;

// CLI 실행 부분
if (require.main === module) {
  uploadDataToMongoDB()
    .then(() => {
      console.log('✨ Process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Process failed:', error);
      process.exit(1);
    });
}
