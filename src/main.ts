import * as fs from "fs";
import * as path from "path";
import { config, type ExtractionConfig } from "./config";
import { extractFromHtml, saveResults } from "./extractor";

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

// -------------------- Main Entry Point --------------------
function processUniversity(universityName: string): void {
  const universityDir = path.resolve(`./data/html/${universityName}`);
  
  if (!fs.existsSync(universityDir)) {
    console.log(`❌ University directory not found: ${universityName}`);
    return;
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

  saveResults(allExtracted, universityName);
  console.log(`✅ ${universityName} completed`);
}

// -------------------- Unified JSON Generation --------------------
function createUnifiedOutput(): void {
  console.log('\n🔄 Creating unified JSON output for MongoDB...');
  
  const outputDir = path.resolve('./output');
  const allJsonFiles = fs.readdirSync(outputDir)
    .filter(file => file.endsWith('.json'))
    .sort();

  console.log(`📖 Reading ${allJsonFiles.length} university data files...`);

  const unifiedUniversities: any[] = [];

  allJsonFiles.forEach(file => {
    const filePath = path.join(outputDir, file);
    const universityName = path.basename(file, '.json').replace(/_/g, ' ');
    
    try {
      const universityData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // MongoDB-friendly structure
      const universityDocument = {
        _id: universityName,
        name: universityName,
        slug: path.basename(file, '.json'),
        ...universityData
      };
      
      unifiedUniversities.push(universityDocument);
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error);
    }
  });

  // Save unified output
  const unifiedPath = path.resolve('./output-unified.json');
  fs.writeFileSync(unifiedPath, JSON.stringify(unifiedUniversities, null, 2));
  
  console.log(`✅ Unified JSON created: ${unifiedPath}`);
  console.log(`📊 Total universities: ${unifiedUniversities.length}`);
  console.log(`💾 Ready for MongoDB import!`);
}

// Get command line argument or process all universities
const args = process.argv.slice(2);

if (args.length > 0) {
  const command = args[0];
  
  if (command === 'unified') {
    // Generate unified JSON only
    createUnifiedOutput();
  } else {
    // Process specific university
    processUniversity(command);
  }
} else {
  // Process all universities
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

  let successCount = 0;
  let errorCount = 0;

  universities.forEach((university, index) => {
    try {
      console.log(`[${index + 1}/${universities.length}] Processing ${university}...`);
      processUniversity(university);
      successCount++;
    } catch (error) {
      console.log(`❌ ${university} failed: ${error}`);
      errorCount++;
    }
  });

  console.log('\n' + '='.repeat(50));
  console.log('BATCH PROCESSING COMPLETE');
  console.log('='.repeat(50));
  console.log(`Total universities: ${universities.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${errorCount}`);
  
  // Automatically create unified output after processing all universities
  if (successCount > 0) {
    createUnifiedOutput();
  }
}
