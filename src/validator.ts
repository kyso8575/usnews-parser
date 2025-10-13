import type { ExtractionConfig } from "./config";

// -------------------- Data Integrity Validation --------------------
export function validateDataIntegrity(
  result: Record<string, unknown>,
  cfg: ExtractionConfig,
  fieldPath: string
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  
  for (const [key, value] of Object.entries(result)) {
    const fieldConfig = cfg[key];
    if (!fieldConfig || !fieldConfig.type) continue;
    
    const typeErrors: string[] = [];
    const expectedType = fieldConfig.type;
    
    // Type validation (skip if value is null - means data wasn't found)
    if (value === null) {
      continue; // Skip validation for null values (missing data)
    }
    
    if (expectedType === "number") {
      if (typeof value !== "number" || isNaN(value)) {
        typeErrors.push(`Expected number but got ${typeof value}: ${JSON.stringify(value)}`);
      }
    } else if (expectedType === "string") {
      if (typeof value !== "string") {
        typeErrors.push(`Expected string but got ${typeof value}: ${JSON.stringify(value)}`);
      }
    } else if (expectedType === "array") {
      if (!Array.isArray(value)) {
        typeErrors.push(`Expected array but got ${typeof value}: ${JSON.stringify(value)}`);
      }
    } else if (expectedType === "object") {
      if (typeof value !== "object" || Array.isArray(value)) {
        typeErrors.push(`Expected object but got ${typeof value}: ${JSON.stringify(value)}`);
      }
    } else if (expectedType === "boolean") {
      if (typeof value !== "boolean") {
        typeErrors.push(`Expected boolean but got ${typeof value}: ${JSON.stringify(value)}`);
      }
    }
    
    // Object value type validation
    if (expectedType === "object" && typeof value === "object" && value !== null) {
      const objectValue = value as Record<string, unknown>;
      
      if (fieldConfig.objectMapping) {
        // Check predefined object mapping values
        for (const [objKey, objCfg] of Object.entries(fieldConfig.objectMapping)) {
          const objectFieldValue = objectValue[objKey];
          if (objectFieldValue !== undefined && objectFieldValue !== null && objCfg.type) {
            const validateObjValue = validateSingleValue(objectFieldValue, objCfg.type, `${key}.${objKey}`);
            typeErrors.push(...validateObjValue);
          }
        }
      }
    }
    
    // Array element validation
    if (expectedType === "array" && Array.isArray(value)) {
      const arrayValue = value as unknown[];
      
      if (fieldConfig.getItemType) {
        for (let i = 0; i < arrayValue.length; i++) {
          const validateArrayItem = validateSingleValue(arrayValue[i], fieldConfig.getItemType, `${key}[${i}]`);
          typeErrors.push(...validateArrayItem);
        }
      }
    }
    
    if (typeErrors.length > 0) {
      errors[key] = typeErrors;
    }
  }
  
  return errors;
}

function validateSingleValue(value: unknown, expectedType: string, path: string): string[] {
  const errors: string[] = [];
  
  if (expectedType === "number") {
    if (typeof value !== "number" || isNaN(value)) {
      errors.push(`${path}: Expected number but got ${typeof value}: ${JSON.stringify(value)}`);
    }
  } else if (expectedType === "string") {
    if (typeof value !== "string") {
      errors.push(`${path}: Expected string but got ${typeof value}: ${JSON.stringify(value)}`);
    }
  } else if (expectedType === "boolean") {
    if (typeof value !== "boolean") {
      errors.push(`${path}: Expected boolean but got ${typeof value}: ${JSON.stringify(value)}`);
    }
  }
  
  return errors;
}

// -------------------- Data Integrity Reporter --------------------
export function reportDataIntegrity(
  universityName: string,
  errors: Record<string, string[]>
): void {
  const totalErrors = Object.keys(errors).length;
  
  if (totalErrors === 0) {
    console.log(`✅ ${universityName}: 데이터 무결성 검사 통과`);
    return;
  }
  
  console.log(`⚠️  ${universityName}: 데이터 타입 불일치 ${totalErrors}개 발견`);
  
  for (const [fieldPath, fieldErrors] of Object.entries(errors)) {
    console.log(`  📍 ${fieldPath}:`);
    fieldErrors.forEach(error => {
      console.log(`    ❌ ${error}`);
    });
  }
}

// -------------------- Additional Validation Functions --------------------
export function validateCompleteDataset(data: Record<string, unknown>[]): void {
  console.log('\n🔍 전체 데이터셋 무결성 검사 시작...\n');
  
  let totalUniversities = data.length;
  let passCount = 0;
  let failCount = 0;
  const allErrors: Array<{university: string, errors: Record<string, string[]>}> = [];
  
  data.forEach(record => {
    const universityName = record.name as string;
    const errors: Record<string, string[]> = {};
    
    // Sample validation - check for required fields
    const requiredFields = ['name', '_id'];
    requiredFields.forEach(field => {
      if (!record[field]) {
        if (!errors['required']) errors['required'] = [];
        errors['required'].push(`Missing required field: ${field}`);
      }
    });
    
    if (Object.keys(errors).length === 0) {
      passCount++;
      if (totalUniversities <= 5 || Math.random() < 0.1) { // Show some results for small datasets or randomly
        reportDataIntegrity(universityName, errors);
      }
    } else {
      failCount++;
      allErrors.push({ university: universityName, errors });
      reportDataIntegrity(universityName, errors);
    }
  });
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 데이터셋 무결성 검사 요약');
  console.log('='.repeat(50));
  console.log(`총 대학 수: ${totalUniversities}`);
  console.log(`✅ 통과: ${passCount}`);
  console.log(`❌ 실패: ${failCount}`);
  
  if (failCount > 0) {
    console.log(`\n최대 10개 오류 표시:`);
    allErrors.slice(0, 10).forEach(({university, errors}) => {
      console.log(`\n🏫 ${university}:`);
      Object.entries(errors).forEach(([field, fieldErrors]) => {
        fieldErrors.forEach(error => console.log(`  ❌ ${error}`));
      });
    });
  }
  
  console.log('\n' + '='.repeat(50));
}
