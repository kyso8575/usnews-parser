#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Create a unified JSON file from all individual university files
function createUnifiedOutput() {
  const outputDir = path.resolve('./output');
  const allJsonFiles = fs.readdirSync(outputDir)
    .filter(file => file.endsWith('.json'))
    .sort();

  console.log(`📖 Reading ${allJsonFiles.length} university data files...`);

  const unifiedUniversities = [];

  allJsonFiles.forEach(file => {
    const filePath = path.join(outputDir, file);
    const universityName = path.basename(file, '.json').replace(/_/g, ' ');
    
    try {
      const universityData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // MongoDB-friendly structure
      const universityDocument = {
        _id: universityName, // MongoDB will use this as the unique identifier
        name: universityName,
        slug: path.basename(file, '.json'), // URL-friendly identifier
        ...universityData // Spread all the extracted data
      };
      
      unifiedUniversities.push(universityDocument);
      console.log(`✅ Processed: ${universityName}`);
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  });

  // Create the unified JSON file
  const unifiedPath = path.resolve('./output-unified.json');
  fs.writeFileSync(unifiedPath, JSON.stringify(unifiedUniversities, null, 2));
  
  console.log(`\n🎉 Unified JSON created: ${unifiedPath}`);
  console.log(`📊 Total universities: ${unifiedUniversities.length}`);
  console.log(`📋 Structure: MongoDB-ready documents in array format`);
  console.log(`💾 File size: ${(fs.statSync(unifiedPath).size / 1024 / 1024).toFixed(2)} MB`);
}

// Also create a MongoDB import script
function createMongoImportScript() {
  const scriptContent = `#!/bin/bash

# MongoDB Import Script
# This script imports the unified university data into MongoDB

MONGO_URI="mongodb://localhost:27017"
DATABASE_NAME="usnews"
COLLECTION_NAME="universities"

echo "🔄 Importing university data to MongoDB..."
echo "Database: \${DATABASE_NAME}"
echo "Collection: \${COLLECTION_NAME}"

# Import the unified JSON file
mongoimport --uri="\${MONGO_URI}/\${DATABASE_NAME}" \\
  --collection="\${COLLECTION_NAME}" \\
  --file="./output-unified.json" \\
  --jsonArray \\
  --drop

echo "✅ Import completed!"
echo "🔍 You can verify with: mongo \${DATABASE_NAME} --eval "db.universities.count()""
`;

  fs.writeFileSync('./import-to-mongo.sh', scriptContent);
  fs.chmodSync('./import-to-mongo.sh', '0755');
  
  console.log(`\n📝 MongoDB import script created: ./import-to-mongo.sh`);
  console.log(`📋 Usage: ./import-to-mongo.sh`);
}

// Run the functions
createUnifiedOutput();
createMongoImportScript();
