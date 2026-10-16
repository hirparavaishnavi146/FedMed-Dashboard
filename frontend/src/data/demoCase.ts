// Demo data for the case intake page.
//
// The page analyses real files, so with no backend there is nothing to analyse.
// These sample rows show the four outcomes that matter — a report with headings, a
// scanned report that cannot be read, a 2D image outside every model's input domain,
// and an MRI volume that was segmented — and they are labelled as samples.
//
// `interpretationSupported` is false here exactly as it is in the live API. The
// sample must not look more capable than the real thing.

import type { CaseCapabilities, CaseSummary } from '../types';

export const DEMO_CASE_CAPABILITIES: CaseCapabilities = {
  mriVolume: {
    accepted: ['.nii.gz', '.nii'],
    canValidate: true,
    canSegment: true,
    segmentationMeaningfulOnRealData: false,
    note: 'Geometry, shape and label values are checked. Segmentation runs only if a checkpoint exists, and its output is not clinically meaningful: the model has only ever seen synthetic phantoms.',
  },
  reportPdf: {
    accepted: ['.pdf'],
    canExtractText: true,
    canInterpret: false,
    note: "Text with a text layer is quoted verbatim, including the document's own headings. A scanned PDF has no text layer and cannot be read; OCR is not implemented.",
  },
  reportText: {
    accepted: ['.txt', '.md', '.text'],
    canExtractText: true,
    canInterpret: false,
    note: "Quoted verbatim, including the document's own headings.",
  },
  image2d: {
    accepted: ['.png', '.jpg', '.jpeg', '.bmp', '.tif'],
    canDescribe: true,
    canInterpret: false,
    note: 'Dimensions, colour mode and format are reported. Every model in this project consumes 3D volumes, so a 2D X-ray is never analysed as if it were one, and no suggestion is produced from it.',
  },
  dicom: {
    accepted: [],
    canRead: false,
    note: 'DICOM series are not supported. Convert to NIfTI first.',
  },
};

export const DEMO_CASE: CaseSummary = {
  caseId: 'case-demo-0001',
  name: 'sample case (illustrative)',
  createdAt: '2026-01-01T00:00:00Z',
  fileCount: 5,
  analysedCount: 2,
  mriVolumeCount: 1,
  maskCount: 1,
  reportCount: 2,
  image2dCount: 1,
  interpretationSupported: false,
  interpretationReason:
    'No component of this project can read a 2D X-ray or a written report, and the 3D U-Net was trained only on synthetic phantoms. Producing a suggestion from these inputs would mean inventing it, so none is produced. What is offered is an account of what each file is and what could genuinely be done with it.',
  notice:
    'This is a technical case summary produced by a research prototype. It is NOT a diagnosis, NOT a clinical interpretation, and NOT a medical opinion. No output here has been validated for clinical use, and no finding should be read from it.',
  reasons: [
    'A case summary is not a diagnosis.',
    'The only model in this project is a 3D U-Net trained exclusively on procedurally generated synthetic phantoms. Its output on a real MRI volume is not meaningful, because it has never seen one.',
    "2D images and PDF reports are outside every model's input domain in this project.",
  ],
  staged: false,
  capabilities: {
    mriVolume: {
      accepted: ['.nii.gz', '.nii'],
      note: 'Checked for geometry and label values; segmentation is not clinically meaningful.',
    },
    reportPdf: { accepted: ['.pdf'], note: 'Text is quoted verbatim when a text layer exists.' },
    reportText: { accepted: ['.txt'], note: 'Quoted verbatim.' },
    image2d: { accepted: ['.png', '.jpg'], note: 'Described only; never analysed.' },
    dicom: { accepted: [], note: 'Not supported.' },
  },
  files: [
    {
      name: 'hosp-01_case_000.nii.gz',
      kind: 'mri-volume',
      sizeBytes: 218239,
      method: 'gzip container, NIfTI-1 header (sizeof_hdr = 348)',
      note: 'Compressed NIfTI-1 volume.',
      analysed: true,
      analysis: {
        validation: {
          valid: true,
          imageShape: [48, 48, 24],
          spacing: [1, 1, 3],
          labelShape: [48, 48, 24],
        },
        segmentation: {
          available: true,
          architecture: 'UNet3D',
          parameters: 350809,
          threshold: 0.5,
          foregroundVoxels: 7461,
          foregroundFraction: 0.2277,
          volumeMm3: 22383,
          diceAgainstReference: 0.95,
          referenceMaskSupplied: true,
          trainedOn: 'procedurally generated synthetic phantoms',
          meaningfulOnRealData: false,
          provenance:
            'The only model in this project is a 3D U-Net trained exclusively on procedurally generated synthetic phantoms. Its output on a real MRI volume is not meaningful, because it has never seen one.',
        },
      },
    },
    {
      name: 'hosp-01_case_000_seg.nii.gz',
      kind: 'mri-volume',
      sizeBytes: 1598,
      method: 'gzip container, NIfTI-1 header (sizeof_hdr = 348)',
      note: 'Compressed NIfTI-1 volume.',
      analysed: false,
      analysis: {
        validation: {
          valid: true,
          imageShape: [48, 48, 24],
          spacing: [1, 1, 3],
          labelShape: [48, 48, 24],
        },
      },
    },
    {
      name: 'report.txt',
      kind: 'report-text',
      sizeBytes: 681,
      method: 'decodes as text',
      note: 'Text document. Headings and their sections are extracted verbatim.',
      analysed: true,
      analysis: {
        status: 'extracted',
        characters: 679,
        headingsFound: ['Clinical History', 'Technique', 'Findings', 'Impression'],
        sections: [
          {
            heading: 'Findings',
            text: 'The prostate measures 42 cc. There is a focal area of low signal on the T2-weighted sequence in the peripheral zone at the mid gland, measuring approximately 12 mm.',
          },
          {
            heading: 'Impression',
            text: 'Focal lesion in the peripheral zone, PI-RADS 4. Recommend targeted biopsy.',
          },
        ],
        interpretationSupported: false,
        reason:
          "Text is quoted verbatim. It is not summarised, classified or turned into an app-generated impression: the words shown are the document's own.",
      },
    },
    {
      name: 'report_scanned.pdf',
      kind: 'report-pdf',
      sizeBytes: 431,
      method: 'magic bytes (%PDF)',
      note: 'PDF document. Text is extracted if the file has a text layer.',
      analysed: false,
      analysis: {
        status: 'no-text-layer',
        pages: 1,
        note:
          'This PDF has 1 page(s) but contains no extractable text, so it is almost certainly a scan or a photograph of a document. The report content is present but not readable as text, and OCR is NOT implemented here. Nothing can be quoted from it, and this is not a statement that the report is empty.',
        interpretationSupported: false,
        reason: 'Nothing could be quoted from this document.',
      },
    },
    {
      name: 'chest_xray.png',
      kind: '2d-image',
      sizeBytes: 1301,
      method: 'magic bytes (PNG)',
      note: 'PNG image. This is a 2D picture. No model in this project can interpret it; see capabilities().',
      analysed: false,
      analysis: {
        width: 512,
        height: 512,
        mode: 'L',
        format: 'PNG',
        interpretationSupported: false,
        reason:
          'This is a 2D image. Every model in this project consumes 3D volumes, so no analysis was performed. A 2D X-ray is not a 3D MRI volume and the two are not interchangeable inputs.',
      },
    },
  ],
};
