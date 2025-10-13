#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Read the extraction config
const configPath = path.resolve('./data/extraction-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Read all university data
const outputDir = path.resolve('./output');
const allJsonFiles = fs.readdirSync(outputDir)
  .filter(file => file.endsWith('.json'))
  .sort();

const allUniversityData = {};

allJsonFiles.forEach(file => {
  const filePath = path.join(outputDir, file);
  const universityName = path.basename(file, '.json');
  allUniversityData[universityName] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
});

console.log('📖 Reading extraction config and all university data...');
console.log(`Found ${Object.keys(config).length} fields`);
console.log(`Universities: ${Object.keys(allUniversityData).length} total`);

// Helper function to get example value
function getExampleValue(key, fieldConfig) {
  // Try to find value in all university data
  for (const [university, data] of Object.entries(allUniversityData)) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '' && 
        data[key] !== 'N/A' && data[key] !== 'n/a' && data[key] !== 'NA' && 
        data[key] !== 'na' && data[key] !== 'null' && data[key] !== 'NULL') {
      const value = data[key];
      
      // Format based on type
      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          return value.slice(0, 3).join(', ') + (value.length > 3 ? '...' : '');
        } else {
          const entries = Object.entries(value).slice(0, 3);
          return entries.map(([k, v]) => `${k}: ${v}`).join(', ') + 
                 (Object.keys(value).length > 3 ? '...' : '');
        }
      }
      
      return String(value);
    }
  }
  
  // Generate example based on field type and description
  const description = fieldConfig.description?.toLowerCase() || '';
  const koreanDesc = fieldConfig.korean_description?.toLowerCase() || '';
  
  if (description.includes('percentage') || koreanDesc.includes('비율')) {
    return '85%';
  }
  if (description.includes('cost') || description.includes('price') || koreanDesc.includes('비용') || koreanDesc.includes('가격')) {
    return '$45,000';
  }
  if (description.includes('rank') || koreanDesc.includes('순위')) {
    return '#3';
  }
  if (description.includes('score') || koreanDesc.includes('점수')) {
    return '95/100';
  }
  if (description.includes('age') || koreanDesc.includes('나이')) {
    return '22';
  }
  if (description.includes('year') || koreanDesc.includes('년')) {
    return '2024';
  }
  if (description.includes('date') || koreanDesc.includes('날짜')) {
    return 'January 1, 2024';
  }
  if (description.includes('yes') || description.includes('no') || koreanDesc.includes('여부')) {
    return 'Yes';
  }
  if (description.includes('number') || description.includes('count') || koreanDesc.includes('수')) {
    return '1,500';
  }
  
  return 'Sample data';
}

// Create worksheet data
const worksheetData = [];

// Header row
const headerRow = ['Keys', 'Description', 'Korean Description', 'Example'];
worksheetData.push(headerRow);

// Data rows: one per field
const sortedKeys = Object.keys(config).sort();

sortedKeys.forEach(key => {
  const fieldConfig = config[key];
  const example = getExampleValue(key, fieldConfig);
  
  const row = [
    key,
    fieldConfig.description || '',
    fieldConfig.korean_description || '',
    example
  ];
  worksheetData.push(row);
});

console.log(`📊 Created ${worksheetData.length} rows (including header)`);

// Create workbook and worksheet
const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

// Set column widths
const colWidths = [
  { wch: 50 }, // Keys column
  { wch: 60 }, // Description column
  { wch: 60 }, // Korean Description column
  { wch: 40 }  // Example column
];
worksheet['!cols'] = colWidths;

// Add worksheet to workbook
XLSX.utils.book_append_sheet(workbook, worksheet, 'University Data Fields');

// Save Excel file
const excelPath = path.resolve('./university_data_fields_with_examples.xlsx');
XLSX.writeFile(workbook, excelPath);

console.log(`✅ Excel file created: ${excelPath}`);
console.log(`📋 Columns: Keys | Description | Korean Description | Example`);
console.log(`📊 Total fields: ${sortedKeys.length}`);
