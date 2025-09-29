import * as fs from "fs";
import * as path from "path";
import { load, Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import { type FieldConfig, type ExtractionConfig } from "./config";
import { castValue, normalizeWhitespace, parseNumberFromString } from "./utils";
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
  
  // Cache sports data if any custom sports fields are present
  let sportsData: SportsSection | null = null;
  for (const [fieldPath, fieldCfg] of Object.entries(cfg)) {
    // Handle custom functions
    if (fieldCfg.type === "custom" && fieldCfg.customFunction) {
      if (fieldCfg.customFunction === "extractSportsData") {
        if (!sportsData) {
          sportsData = extractSportsData(html);
        }
        // Match exact field by suffix to avoid substring collisions
        if (fieldPath.endsWith(".nonscholarshipSports")) {
          result[fieldPath] = sportsData.nonscholarshipSports;
        } else if (fieldPath.endsWith(".scholarshipSports")) {
          result[fieldPath] = sportsData.scholarshipSports;
        } else if (fieldPath.endsWith(".clubSports")) {
          result[fieldPath] = sportsData.clubSports;
        } else if (fieldPath.endsWith(".intramuralRecreationalSports")) {
          result[fieldPath] = sportsData.intramuralRecreationalSports;
        }
      }
      continue;
    }
    const evaluation = evaluateField($, fieldCfg);

    if (fieldCfg.type === "array" && evaluation.elements) {
      // Handle array type - extract text from all elements
      const texts: string[] = [];
      evaluation.elements.each((_, el) => {
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
      
      // Special handling for Greek Life data - split text and percentage
      if (fieldPath.includes('greekLife') && fieldPath.includes('undergraduate')) {
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
        result[fieldPath] = splitTexts;
      } else if (fieldPath.includes('studentParticipationInSpecialStudyOptions') || fieldPath.includes('studentParticipationInSpecialAcademicPrograms')) {
        // Remove percentage-only entries from student participation data
        const filteredTexts = texts.filter(text => {
          // Keep only entries that are not just percentages
          return !/^\d+%$/.test(text.trim());
        });
        result[fieldPath] = filteredTexts;
      } else {
        result[fieldPath] = texts;
      }
    } else if (fieldCfg.type === "object" && fieldCfg.objectMapping && evaluation.elements) {
      // Handle object type - extract multiple fields into an object
      const obj: Record<string, unknown> = {};
      
      for (const [key, mapping] of Object.entries(fieldCfg.objectMapping)) {
        // Find elements that match the mapping criteria
        const matchingElements = evaluation.elements.filter((_, el) => {
          const $el = ($ as unknown as CheerioAPI)(el);
          // Check if element contains the required text
          return mapping.find.every(step => {
            if (step.startsWith('haveText:')) {
              const text = step.substring(9);
              return $el.text().includes(text);
            }
            return true;
          });
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
              // Clean up faculty data and coerce numbers where applicable
              let cleanedText = normalizeWhitespace(text);
              if (fieldPath.includes('facultyAndClasses') && (key === 'full_time' || key === 'part_time')) {
                // Remove trailing labels like "full time" or "part time"
                cleanedText = cleanedText.replace(/\s+(full time|part time)$/i, '');
              }
              if (fieldPath.includes('totalFaculty') && (key === 'full_time' || key === 'part_time')) {
                const numeric = parseNumberFromString(cleanedText);
                obj[key] = numeric ?? cleanedText;
              } else if (fieldPath.includes('GenderDistribution') || fieldPath.includes('EthnicDiversity') || fieldPath.includes('classSizes') || fieldPath.includes('studentDemographics') || fieldPath.includes('greekLife')) {
                // Extract percentage from text like "Male60.7%" -> "60.7%"
                const percentageMatch = cleanedText.match(/(\d+\.?\d*%)/);
                obj[key] = percentageMatch ? percentageMatch[1] : cleanedText;
              } else if (fieldPath.includes('studentsRequiredToLiveInSchoolHousing')) {
                // Extract Yes/No from text like "First-year StudentsYes" -> "Yes"
                const yesNoMatch = cleanedText.match(/(Yes|No)$/);
                obj[key] = yesNoMatch ? yesNoMatch[1] : cleanedText;
              } else {
                obj[key] = cleanedText;
              }
            }
        }
      }
      
      result[fieldPath] = obj;
    } else if (fieldCfg.type === "object" && fieldCfg.objectMapping) {
      // Handle object type when no elements found - try to extract from the found elements
      const obj: Record<string, unknown> = {};
      
      // Get the base elements from the main find steps
      const baseElements = applySteps($, $.root() as unknown as Cheerio<AnyNode>, fieldCfg.find || []);
      
      // Check if this is a flexible mapping (no specific keys defined)
      if (fieldCfg.flexibleMapping) {
        // Extract all key-value pairs dynamically from list items
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
      } else {
        // Use predefined mapping
        for (const [key, mapping] of Object.entries(fieldCfg.objectMapping)) {
          // Find elements that match the mapping criteria within base elements
          const matchingElements = baseElements.filter((_, el) => {
            const $el = ($ as unknown as CheerioAPI)(el);
            // Check if element contains the required text
            return mapping.find.every(step => {
              if (step.startsWith('haveText:')) {
                const text = step.substring(9);
                return $el.text().includes(text);
              }
              return true;
            });
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
              // Clean up faculty data - remove labels and coerce numbers when appropriate
              let cleanedText = normalizeWhitespace(text);
              if (fieldPath.includes('facultyAndClasses') && (key === 'full_time' || key === 'part_time')) {
                cleanedText = cleanedText.replace(/\s+(full time|part time)$/i, '');
              }
              if (fieldPath.includes('totalFaculty') && (key === 'full_time' || key === 'part_time')) {
                const numeric = parseNumberFromString(cleanedText);
                obj[key] = numeric ?? cleanedText;
              } else if (fieldPath.includes('GenderDistribution') || fieldPath.includes('EthnicDiversity') || fieldPath.includes('classSizes') || fieldPath.includes('studentDemographics') || fieldPath.includes('greekLife')) {
                // Extract percentage from text like "Male60.7%" -> "60.7%"
                const percentageMatch = cleanedText.match(/(\d+\.?\d*%)/);
                obj[key] = percentageMatch ? percentageMatch[1] : cleanedText;
              } else if (fieldPath.includes('studentsRequiredToLiveInSchoolHousing')) {
                // Extract Yes/No from text like "First-year StudentsYes" -> "Yes"
                const yesNoMatch = cleanedText.match(/(Yes|No)$/);
                obj[key] = yesNoMatch ? yesNoMatch[1] : cleanedText;
              } else {
                obj[key] = cleanedText;
              }
            }
          }
        }
      }
      
      result[fieldPath] = obj;
    } else {
      // Handle single value
      const typed = castValue(evaluation.text, fieldCfg.type ?? "string");
      result[fieldPath] = typed;
    }
  }
  return result;
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
    const rankingsObject: any = {
      nationalRanking: null,
      bestValueSchools: null,
      engineeringPrograms: null,
      computerScience: null,
      psychologyPrograms: null,
      economics: null,
      writingInDisciplines: null,
      undergraduateResearch: null,
      serviceLearning: null,
      firstYearExperiences: null,
      seniorCapstone: null,
      collegesForVeterans: null,
      undergraduateTeaching: null,
      innovativeSchools: null,
      socialMobility: null
    };

    rankings.forEach((ranking: string) => {
      try {
        // Ranking 타입별로 파싱
        if (ranking.includes('National Universities')) {
          rankingsObject.nationalRanking = extractRankingNumber(ranking);
        } else if (ranking.includes('Best Value Schools')) {
          rankingsObject.bestValueSchools = extractRankingNumber(ranking);
        } else if (ranking.includes('Best Undergraduate Engineering Programs')) {
          rankingsObject.engineeringPrograms = extractRankingNumber(ranking);
        } else if (ranking.includes('Computer Science')) {
          rankingsObject.computerScience = extractRankingNumber(ranking);
        } else if (ranking.includes('Psychology Programs')) {
          rankingsObject.psychologyPrograms = extractRankingNumber(ranking);
        } else if (ranking.includes('Economics')) {
          rankingsObject.economics = extractRankingNumber(ranking);
        } else if (ranking.includes('Writing in the Disciplines')) {
          rankingsObject.writingInDisciplines = extractRankingNumber(ranking);
        } else if (ranking.includes('Undergraduate Research/Creative Projects')) {
          rankingsObject.undergraduateResearch = extractRankingNumber(ranking);
        } else if (ranking.includes('Service Learning')) {
          rankingsObject.serviceLearning = extractRankingNumber(ranking);
        } else if (ranking.includes('First-Year Experiences')) {
          rankingsObject.firstYearExperiences = extractRankingNumber(ranking);
        } else if (ranking.includes('Senior Capstone')) {
          rankingsObject.seniorCapstone = extractRankingNumber(ranking);
        } else if (ranking.includes('Best Colleges for Veterans')) {
          rankingsObject.collegesForVeterans = extractRankingNumber(ranking);
        } else if (ranking.includes('Best Undergraduate Teaching')) {
          rankingsObject.undergraduateTeaching = extractRankingNumber(ranking);
        } else if (ranking.includes('Most Innovative Schools')) {
          rankingsObject.innovativeSchools = extractRankingNumber(ranking);
        } else if (ranking.includes('Top Performers on Social Mobility')) {
          rankingsObject.socialMobility = extractRankingNumber(ranking);
        }
      } catch (error) {
        // 파싱 실패시 해당 항목은 null로 유지
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