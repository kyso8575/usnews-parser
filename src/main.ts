import * as fs from "fs";
import * as path from "path";
import { config, type ExtractionConfig } from "./config";
import { extractFromHtml, saveResults, processRankingsData } from "./extractor";

function getPagePrefixFromFilename(filename: string): string {
  const baseName = path.basename(filename, '.html');
  if (baseName === 'overall_rankings') return 'overallRankings';
  if (baseName === 'campus_info') return 'campusInfo';
  if (baseName === 'applying') return 'applying';
  if (baseName === 'academics') return 'academics';
  if (baseName === 'student_life') return 'studentLife';
  return baseName;
}

function filterConfigByPage(fullConfig: ExtractionConfig, pagePrefix: string): ExtractionConfig {
  const filtered: ExtractionConfig = {};
  for (const [key, value] of Object.entries(fullConfig)) {
    if (key.startsWith(pagePrefix + '.')) {
      filtered[key] = value;
    }
  }
  return filtered;
}

// -------------------- University Processing --------------------
function processUniversity(universityName: string): any {
  const universityDir = path.resolve(`./data/html/${universityName}`);
  
  if (!fs.existsSync(universityDir)) {
    console.log(`❌ University directory not found: ${universityName}`);
    return null;
  }

  const htmlFiles = fs.readdirSync(universityDir).filter(file => file.endsWith('.html'));
  let allExtracted: Record<string, unknown> = {};

  for (const htmlFile of htmlFiles) {
    console.log(`  Processing ${htmlFile}...`);

    const htmlPath = path.join(universityDir, htmlFile);
    const htmlContent = fs.readFileSync(htmlPath, "utf8");

    const pagePrefix = getPagePrefixFromFilename(htmlFile);
    const pageConfig = filterConfigByPage(config, pagePrefix);

    if (Object.keys(pageConfig).length === 0) {
      console.log(`  No config found for page: ${pagePrefix}`);
      continue;
    }

    const extracted = extractFromHtml(htmlContent, pageConfig);
    allExtracted = { ...allExtracted, ...extracted };
  }

  console.log(`✅ ${universityName} completed`);
  return allExtracted;
}

// -------------------- Random ID Generation --------------------
function generateRandomId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// -------------------- Single University Processing --------------------
function processSingleUniversity(universityInput: string): void {
  console.log(`\n🎯 Processing single university: ${universityInput}`);
  
  // Convert university name to directory format
  const directoryName = universityInput.replace(/ /g, '_');
  
  try {
    const universityData = processUniversity(directoryName);
    
    if (universityData) {
      const universityName = universityInput;
      const processedData = processRankingsData(universityData);
      const universityDocument = {
        _id: generateRandomId(),
        name: universityName,
        ...processedData
      };

      // Create single-item array for consistent format
      const unifiedUniversities = [universityDocument];
      
      // Save unified output
      const unifiedPath = path.resolve('./output/output-unified.json');
      fs.writeFileSync(unifiedPath, JSON.stringify(unifiedUniversities, null, 2));
      
  console.log(`✅ Single university processed`);
  console.log(`📝 Unified JSON created: ${unifiedPath}`);
  console.log(`📊 Total universities: 1`);
    }
  } catch (error) {
    console.log(`❌ ${universityInput} failed: ${error}`);
  }
}

// -------------------- All Universities Processing --------------------
function processAllUniversities(): void {
  const htmlDir = path.resolve("./data/html");
  const universities = fs.readdirSync(htmlDir)
    .filter(item => {
      const itemPath = path.join(htmlDir, item);
      return fs.statSync(itemPath).isDirectory() && 
             fs.existsSync(path.join(itemPath, 'student_life.html'));
    })
    .sort();

  console.log(`Found ${universities.length} universities to process:`);
  universities.forEach((uni, index) => {
    console.log(`${index + 1}. ${uni}`);
  });

  console.log('\nStarting batch processing...\n');

  let unifiedUniversities: any[] = [];
  let successCount = 0;
  let errorCount = 0;

  universities.forEach((university, index) => {
    try {
      console.log(`[${index + 1}/${universities.length}] Processing ${university}...`);
      const universityData = processUniversity(university);
      
      if (universityData) {
        const universityName = university.replace(/_/g, ' ');
        const processedData = processRankingsData(universityData);
        const universityDocument = {
          _id: generateRandomId(),
          name: universityName,
          ...processedData
        };
        unifiedUniversities.push(universityDocument);
        successCount++;
      }
    } catch (error) {
      console.log(`❌ ${university} failed: ${error}`);
      errorCount++;
    }
  });

  // Save unified output
  const unifiedPath = path.resolve('./output/output-unified.json');
  fs.writeFileSync(unifiedPath, JSON.stringify(unifiedUniversities, null, 2));

  console.log('\n' + '='.repeat(50));
  console.log('BATCH PROCESSING COMPLETE');
  console.log('='.repeat(50));
  console.log(`Total universities: ${universities.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${errorCount}`);
  console.log(`✅ Unified JSON created: ${unifiedPath}`);
  console.log(`📊 Total universities: ${unifiedUniversities.length}`);
}

// -------------------- Main Entry Point --------------------
const args = process.argv.slice(2);

if (args.length > 0) {
  // Process specific university
  const universityName = args[0];
  processSingleUniversity(universityName);
} else {
  // Process all universities
  processAllUniversities();
}