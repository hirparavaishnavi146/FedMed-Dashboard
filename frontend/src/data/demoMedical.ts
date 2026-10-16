// Demo analysis for the Medical Report Analysis page.
//
// The generated sections are shown as UNAVAILABLE, which is what the real application
// does when no AI provider is configured. That is deliberate: a sample that displayed
// plausible-looking AI complications and suggestions would demonstrate a capability the
// deployed app does not have, and would be the exact kind of invented clinical content
// this feature is built to avoid.
//
// The extracted values below are illustrative numbers for a fictional patient. They are
// shaped like a real report (a printed reference range and a value outside it) so the
// measured sections can be demonstrated honestly.

import type { MedicalAnalysis, MedicalReport, ParsedReport } from '../types';

const FICTIONAL_DISCLAIMER =
  'Sample data for a fictional patient. These are not real results and no person is described.';

function provenance(reportName: string, page: number, line: number, snippet: string) {
  return {
    reportId: `rpt-demo-${page}`,
    reportName,
    page,
    line,
    snippet,
  };
}

const DEMO_REPORT_ONE = 'sample-blood-count.txt';
const DEMO_REPORT_TWO = 'sample-followup.txt';

const REPORT_ONE_TEXT = `NORTHBRIDGE MEDICAL CENTRE
Complete Blood Count
Date: 2026-01-15

Clinical History:
Fatigue for three weeks.

Findings:
Haemoglobin          10.2 g/dL       13.0 - 17.0      L
White Cell Count      6.1 10^9/L      4.0 - 11.0
Platelets           245 10^9/L       150 - 400
MCV                  78.0 fL         80 - 100         L
Ferritin              8 ng/mL        30 - 300         L

Impression:
Microcytic anaemia. Ferritin low. Suggest iron studies and gastrointestinal assessment.

${FICTIONAL_DISCLAIMER}`;

const REPORT_TWO_TEXT = `ST. AURELIA UNIVERSITY HOSPITAL
Full Blood Count
Date: 2026-04-20

Findings:
Haemoglobin          11.8 g/dL       13.0 - 17.0      L
Ferritin             22 ng/mL        30 - 300         L

Impression:
Haemoglobin has improved. Ferritin remains below the reference range.

${FICTIONAL_DISCLAIMER}`;

const REPORT_ONE: MedicalReport = {
  reportId: 'rpt-demo-1',
  name: DEMO_REPORT_ONE,
  sizeBytes: REPORT_ONE_TEXT.length,
  contentType: 'text/plain',
  status: 'extracted',
  pages: null,
  characters: REPORT_ONE_TEXT.length,
  headingsFound: ['Clinical History', 'Findings', 'Impression'],
  ocrUsed: false,
  extractNote: 'Text was extracted verbatim. No wording has been generated or reinterpreted.',
  pageTexts: [REPORT_ONE_TEXT],
};

const REPORT_TWO: MedicalReport = {
  reportId: 'rpt-demo-2',
  name: DEMO_REPORT_TWO,
  sizeBytes: REPORT_TWO_TEXT.length,
  contentType: 'text/plain',
  status: 'extracted',
  pages: null,
  characters: REPORT_TWO_TEXT.length,
  headingsFound: ['Findings', 'Impression'],
  ocrUsed: false,
  extractNote: 'Text was extracted verbatim. No wording has been generated or reinterpreted.',
  pageTexts: [REPORT_TWO_TEXT],
};

