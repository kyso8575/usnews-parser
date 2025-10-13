import { connectToMongoDB, disconnectFromMongoDB } from './client';

async function testConnection(): Promise<void> {
  try {
    console.log('🧪 Testing MongoDB connection...\n');
    
    // 연결 테스트
    await connectToMongoDB();
    
    // 연결 상태 확인
    console.log('✅ Connection successful!');
    
    // 사용 가능한 권한 확인을 위한 간단한 테스트
    console.log('🔍 Testing permissions...');
    
    const db = require('./client').getDatabase();
    console.log(`📊 Database name: ${db.databaseName}`);
    
    // collections 목록 조회 시도 (읽기 권한 테스트)
    try {
      const collections = await db.listCollections().toArray();
      console.log(`📋 Available collections: ${collections.length}`);
      collections.forEach((col: any) => {
        console.log(`  - ${col.name}`);
      });
    } catch (error: any) {
      console.log(`⚠️ Cannot list collections: ${error.message}`);
    }
    
    console.log('\n🎉 Connection test completed!');
    
  } catch (error) {
    console.error('❌ Connection test failed:', error);
  } finally {
    await disconnectFromMongoDB();
  }
}

// CLI 실행
if (require.main === module) {
  testConnection()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}
