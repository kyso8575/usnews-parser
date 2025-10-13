import { MongoClient, Db, Collection } from 'mongodb';
import { mongoConfig, UniversityDocument } from './config';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectToMongoDB(): Promise<void> {
  try {
    console.log('🔄 Connecting to MongoDB...');
    client = new MongoClient(mongoConfig.uri as string);
    await client.connect();
    db = client.db(mongoConfig.dbName);
    console.log('✅ Connected to MongoDB successfully');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
}

export async function disconnectFromMongoDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('🔌 Disconnected from MongoDB');
  }
}

export function getDatabase(): Db {
  if (!db) {
    throw new Error('Database not connected. Call connectToMongoDB() first.');
  }
  return db;
}

export function getUniversitiesCollection(): Collection<UniversityDocument> {
  const database = getDatabase();
  return database.collection<UniversityDocument>(mongoConfig.collectionName);
}

export async function uploadUniversityData(universities: UniversityDocument[]): Promise<void> {
  try {
    console.log(`🔄 Uploading ${universities.length} universities to MongoDB...`);
    
    const collection = getUniversitiesCollection();
    
    // 새 데이터 삽입 (중복 데이터는 업데이트)
    const result = await collection.insertMany(universities, { 
      ordered: false,  // 일부 문서 실패 시에도 계속 진행
      forceServerObjectId: false  // 클라이언트에서 생성한 _id 사용
    });
    console.log(`✅ Successfully uploaded ${result.insertedCount} universities`);
    
    // 중복 오류가 있는 경우 무시
    if (result.insertedCount < universities.length) {
      const duplicateCount = universities.length - result.insertedCount;
      console.log(`⚠️ ${duplicateCount} documents were duplicates and skipped`);
    }
    
  } catch (error: any) {
    // 중복 키 오류는 정상적인 경우로 처리
    if (error.code === 11000) {
      console.log('⚠️ Some documents already exist (duplicates skipped)');
      return;
    }
    console.error('❌ Failed to upload university data:', error);
    throw error;
  }
}

export async function getUniversityCount(): Promise<number> {
  try {
    const collection = getUniversitiesCollection();
    const count = await collection.countDocuments();
    return count;
  } catch (error) {
    console.error('❌ Failed to get university count:', error);
    throw error;
  }
}

export async function getAllUniversities(): Promise<UniversityDocument[]> {
  try {
    const collection = getUniversitiesCollection();
    const universities = await collection.find({}).toArray();
    return universities;
  } catch (error) {
    console.error('❌ Failed to get universities:', error);
    throw error;
  }
}