const LABS_ONE: ParsedReport['labs'] = [
  {
    name: 'Ferritin',
    value: 8,
    valueText: '8',
    unit: 'ng/mL',
    referenceText: '30 - 300',
    referenceLow: 30,
    referenceHigh: 300,
    reportedFlag: 'low',
    withinRange: false,
    note: '',
    provenance: provenance(DEMO_REPORT_ONE, 1, 12, 'Ferritin              8 ng/mL        30 - 300         L'),
  },
  {
    name: 'Haemoglobin',
    value: 10.2,
    valueText: '10.2',
    unit: 'g/dL',
    referenceText: '13.0 - 17.0',
    referenceLow: 13,
    referenceHigh: 17,
    reportedFlag: 'low',
    withinRange: false,
    note: '',
    provenance: provenance(DEMO_REPORT_ONE, 1, 9, 'Haemoglobin          10.2 g/dL       13.0 - 17.0      L'),
  },
  {
    name: 'MCV',
    value: 78,
    valueText: '78.0',
    unit: 'fL',
    referenceText: '80 - 100',
    referenceLow: 80,
    referenceHigh: 100,
    reportedFlag: 'low',
    withinRange: false,
    note: '',
    provenance: provenance(DEMO_REPORT_ONE, 1, 11, 'MCV                  78.0 fL         80 - 100         L'),
  },
  {
    name: 'Platelets',
    value: 245,
    valueText: '245',
    unit: '10^9/L',
    referenceText: '150 - 400',
    referenceLow: 150,
    referenceHigh: 400,
    reportedFlag: null,
    withinRange: true,
    note: '',
    provenance: provenance(DEMO_REPORT_ONE, 1, 10, 'Platelets           245 10^9/L       150 - 400'),
  },
  {
    name: 'White Cell Count',
    value: 6.1,
    valueText: '6.1',
    unit: '10^9/L',
    referenceText: '4.0 - 11.0',
    referenceLow: 4,
    referenceHigh: 11,
    reportedFlag: null,
    withinRange: true,
    note: '',
    provenance: provenance(DEMO_REPORT_ONE, 1, 10, 'White Cell Count      6.1 10^9/L      4.0 - 11.0'),
  },
];

const LABS_TWO: ParsedReport['labs'] = [
  {
    name: 'Ferritin',
    value: 22,
    valueText: '22',
    unit: 'ng/mL',
    referenceText: '30 - 300',
    referenceLow: 30,
    referenceHigh: 300,
    reportedFlag: 'low',
    withinRange: false,
    note: '',
    provenance: provenance(DEMO_REPORT_TWO, 1, 7, 'Ferritin             22 ng/mL        30 - 300         L'),
  },
  {
    name: 'Haemoglobin',
    value: 11.8,
    valueText: '11.8',
    unit: 'g/dL',
    referenceText: '13.0 - 17.0',
    referenceLow: 13,
    referenceHigh: 17,
    reportedFlag: 'low',
    withinRange: false,
    note: '',
    provenance: provenance(DEMO_REPORT_TWO, 1, 6, 'Haemoglobin          11.8 g/dL       13.0 - 17.0      L'),
  },
];

