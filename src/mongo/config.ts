import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const mongoConfig = {
  uri: process.env.MONGODB_URI,
  dbName: process.env.MONGODB_DB_NAME || 'euodia-universities',
  collectionName: process.env.MONGODB_COLLECTION_NAME || 'universities'
};

// 환경변수 검증
if (!mongoConfig.uri) {
  throw new Error('MONGODB_URI environment variable is required');
}

export interface UniversityDocument {
  _id: string;
  name: string;
  [key: string]: any;
}
