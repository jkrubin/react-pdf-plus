import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  PropsWithChildren,
} from 'react';
import {
  getDocument,
  PDFDocumentProxy,
  PDFPageProxy,
  TextLayer,
} from 'pdfjs-dist';
import { VariableSizeList } from 'react-window';
import { filterMapByKeyRange } from '../util';
// import { PdfHighlighterProvider } from '../PdfHighlighter';

interface PageDimensions {
  width: number;
  height: number;
}
export interface CitationText {
  match: string;
  exactMatch: boolean;
  page: number;
}
type DocumentStatus = 'UNSET' | 'LOADING' | 'ERROR' | 'READY';

type PdfProviderProps = {
  pageNumber?: number;
  citationText?: CitationText | null;
  onUpdateCitationText?: (citation: CitationText | null) => void;
  onUpdatePageNumber?: (page: number) => void;
  onUpdateNumPages?: (pages: number) => void;
};
interface PdfContextProps {
  citationText: CitationText | null;
  setCitationText: React.Dispatch<React.SetStateAction<CitationText | null>>;
  documentStatus: DocumentStatus;
  onDocumentLoad: () => void;
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

const PdfContext = createContext<PdfContextProps | undefined>(undefined);

export const PdfProvider: React.FC<PropsWithChildren & PdfProviderProps> = ({
  children,
  pageNumber,
  citationText: citationProps,
  onUpdateCitationText = () => {},
  onUpdatePageNumber = () => {},
  onUpdateNumPages = () => {},
}) => {
  const [citationText, setCitationText] = useState<CitationText | null>(
    citationProps || null,
  );
  const [overscanCount, setOverscanCount] = useState<number>(3);
  const [documentStatus, setdocumentStatus] = useState<DocumentStatus>('UNSET');
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const textLayerRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const textLayerPromiseCache = useRef<
    Map<number, Promise<HTMLDivElement | undefined>>
  >(new Map());
  const highlightLayerRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const [numPages, setNumPages] = useState<number>(0);
  const [pageDimensions, setPageDimensions] = useState<
    Map<number, PageDimensions>
  >(new Map());
  const [currentPage, setCurrentPage] = useState<number>(pageNumber || 0);
  const [loadedPageStartIndex, setLoadedPageStartIndex] = useState<number>(0);
  const [loadedPageEndIndex, setLoadedPageEndIndex] = useState<number>(0);
  const [scrollOffset, setScrollOffset] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const listRef = useRef<VariableSizeList>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateCitationTextAndCallback: React.Dispatch<
    React.SetStateAction<CitationText | null>
  > = (value) => {
    if (typeof value === 'function') {
      setCitationText((prevState) => {
        const newState = value(prevState);
        if (newState !== null) {
          onUpdateCitationText(newState);
        }
        return newState;
      });
    } else {
      // If it's a direct value
      setCitationText(value);
      if (value !== null) {
        onUpdateCitationText(value);
      }
    }
  };

  const updateCurrentPageAndCallback: React.Dispatch<
    React.SetStateAction<number>
  > = (value) => {
    if (typeof value === 'function') {
      setCurrentPage((prevPage) => {
        const newPage = value(prevPage);
        onUpdatePageNumber(newPage);
        return newPage;
      });
    } else {
      setCurrentPage(value);
      onUpdatePageNumber(value);
    }
  };

  const updateNumPagesAndCallback: React.Dispatch<
    React.SetStateAction<number>
  > = (value) => {
    if (typeof value === 'function') {
      setNumPages((prevNumPages) => {
        const newPageNum = value(prevNumPages);
        onUpdateNumPages(newPageNum);
        return newPageNum;
      });
    } else {
      setCurrentPage(value);
      onUpdateNumPages(value);
    }
  };

  const onDocumentLoad = () => {
    setCurrentPageAndScroll(pageNumber || 0);
  };

  const scrollToPage = useCallback((pageIndex: number) => {
    if (listRef.current) {
      listRef.current.scrollToItem(pageIndex - 1, 'start');
    } else {
      setTimeout(() => scrollToPage(pageIndex), 500);
    }
  }, []);

  const setCurrentPageAndScroll = (page: number) => {
    scrollToPage(page);
    setCurrentPage(page);
  };
  // Function to clear cached refs (pages, highlights, text layers)
  const clearCachedRefs = () => {
    pageRefs.current.clear();
    textLayerRefs.current.clear();
    highlightLayerRefs.current.clear();
  };

  /**
   * Manages serving text layers to pages that request it.
   * Maintains both a cache of Text layers AND
   * a cache of incomplete promises for pages that have been requested.
   * React-window mounts pages in quick succession so we often recieve the same request from
   * the same page before the original request is completed, in this case return the prev
   * promise instead of starting a new process
   * @param pageNumber
   * @returns
   */
  const getOrCreateTextLayerCache = async (
    pageNumber: number,
  ): Promise<HTMLDivElement | undefined> => {
    if (!pdfDocument) return;

    // If the text layer already exists in the cache, return it
    if (textLayerRefs.current.has(pageNumber)) {
      return textLayerRefs.current.get(pageNumber);
    }

    // If a promise is already in the cache for this page, return that promise
    if (textLayerPromiseCache.current.has(pageNumber)) {
      return textLayerPromiseCache.current.get(pageNumber);
    }

    // Create a new promise for the text layer rendering
    const renderTextLayerPromise = (async () => {
      const textLayerDiv = document.createElement('div');
      textLayerDiv.className = 'textLayer';

      const page: PDFPageProxy = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      textLayerDiv.style.width = `${viewport.width}px`;
      textLayerDiv.style.height = `${viewport.height}px`;
      textLayerDiv.style.setProperty('--scale-factor', scale.toString());

      const textContent = await page.getTextContent();
      const textLayer = new TextLayer({
        container: textLayerDiv,
        textContentSource: textContent,
        viewport,
      });

      await textLayer.render();

      // Store the rendered text layer in the cache
      textLayerRefs.current.set(pageNumber, textLayerDiv);
      // Remove the promise from the cache once the rendering is complete
      textLayerPromiseCache.current.delete(pageNumber);

      return textLayerDiv;
    })();

    // Cache the promise and return it
    textLayerPromiseCache.current.set(pageNumber, renderTextLayerPromise);
    return renderTextLayerPromise;
  };

  useEffect(() => {
    if (typeof pageNumber === 'number' && pageNumber !== currentPage) {
      setCurrentPageAndScroll(pageNumber);
    }
  }, [pageNumber]);

  useEffect(() => {
    clearCachedRefs();
  }, [scale, pdfDocument]);

  useEffect(() => {
    pageRefs.current = new Map();
  }, [numPages]);

  useEffect(() => {
    const min = currentPage - overscanCount;
    const max = currentPage + overscanCount;
    filterMapByKeyRange(textLayerRefs.current, min, max);
    filterMapByKeyRange(pageRefs.current, min, max);
    filterMapByKeyRange(highlightLayerRefs.current, min, max);
  }, [currentPage]);

  useEffect(() => {
    if (citationProps === null) {
      setCitationText(null);
    }
    if (
      citationProps &&
      citationProps?.match !== citationText?.match &&
      citationProps?.exactMatch !== citationText?.exactMatch
    ) {
      setCitationText(citationProps);
    }
  }, [citationProps]);
  return (
    <PdfContext.Provider
      value={{
        citationText,
        setCitationText: updateCitationTextAndCallback,
        overscanCount,
        documentStatus,
        setdocumentStatus,
        onDocumentLoad,
        pdfDocument,
        setPdfDocument,
        numPages,
        setNumPages: updateNumPagesAndCallback,
        scale,
        setScale,
        currentPage,
        setCurrentPage: updateCurrentPageAndCallback,
        setCurrentPageAndScroll,
        scrollOffset,
        setScrollOffset,
        loadedPageStartIndex,
        setLoadedPageStartIndex,
        loadedPageEndIndex,
        setLoadedPageEndIndex,
        pageDimensions,
        setPageDimensions,
        containerRef,
        listRef,
        pageRefs,
        highlightLayerRefs,
        textLayerRefs,
        getOrCreateTextLayer: getOrCreateTextLayerCache,
        scrollToPage,
      }}
    >
      {children}
    </PdfContext.Provider>
  );
};

export const usePdf = (): PdfContextProps => {
  const context = useContext(PdfContext);
  if (!context) {
    throw new Error('usePdf must be used within a PdfProvider');
  }
  return context;
};
