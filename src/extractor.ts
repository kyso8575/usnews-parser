import * as fs from "fs";
import * as path from "path";
import { load, Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import { type FieldConfig, type ExtractionConfig } from "./config";
import { castValue, normalizeWhitespace, parseNumberFromString, parseSAT1600Scale } from "./utils";
import { applySteps } from "./parser";
import { extractSportsData, type SportsSection } from "./sportsExtractor";

function evaluateField(
  $: CheerioAPI,
  field: FieldConfig
): { element: Cheerio<AnyNode> | null; text: string | null; elements?: Cheerio<AnyNode> } {
  const found = applySteps(
    $,
    $.root() as unknown as Cheerio<AnyNode>,
    field.find
  );
  if (found.length === 0) {
    return { element: null, text: null };
  }

  // For array type, return all elements
  if (field.type === "array") {
    return { element: null, text: null, elements: found };
  }

  const target = ($ as unknown as CheerioAPI)(found.get(0));

  let text: string;
  if (field.getText && field.getText.length > 0) {
    const inner = applySteps($, target, field.getText);
    if (inner.length > 0) {
      text = ($ as unknown as CheerioAPI)(inner.get(0)).text();
    } else {
      text = target.text();
    }
  } else {
    text = target.text();
  }

  return { element: target, text };
}

export function extractFromHtml(
  html: string,
  cfg: ExtractionConfig
): Record<string, unknown> {
  const $ = load(html);
  const result: Record<string, unknown> = {};
  
  // Initialize sports data if needed
  let sportsData: SportsSection | null = null;
  const needsSportsData = needsSportsExtraction(cfg);
  if (needsSportsData) {
    sportsData = extractSportsData(html);
  }
  
  for (const [fieldPath, fieldCfg] of Object.entries(cfg)) {
    // Handle custom functions
    if (fieldCfg.type === "custom" && fieldCfg.customFunction) {
      let value = null;
      
      // Handle SAT 1600 scale parsing
      if (fieldCfg.customFunction === "parseSAT1600Scale") {
        const evaluation = evaluateField($, fieldCfg);
        if (evaluation.text) {
          value = parseSAT1600Scale(evaluation.text);
        }
      } else {
        // Handle sports data functions
        value = handleCustomSportsFunction(fieldPath, fieldCfg, sportsData);
      }
      
      if (value !== null) {
        result[fieldPath] = value;
      }
      continue;
    }
    
    const evaluation = evaluateField($, fieldCfg);

    if (fieldCfg.type === "array" && evaluation.elements) {
      result[fieldPath] = processArrayField($, fieldCfg, evaluation.elements, fieldPath);
    } else if (fieldCfg.type === "object" && fieldCfg.objectMapping && evaluation.elements) {
      result[fieldPath] = processObjectFieldWithElements($, fieldCfg, evaluation.elements, fieldPath);
    } else if (fieldCfg && fieldCfg.objectMapping) {
      result[fieldPath] = processObjectFieldWithoutElements($, fieldCfg, fieldPath);
    } else {
      // Handle single value
      const typed = castValue(evaluation.text, fieldCfg.type ?? "string");
      result[fieldPath] = typed;
    }
  }
  return result;
}


// -------------------- Helper Functions for Sports Data --------------------
function needsSportsExtraction(cfg: ExtractionConfig): boolean {
  return Object.values(cfg).some(field => 
    field.type === "custom" && field.customFunction === "extractSportsData"
  );
}

function handleCustomSportsFunction(
  fieldPath: string, 
  fieldCfg: FieldConfig, 
  sportsData: SportsSection | null
): unknown {
  if (fieldCfg.customFunction !== "extractSportsData" || !sportsData) {
    return null;
  }
  
  // Match exact field by suffix to avoid substring collisions
  if (fieldPath.endsWith(".nonscholarshipSports")) {
    return sportsData.nonscholarshipSports;
  } else if (fieldPath.endsWith(".scholarshipSports")) {
    return sportsData.scholarshipSports;
  } else if (fieldPath.endsWith(".clubSports")) {
    return sportsData.clubSports;
  } else if (fieldPath.endsWith(".intramuralRecreationalSports")) {
    return sportsData.intramuralRecreationalSports;
  }
  
  return null;
}

export function saveResults(data: Record<string, unknown>, filename: string): void {
  const outputPath = path.resolve("./output", `${filename}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`Results saved to: ${outputPath}`);
}

// -------------------- Ranking Data Custom Processing --------------------
export function processRankingsData(universityData: any): any {
  // 안전하게 복사
  const processedData = { ...universityData };
  
  if (processedData['overallRankings.allRankings'] && Array.isArray(processedData['overallRankings.allRankings'])) {
    const rankings = processedData['overallRankings.allRankings'];
    const rankingsObject: any = {};

    rankings.forEach((ranking: string) => {
      try {
        // 유연한 키 생성: 문자열을 URL-friendly 키로 변환
        const key = generateFlexibleKey(ranking);
        const rankValue = extractRankingNumber(ranking);
        
        if (key && rankValue !== null) {
          rankingsObject[key] = rankValue;
        }
      } catch (error) {
        // 파싱 실패시 해당 항목은 건너뛰기
        console.log(`Failed to process ranking: ${ranking}`);
      }
    });

    // 새로운 객체로 바꾸기
    delete processedData['overallRankings.allRankings'];
    
    // overallRankings.allRankings 객체로 변환
    processedData['overallRankings.allRankings'] = rankingsObject;
  }
  
  return processedData;
}

// Helper function to extract ranking number from text
function extractRankingNumber(text: string): number | null {
  const match = text.match(/#(\d+)/);
  return match ? parseInt(match[1]) : null;
}

// Helper function to generate flexible key from ranking text
function generateFlexibleKey(ranking: string): string | null {
  try {
    // 예시:
    // "#13 in National Universities (tie)" -> "nationalUniversities"
    // "#15 in Best Value Schools" -> "bestValueSchools"
    // "#1 in Writing in the Disciplines" -> "writingInTheDisciplines"
    
    // "#X in " 패턴을 찾아서 제거
    const match = ranking.match(/^#?\d+\s+in\s+/i);
    if (!match) return null;
    
    // 매칭된 부분을 제거
    let cleanText = ranking.substring(match[0].length);
    
    // "(tie)" 같은 괄호 내용 제거
    cleanText = cleanText.replace(/\s*\([^)]*\)$/, '');
    
    // 불필요한 단어들 필터링 (잘못된 문자열들 제거)
    if (cleanText.includes('g ') || cleanText.trim().length < 2) return null;
    
    // 특수문자 제거하고 공백 정규화
    cleanText = cleanText.replace(/[^\w\s]/g, ' ')
                         .replace(/\s+/g, ' ')
                         .trim();
    
    // 공백 기준으로 단어 분리
    const words = cleanText.split(' ').filter(word => 
      word.length > 1 && // 한 글자 단어 제외
      !word.match(/^[0-9]+$/) && // 숫자만 있는 단어 제외
      !word.toLowerCase().match(/^(the|a|an|and|or|of|in|on|at|to|for|with)$/) // 불용어 제외
    );
    
    if (words.length === 0) return null;
    
    // CamelCase 생성
    const result = words.map((word, index) => {
      const cleanWord = word.toLowerCase();
      return index === 0 ? cleanWord : cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1);
    }).join('');
    
    // 결과 검증
    if (result.length < 2 || result.length > 50) return null;
    
    return result;
    
  } catch (error) {
    console.log(`Error processing ranking text: ${ranking}`, error);
    return null;
  }
}

// -------------------- Extract From Html Helper Functions --------------------
function processArrayField(
  $: CheerioAPI,
  fieldCfg: FieldConfig,
  elements: Cheerio<AnyNode>,
  fieldPath: string
): unknown[] {
      const texts: string[] = [];
  
  elements.each((_, el) => {
        let elementText: string;
        if (fieldCfg.getText && fieldCfg.getText.length > 0) {
          const inner = applySteps($, ($ as unknown as CheerioAPI)(el), fieldCfg.getText);
          if (inner.length > 0) {
            elementText = ($ as unknown as CheerioAPI)(inner.get(0)).text().trim();
          } else {
            elementText = ($ as unknown as CheerioAPI)(el).text().trim();
          }
        } else {
          elementText = ($ as unknown as CheerioAPI)(el).text().trim();
        }
        if (elementText) {
          texts.push(normalizeWhitespace(elementText));
        }
      });
      
  // Special handling for specific field types
      if (fieldPath.includes('greekLife') && fieldPath.includes('undergraduate')) {
    return splitGreekLifeText(texts);
  } else if (fieldPath.includes('studentParticipationInSpecialStudyOptions') || fieldPath.includes('studentParticipationInSpecialAcademicPrograms')) {
    return filterPercentageOnlyEntries(texts);
  }
  
  return texts;
}

function processObjectFieldWithElements(
  $: CheerioAPI,
  fieldCfg: FieldConfig,
  elements: Cheerio<AnyNode>,
  fieldPath: string
): Record<string, unknown> {
      const obj: Record<string, unknown> = {};
      
  for (const [key, mapping] of Object.entries(fieldCfg.objectMapping || {})) {
        // Find elements that match the mapping criteria
    const matchingElements = elements.filter((_, el) => {
          const $el = ($ as unknown as CheerioAPI)(el);
      return mapping.find?.every(step => {
            if (step.startsWith('haveText:')) {
              const text = step.substring(9);
              return $el.text().includes(text);
            }
            return true;
      }) ?? false;
        });
        
        if (matchingElements.length > 0) {
          const targetEl = ($ as unknown as CheerioAPI)(matchingElements.get(0));
          let text: string;
          
          if (mapping.getText && mapping.getText.length > 0) {
            const inner = applySteps($, targetEl, mapping.getText);
            if (inner.length > 0) {
              text = ($ as unknown as CheerioAPI)(inner.get(0)).text().trim();
            } else {
              text = targetEl.text().trim();
            }
          } else {
            text = targetEl.text().trim();
          }
          
            if (text) {
        obj[key] = cleanTextValue(fieldPath, key, text);
      }
    }
  }
  
  return obj;
}

function processObjectFieldWithoutElements(
  $: CheerioAPI,
  fieldCfg: FieldConfig,
  fieldPath: string
): Record<string, unknown> {
  // Get the base elements from the main find steps
  const baseElements = applySteps($, $.root() as unknown as Cheerio<AnyNode>, fieldCfg.find || []);
  
  // Check if this is a flexible mapping (no specific keys defined)
  if (fieldCfg.flexibleMapping) {
    return extractFlexibleKeyValuePairs($, baseElements);
  } else {
    return processPredefinedMappings($, fieldCfg.objectMapping!, baseElements, fieldPath);
  }
}

// -------------------- Array Processing Helper Functions --------------------
function splitGreekLifeText(texts: string[]): string[] {
  const splitTexts: string[] = [];
  texts.forEach(text => {
    // Split text like "Independent100%" into "Independent" and "100%"
    const match = text.match(/^([A-Za-z\s]+)(\d+%)$/);
    if (match) {
      splitTexts.push(match[1].trim());
      splitTexts.push(match[2]);
    } else {
      splitTexts.push(text);
    }
  });
  return splitTexts;
}

function filterPercentageOnlyEntries(texts: string[]): string[] {
  // Remove percentage-only entries from student participation data
  return texts.filter(text => {
    // Keep only entries that are not just percentages
    return !/^\d+%$/.test(text.trim());
  });
}

// -------------------- Object Processing Helper Functions --------------------
function cleanTextValue(fieldPath: string, key: string, text: string): unknown {
              let cleanedText = normalizeWhitespace(text);
  
              if (fieldPath.includes('facultyAndClasses') && (key === 'full_time' || key === 'part_time')) {
                // Remove trailing labels like "full time" or "part time"
                cleanedText = cleanedText.replace(/\s+(full time|part time)$/i, '');
              }
  
              if (fieldPath.includes('totalFaculty') && (key === 'full_time' || key === 'part_time')) {
                const numeric = parseNumberFromString(cleanedText);
    return numeric ?? cleanedText;
              } else if (fieldPath.includes('GenderDistribution') || fieldPath.includes('EthnicDiversity') || fieldPath.includes('classSizes') || fieldPath.includes('studentDemographics') || fieldPath.includes('greekLife')) {
                // Extract percentage from text like "Male60.7%" -> "60.7%"
                const percentageMatch = cleanedText.match(/(\d+\.?\d*%)/);
    return percentageMatch ? percentageMatch[1] : cleanedText;
              } else if (fieldPath.includes('studentsRequiredToLiveInSchoolHousing')) {
                // Extract Yes/No from text like "First-year StudentsYes" -> "Yes"
                const yesNoMatch = cleanedText.match(/(Yes|No)$/);
    return yesNoMatch ? yesNoMatch[1] : cleanedText;
  }
  
  return cleanedText;
}

function extractFlexibleKeyValuePairs(
  $: CheerioAPI,
  baseElements: Cheerio<AnyNode>
): Record<string, unknown> {
      const obj: Record<string, unknown> = {};
      
        for (let i = 0; i < baseElements.length; i++) {
          const $el = ($ as unknown as CheerioAPI)(baseElements.get(i));
          
          // Look for the pattern: first p tag (name) and last p tag (value)
          const nameEl = $el.find('p.Paragraph-sc-1iyax29-0.iKkzvP:first-child');
          const valueEl = $el.find('p.Paragraph-sc-1iyax29-0.iKkzvP:last-child');
          
          if (nameEl.length > 0 && valueEl.length > 0) {
            const name = nameEl.text().trim();
            const value = valueEl.text().trim();
            
            if (name && value) {
              // Convert name to camelCase key
              const key = name.toLowerCase()
                .replace(/[^a-z0-9\s]/g, '') // Remove special characters
                .replace(/\s+/g, '') // Remove spaces
                .substring(0, 50); // Limit length
              
              obj[key] = value;
            }
          }
        }
  
  return obj;
}

function processPredefinedMappings(
  $: CheerioAPI,
  objectMapping: Record<string, FieldConfig>,
  baseElements: Cheerio<AnyNode>,
  fieldPath: string
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  
  for (const [key, mapping] of Object.entries(objectMapping)) {
          // Find elements that match the mapping criteria within base elements
          const matchingElements = baseElements.filter((_, el) => {
            const $el = ($ as unknown as CheerioAPI)(el);
      return mapping.find?.every(step => {
              if (step.startsWith('haveText:')) {
                const text = step.substring(9);
                return $el.text().includes(text);
              }
              return true;
      }) ?? false;
          });
          
          if (matchingElements.length > 0) {
            const targetEl = ($ as unknown as CheerioAPI)(matchingElements.get(0));
            let text: string;
            
            if (mapping.getText && mapping.getText.length > 0) {
              const inner = applySteps($, targetEl, mapping.getText);
              if (inner.length > 0) {
                text = ($ as unknown as CheerioAPI)(inner.get(0)).text().trim();
              } else {
                text = targetEl.text().trim();
              }
            } else {
              text = targetEl.text().trim();
            }
            
            if (text) {
        obj[key] = cleanTextValue(fieldPath, key, text);
      }
    }
  }
  
  return obj;
}