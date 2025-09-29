#!/bin/bash

# MongoDB Import Script
# This script imports the unified university data into MongoDB

MONGO_URI="mongodb://localhost:27017"
DATABASE_NAME="usnews"
COLLECTION_NAME="universities"

echo "🔄 Importing university data to MongoDB..."
echo "Database: ${DATABASE_NAME}"
echo "Collection: ${COLLECTION_NAME}"

# Import the unified JSON file
mongoimport --uri="${MONGO_URI}/${DATABASE_NAME}" \
  --collection="${COLLECTION_NAME}" \
  --file="./output-unified.json" \
  --jsonArray \
  --drop

echo "✅ Import completed!"
echo "🔍 You can verify with: mongo ${DATABASE_NAME} --eval "db.universities.count()""
