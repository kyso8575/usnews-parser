import { load, Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

export interface SportsByGender {
  men: string[];
  women: string[];
}

export interface SportsSection {
  scholarshipSports: SportsByGender | string;
  nonscholarshipSports: SportsByGender;
  clubSports: SportsByGender;
  intramuralRecreationalSports: SportsByGender;
}

function extractYesNoFromCell($: CheerioAPI, cell: Cheerio<AnyNode>): boolean {
  const title = cell.find('title').first().text().trim();
  if (title === 'Yes') return true;
  if (title === 'No') return false;
  // Fallback: check for use[xlink:href="#check-pro"] vs x-con
  const useHref = cell.find('use').attr('xlink:href') || '';
  if (useHref.includes('check-pro')) return true;
  if (useHref.includes('x-con')) return false;
  return false;
}

function parseTableStacked($: CheerioAPI, containerSelector: string): SportsByGender {
  const result: SportsByGender = { men: [], women: [] };
  const container = $(containerSelector);
  const outerRows = container.find('> table > tbody > tr');
  outerRows.each((_, outer) => {
    const outerEl = $(outer);
    const innerRows = outerEl.find('> td > table > tbody > tr');
    if (innerRows.length < 4) return;
    const nameRow = innerRows.eq(1);
    const menRow = innerRows.eq(2);
    const womenRow = innerRows.eq(3);
    const sportName = nameRow.find('.header').first().text().trim();
    if (!sportName) return;
    const menCell = menRow.find('td').first();
    const womenCell = womenRow.find('td').first();
    const menYes = extractYesNoFromCell($, menCell);
    const womenYes = extractYesNoFromCell($, womenCell);
    if (menYes) result.men.push(sportName);
    if (womenYes) result.women.push(sportName);
  });
  // Deduplicate
  result.men = Array.from(new Set(result.men));
  result.women = Array.from(new Set(result.women));
  return result;
}

function parseTableTabular($: CheerioAPI, containerSelector: string): SportsByGender {
  const result: SportsByGender = { men: [], women: [] };
  const rows = $(`${containerSelector} table tbody tr.TableTabular__TableRow-impg-1`);
  rows.each((_, tr) => {
    const t = $(tr);
    const sportName = t.find('td').eq(0).text().trim();
    if (!sportName) return;
    const menCell = t.find('td').eq(2);
    const womenCell = t.find('td').eq(4);
    const menYes = extractYesNoFromCell($, menCell);
    const womenYes = extractYesNoFromCell($, womenCell);
    if (menYes) result.men.push(sportName);
    if (womenYes) result.women.push(sportName);
  });
  // Deduplicate (some pages render duplicated rows)
  result.men = Array.from(new Set(result.men));
  result.women = Array.from(new Set(result.women));
  return result;
}

function parseIntercollegiateSports($: CheerioAPI, dataTestId: string): SportsByGender {
  // Try tabular first, then stacked
  const tabularSelector = `div[data-test-id='${dataTestId}'].Table__TabularContainer-k11szb-1`;
  if ($(tabularSelector).length) {
    return parseTableTabular($, tabularSelector);
  }
  const stackedSelector = `div[data-test-id='${dataTestId}'].Table__StackedContainer-k11szb-0`;
  return parseTableStacked($, stackedSelector);
}

function parseIntramural($: CheerioAPI, dataTestId: string): string[] {
  const container = $(`div[data-test-id='${dataTestId}']`);
  const names: string[] = [];
  // Prefer tabular: first column contains sport names
  container.find('.Table__TabularContainer-k11szb-1 table tbody tr.TableTabular__TableRow-impg-1').each((_, tr) => {
    const name = $(tr).find('td').eq(0).text().trim();
    if (name) names.push(name);
  });
  if (names.length === 0) {
    // Fallback to stacked: sport names are in .header elements (exclude entries like "Men's"/"Women's")
    container.find('.Table__StackedContainer-k11szb-0 .header').each((_, el) => {
      const text = $(el).text().trim();
      if (text && !/Men's|Women's|Sports$/i.test(text)) {
        names.push(text);
      }
    });
  }
  return Array.from(new Set(names));
}

export function extractSportsData(html: string): SportsSection {
  const $ = load(html);

  // Scholarship sports: may be N/A
  let scholarshipSports: SportsByGender | string = "N/A";
  const scholVal = $("[data-test-id='v_schol_sports']").first().text().trim();
  if (scholVal && scholVal.toLowerCase() !== 'n/a') {
    // If present as table (rare), parse similarly by id="scholarSports"
    scholarshipSports = parseIntercollegiateSports($, 'v_schol_sports');
  } else {
    scholarshipSports = "N/A";
  }

  const nonscholarshipSports = parseIntercollegiateSports($, 'v_ncaa_sports');
  const clubSports = parseIntercollegiateSports($, 'v_club_sports');
  const intramuralRecreationalSports = parseIntercollegiateSports($, 'v_intr_sports');

  return {
    scholarshipSports,
    nonscholarshipSports,
    clubSports,
    intramuralRecreationalSports,
  };
}