export const DEMO_MEDICAL_ANALYSIS: MedicalAnalysis = {
  analysisId: 'ana-demo-0001',
  sessionId: 'mr-demo-0001',
  createdAt: '2026-01-01T00:00:00Z',
  reportCount: 2,
  reports: [REPORT_ONE, REPORT_TWO],
  safetyDisclaimer:
    'This is an AI-assisted draft produced by a research prototype, for the purpose of preparing for a consultation with a qualified healthcare professional. It is NOT a diagnosis, NOT a medical opinion, and NOT a substitute for professional care. It has not been clinically validated.',
  urgency: {
    category: 'unable-to-assess',
    basis:
      'No explicit warning term was found and no AI assessment is available, so no urgency can be established. This is not a clearance.',
    emergencyNotice: null,
    showBeforeAnalysis: false,
    redFlags: [],
    aiSuggestedUrgencies: [],
    limitation:
      'Urgency is derived from explicit warning terms present in the report text and, when configured, from an AI suggestion. It is not a triage decision.',
    categoriesExplained: {
      emergency: 'Possible emergency warning signs; seek emergency care now.',
      'prompt-review': 'Findings that may need timely professional evaluation.',
      'routine-review': 'Suitable for discussion at a scheduled appointment.',
      'unable-to-assess': 'Insufficient or unreadable evidence to say.',
    },
  },
  ai: {
    available: false,
    data: {},
    citationsRejected: [],
    absoluteClaimWarnings: [],
    note: '',
    reason:
      'No AI provider is configured (FEDMED_AI_BASE_URL, FEDMED_AI_API_KEY not set), so the generated sections cannot be produced. Extracted report information is still shown. No placeholder analysis is invented in its place.',
  },
  summary: {
    deterministicDigest: [
      {
        reportName: DEMO_REPORT_ONE,
        reportType: 'Haematology',
        reportDate: '2026-01-15',
        pages: null,
        status: 'extracted',
        valuesFound: LABS_ONE.length,
        valuesOutsidePrintedRange: LABS_ONE.filter((lab) => lab.withinRange === false).length,
        headingsFound: REPORT_ONE.headingsFound,
        note: REPORT_ONE.extractNote,
      },
      {
        reportName: DEMO_REPORT_TWO,
        reportType: 'Haematology',
        reportDate: '2026-04-20',
        pages: null,
        status: 'extracted',
        valuesFound: LABS_TWO.length,
        valuesOutsidePrintedRange: LABS_TWO.filter((lab) => lab.withinRange === false).length,
        headingsFound: REPORT_TWO.headingsFound,
        note: REPORT_TWO.extractNote,
      },
    ],
    note: 'This digest is computed from the text. It is not an AI summary and it does not interpret the findings.',
  },
  findings: [
    {
      finding: 'Haemoglobin 10.2 g/dL',
      kind: 'laboratory-value-outside-printed-range',
      reportName: DEMO_REPORT_ONE,
      reportDate: '2026-01-15',
      page: 1,
      referenceRange: '13.0 - 17.0',
      direction: 'below',
      documentedOrInferred: 'documented',
      whyItMayMatter:
        'The report prints a reference range of 13.0 - 17.0 and this value is below it. This application does not know what that means clinically — discuss it with a clinician.',
      sourceSnippet: 'Haemoglobin          10.2 g/dL       13.0 - 17.0      L',
    },
    {
      finding: 'Ferritin 8 ng/mL',
      kind: 'laboratory-value-outside-printed-range',
      reportName: DEMO_REPORT_ONE,
      reportDate: '2026-01-15',
      page: 1,
      referenceRange: '30 - 300',
      direction: 'below',
      documentedOrInferred: 'documented',
      whyItMayMatter:
        'The report prints a reference range of 30 - 300 and this value is below it. This application does not know what that means clinically — discuss it with a clinician.',
      sourceSnippet: 'Ferritin              8 ng/mL        30 - 300         L',
    },
    {
      finding: 'MCV 78.0 fL',
      kind: 'laboratory-value-outside-printed-range',
      reportName: DEMO_REPORT_ONE,
      reportDate: '2026-01-15',
      page: 1,
      referenceRange: '80 - 100',
      direction: 'below',
      documentedOrInferred: 'documented',
      whyItMayMatter:
        'The report prints a reference range of 80 - 100 and this value is below it. This application does not know what that means clinically — discuss it with a clinician.',
      sourceSnippet: 'MCV                  78.0 fL         80 - 100         L',
    },
    {
      finding: 'Microcytic anaemia. Ferritin low. Suggest iron studies and gastrointestinal assessment.',
      kind: 'statement-under-a-diagnosis-heading',
      reportName: DEMO_REPORT_ONE,
      reportDate: '2026-01-15',
      page: 1,
      referenceRange: null,
      direction: null,
      documentedOrInferred: 'documented',
      whyItMayMatter:
        "Written by the report's author under the heading 'Impression'. It is quoted, not interpreted.",
      sourceSnippet: 'Microcytic anaemia. Ferritin low. Suggest iron studies',
    },
  ],
  comparison: {
    reportsCompared: [DEMO_REPORT_ONE, DEMO_REPORT_TWO],
    consistentFindings: [],
    differingFindings: [
      {
        analyte: 'ferritin',
        presentIn: [DEMO_REPORT_ONE, DEMO_REPORT_TWO],
        readings: [
          { report: DEMO_REPORT_ONE, value: 8, unit: 'ng/mL', referenceText: '30 - 300', withinRange: false, page: 1 },
          { report: DEMO_REPORT_TWO, value: 22, unit: 'ng/mL', referenceText: '30 - 300', withinRange: false, page: 1 },
        ],
        change: { absolute: 14, direction: 'increased' },
        note: 'The value differs between reports. Whether that is a real change over time or a difference in measurement cannot be determined from the text alone; check the report dates, which may themselves be ambiguous.',
      },
      {
        analyte: 'haemoglobin',
        presentIn: [DEMO_REPORT_ONE, DEMO_REPORT_TWO],
        readings: [
          { report: DEMO_REPORT_ONE, value: 10.2, unit: 'g/dL', referenceText: '13.0 - 17.0', withinRange: false, page: 1 },
          { report: DEMO_REPORT_TWO, value: 11.8, unit: 'g/dL', referenceText: '13.0 - 17.0', withinRange: false, page: 1 },
        ],
        change: { absolute: 1.6, direction: 'increased' },
        note: 'The value differs between reports. Whether that is a real change over time or a difference in measurement cannot be determined from the text alone; check the report dates, which may themselves be ambiguous.',
      },
    ],
    findingsInOneReportOnly: [
      {
        analyte: 'MCV',
        presentIn: [DEMO_REPORT_ONE],
        note: 'This analyte appears in only one report, so no comparison across time is possible.',
      },
      {
        analyte: 'Platelets',
        presentIn: [DEMO_REPORT_ONE],
        note: 'This analyte appears in only one report, so no comparison across time is possible.',
      },
    ],
    missingInformation: [],
    note: 'Comparison is limited to identical analyte names appearing in more than one report. Different names for the same test are not matched, and values measured by different laboratories may not be directly comparable.',
  },
  diagnosisStatus: {
    status: 'documented-in-a-report',
    explanation:
      "The statements below are quoted from under a diagnosis, impression or assessment heading. They are what the report's author wrote.",
    documentedDiagnoses: [
      {
        reportName: DEMO_REPORT_ONE,
        heading: 'Impression',
        text: 'Microcytic anaemia. Ferritin low. Suggest iron studies and gastrointestinal assessment.',
        page: 1,
      },
      {
        reportName: DEMO_REPORT_TWO,
        heading: 'Impression',
        text: 'Haemoglobin has improved. Ferritin remains below the reference range.',
        page: 1,
      },
    ],
    possibleConditionRequiringEvaluation: null,
    possibleConditionNote:
      'Suggesting a possible condition requires clinical reasoning that this deployment cannot perform. See the generated sections, which report that the AI provider is unavailable when it is not configured.',
  },
  clinicalSuggestions: {
    available: false,
    reason:
      'No AI provider is configured (FEDMED_AI_BASE_URL, FEDMED_AI_API_KEY not set), so the generated sections cannot be produced. Extracted report information is still shown. No placeholder analysis is invented in its place.',
    items: [],
    note: 'These are AI-generated suggestions for discussion with a clinician. They are not treatment advice and no medication change is ever recommended.',
  },
  possibleComplications: {
    available: false,
    reason:
      'No AI provider is configured (FEDMED_AI_BASE_URL, FEDMED_AI_API_KEY not set), so the generated sections cannot be produced. Extracted report information is still shown. No placeholder analysis is invented in its place.',
    items: [],
    note: 'A possibility suggested by a language model is NOT a diagnosis.',
  },
  doctorReadySummary: {
    available: false,
    reason:
      'No AI provider is configured (FEDMED_AI_BASE_URL, FEDMED_AI_API_KEY not set), so the generated sections cannot be produced.',
    ai: null,
    assembledForClinician: {
      label: 'AI-assisted summary for clinician review',
      reportsProvided: [DEMO_REPORT_ONE, DEMO_REPORT_TWO],
      unreadableReports: [],
      valuesOutsidePrintedRange: [
        { report: DEMO_REPORT_ONE, value: 'Haemoglobin 10.2 g/dL', printedRange: '13.0 - 17.0', page: 1 },
        { report: DEMO_REPORT_ONE, value: 'Ferritin 8 ng/mL', printedRange: '30 - 300', page: 1 },
        { report: DEMO_REPORT_ONE, value: 'MCV 78.0 fL', printedRange: '80 - 100', page: 1 },
        { report: DEMO_REPORT_TWO, value: 'Haemoglobin 11.8 g/dL', printedRange: '13.0 - 17.0', page: 1 },
        { report: DEMO_REPORT_TWO, value: 'Ferritin 22 ng/mL', printedRange: '30 - 300', page: 1 },
      ],
      documentedStatements: [
        { report: DEMO_REPORT_ONE, heading: 'Impression', page: 1 },
        { report: DEMO_REPORT_TWO, heading: 'Impression', page: 1 },
      ],
      aiGeneratedSections: false,
    },
  },
};
