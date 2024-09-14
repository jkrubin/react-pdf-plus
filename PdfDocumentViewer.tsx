import PdfViewer from './PdfViewer';
import { CitationText, PdfProvider } from './PdfContext';
import React, { ReactNode } from 'react';
import { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api';

type PDFDocumentViewerProps = {
  url: string;
  fileOptions?: DocumentInitParameters;
  tooltipContent?: ReactNode;
  tooltipClassName?: string;
  pageNumber?: number;
  citationText?: CitationText | null;
  onUpdateCitationText?: (citation: CitationText | null) => void;
  onUpdatePageNumber?: (page: number) => void;
  onUpdateNumPages?: (pages: number) => void;
};
export const PdfDocumentViewer: React.FC<PDFDocumentViewerProps> = ({
  url,
  fileOptions,
  tooltipContent,
  tooltipClassName,
  pageNumber,
  citationText,
  onUpdateCitationText,
  onUpdatePageNumber,
  onUpdateNumPages,
}: PDFDocumentViewerProps) => {
  return (
    <PdfProvider
      {...{
        pageNumber,
        citationText,
        onUpdateCitationText,
        onUpdatePageNumber,
        onUpdateNumPages,
      }}
    >
      <PdfViewer {...{ url, fileOptions, tooltipContent, tooltipClassName }} />
    </PdfProvider>
  );
};
