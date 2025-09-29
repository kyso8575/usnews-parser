# US News University Parser

A comprehensive web scraping tool for extracting university data from US News & World Report.

## Features

- **Comprehensive Data Extraction**: Extracts 450+ data fields from university profiles
- **Multi-University Support**: Supports 20+ top universities including Harvard, Stanford, MIT, etc.
- **Bilingual Support**: English and Korean descriptions for all fields
- **Excel Export**: Generates Excel files with examples from real university data
- **TypeScript**: Built with TypeScript for type safety and better development experience

## Data Fields

The parser extracts data across multiple categories:

- **Overall Rankings**: University rankings, scores, and outcomes
- **Academics**: Programs, majors, class sizes, faculty information
- **Applying**: Admission requirements, deadlines, acceptance rates
- **Campus Info**: Location, size, facilities, housing
- **Paying**: Tuition, financial aid, scholarships, loan information
- **Student Life**: Demographics, enrollment, student activities

## Installation

```bash
npm install
```

## Usage

### Extract University Data

```bash
# Extract all universities (creates unified JSON)
npm run extract

# Extract specific university
npm run extract "Princeton University"
```

### Generate Excel Files

```bash
# Generate Excel with Korean descriptions and examples
node create_excel_with_examples.js

# Generate basic Excel with Korean descriptions
node create_excel_with_korean.js
```

## Project Structure

```
├── src/                    # TypeScript source files
│   ├── main.ts            # Main entry point (includes unified JSON generation)
│   ├── extractor.ts       # Data extraction logic
│   ├── parser.ts          # HTML parsing utilities
│   └── config.ts          # Configuration management
├── data/                  # Data files
│   ├── extraction-config.json  # Field definitions with Korean descriptions
│   └── html/              # Raw HTML files
├── output/                # All JSON files
│   └── output-unified.json    # Unified university data
└── dist/                  # Compiled JavaScript (if building)
```

## Configuration

The `data/extraction-config.json` file contains:
- Field definitions with CSS selectors
- English descriptions
- Korean descriptions
- Data types and formatting rules

## Output

- **Unified JSON**: Single `output/output-unified.json` file with all university data
- **Excel Files**: Comprehensive spreadsheets with examples
- **Structured Data**: 450+ fields per university

## Supported Universities

- Brown University
- California Institute of Technology
- Columbia University
- Cornell University
- Dartmouth College
- Duke University
- Harvard University
- Johns Hopkins University
- Massachusetts Institute of Technology
- Northwestern University
- Princeton University
- Rice University
- Stanford University
- University of California Berkeley
- University of California Los Angeles
- University of Chicago
- University of Notre Dame
- University of Pennsylvania
- Vanderbilt University
- Yale University

## License

MIT License

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Requirements

- Node.js 16+
- TypeScript
- xlsx library for Excel generation
