import React, { PropsWithChildren } from 'react';
import { PDFDocumentProxy } from 'pdfjs-dist';
import { VariableSizeList } from 'react-window';
interface PageDimensions {
    width: number;
    height: number;
}
export interface CitationText {
    match: string;
    exactMatch: boolean;
}
type DocumentStatus = 'UNSET' | 'LOADING' | 'ERROR' | 'READY';
interface PdfContextProps {
    citationText: CitationText | null;
    setCitationText: React.Dispatch<React.SetStateAction<CitationText | null>>;
    documentStatus: DocumentStatus;
    overscanCount: number;
    setdocumentStatus: (status: DocumentStatus) => void;
    pdfDocument: PDFDocumentProxy | null;
    setPdfDocument: (pdf: PDFDocumentProxy) => void;
    numPages: number;
    setNumPages: (pages: number) => void;
    scale: number;
    setScale: (scale: number) => void;
    loadedPageStartIndex: number;
    setLoadedPageStartIndex: (page: number) => void;
    currentPage: number;
    setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
    setCurrentPageAndScroll: (page: number) => void;
    loadedPageEndIndex: number;
    setLoadedPageEndIndex: (page: number) => void;
    pageDimensions: Map<number, PageDimensions>;
    setPageDimensions: (dimensionsMap: Map<number, PageDimensions>) => void;
    containerRef: React.RefObject<HTMLDivElement>;
    listRef: React.RefObject<VariableSizeList>;
    pageRefs: React.RefObject<Map<number, HTMLDivElement>>;
    highlightLayerRefs: React.RefObject<Map<number, HTMLCanvasElement>>;
    textLayerRefs: React.RefObject<Map<number, HTMLDivElement>>;
    getOrCreateTextLayer: (page: number) => Promise<HTMLDivElement | undefined>;
    scrollToPage: (pageIndex: number) => void;
    scrollOffset: number;
    setScrollOffset: React.Dispatch<React.SetStateAction<number>>;
}
export declare const PdfProvider: React.FC<PropsWithChildren>;
export declare const usePdf: () => PdfContextProps;
export {};
