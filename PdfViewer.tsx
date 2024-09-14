import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { getDocument, PDFDocumentProxy } from 'pdfjs-dist';
import {
  ListOnItemsRenderedProps,
  ListOnScrollProps,
  VariableSizeList,
} from 'react-window';
import * as pdfjsLib from 'pdfjs-dist';
import Page from './Page';
import './style.css';
import { usePdf } from './PdfContext';
import debounce from 'debounce';
import TestPage from './TestPage';
import { PdfHighlighterProvider } from './PdfHighlighter';
import { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api';

// pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
//   'pdfjs-dist/build/pdf.worker.min.mjs',
//   import.meta.url,
// ).toString();

interface PdfViewerProps {
  url: string;
  fileOptions?: any;
  tooltipContent?: ReactNode;
  tooltipClassName?: string;
}
interface PageDimensions {
  width: number;
  height: number;
}
const PdfViewer: React.FC<PdfViewerProps> = ({
  url,
  fileOptions = {},
  tooltipContent,
  tooltipClassName,
}) => {
  const {
    documentStatus,
    setdocumentStatus,
    pdfDocument,
    setPdfDocument,
    setNumPages,
    scale,
    setScale,
    currentPage,
    setCurrentPage,
    loadedPageStartIndex,
    loadedPageEndIndex,
    setLoadedPageStartIndex,
    setLoadedPageEndIndex,
    pageDimensions,
    setPageDimensions,
    containerRef,
    listRef,
    pageRefs,
    setScrollOffset,
  } = usePdf();

  const [documentHeight, setDocumentHeight] = useState(0);

  // Calculate row height for each page
  const computeRowHeight = useCallback(
    (index: number) => {
      return (pageDimensions?.get(index + 1)?.height || 0) * scale;
    },
    [pageDimensions, scale],
  );

  const findPageInMiddle = () => {
    const containerBox = containerRef.current?.getBoundingClientRect();
    if (!containerBox) return currentPage;

    const containerMidPoint = containerBox.height / 2 + containerBox.top;
    let closestPage = currentPage;
    for (let i = loadedPageStartIndex; i <= loadedPageEndIndex; i++) {
      const pageRef = pageRefs.current?.get(i + 1);
      if (!pageRef) {
        continue;
      }
      const rect = pageRef?.getBoundingClientRect();
      if (rect.top <= containerMidPoint && rect.bottom >= containerMidPoint) {
        closestPage = i + 1;
        break;
      }
    }
    return closestPage;
  };
  const handleListScroll = (props: ListOnScrollProps) => {
    const { scrollOffset } = props;
    const pageInMiddle = findPageInMiddle();
    setCurrentPage(pageInMiddle);
    setScrollOffset(scrollOffset);
  };
  const handleItemsRendered = ({
    overscanStartIndex,
    overscanStopIndex,
  }: ListOnItemsRenderedProps) => {
    setLoadedPageStartIndex(overscanStartIndex);
    setLoadedPageEndIndex(overscanStopIndex);
    const closestPage = findPageInMiddle();
    setCurrentPage(closestPage);
  };
  // Load the PDF document
  useEffect(() => {
    const loadDocument = async () => {
      const docParams: DocumentInitParameters = {
        url: url,
        ...fileOptions,
      };
      const loadingTask = getDocument(docParams);
      const pdfDoc = await loadingTask.promise;
      setPdfDocument(pdfDoc);
      setNumPages(pdfDoc.numPages);
      const dimensions: Map<number, PageDimensions> = new Map();
      let totalHeight = 0;
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.0 });
        dimensions.set(pageNum, {
          width: viewport.width,
          height: viewport.height,
        });
        totalHeight += viewport.height;
      }

      setDocumentHeight(totalHeight);
      setPageDimensions(dimensions);
      setdocumentStatus('READY');
    };
    setdocumentStatus('LOADING');
    loadDocument();
  }, [url]);

  // useEffect(() => {
  //   if (listRef.current && containerRef.current) {
  //     const currentItemIndex = currentPage - 1;
  //     console.log(`scrolling current page is ${currentPage}`)
  //     if (currentItemIndex >= 0) {
  //       console.log(`scrolling to ${currentItemIndex}`)
  //       listRef.current.scrollToItem(5, 'start');
  //     }
  //   }
  // }, [scale])
  const handleResizeDebounced = useCallback(
    debounce(async (entries) => {
      if (!entries || entries.length === 0) return;

      // Get the first page of the PDF to determine the original viewport width
      const page = await pdfDocument?.getPage(1);
      const viewport = page?.getViewport({ scale: 1.0 });
      const originalViewportWidth = viewport?.width;
      const { width } = entries[0].contentRect;
      setScale(width / (originalViewportWidth || 600));
    }, 500),
    [pdfDocument, currentPage],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(handleResizeDebounced);
    resizeObserver.observe(container);
    return () => {
      resizeObserver.unobserve(container);
    };
  }, [pdfDocument]);

  // Reset row heights after scale changes
  useEffect(() => {
    if (listRef.current) {
      listRef.current.resetAfterIndex(0, true); // Invalidate the entire list
      listRef.current.scrollToItem(currentPage - 1, 'start');
    }
  }, [scale]);

  return (
    <PdfHighlighterProvider
      tooltipContent={tooltipContent}
      tooltipClassName={tooltipClassName}
    >
      <div
        style={{
          height: '100%',
          border: '3px solid #666',
          borderRadius: '5px',
        }}
      >
        <div
          ref={containerRef}
          style={{
            height: '100%',
            position: 'relative',
          }}
        >
          {documentStatus === 'READY' && (
            /**
             * IMPORTANT NOTE: VariableSizeList Will rerender every time props/context changes
             * When the component rerenders, all the pages will UNMOUNT and REMOUNT.
             * If there is any constantly changing data it should not be consumed by this component
             */
            <VariableSizeList
              height={containerRef.current?.getBoundingClientRect().height || 0}
              width={containerRef.current?.getBoundingClientRect().width || 0}
              itemCount={pdfDocument?.numPages || 0}
              itemSize={computeRowHeight}
              itemData={{
                scale,
                numPages: pdfDocument?.numPages || 0,
              }}
              overscanCount={2}
              onItemsRendered={handleItemsRendered}
              onScroll={handleListScroll}
              ref={listRef}
              style={{ overflowX: 'hidden' }}
            >
              {({ index, style }) => (
                <div style={style}>
                  <TestPage
                    pdfDocument={pdfDocument!}
                    pageNumber={index + 1}
                    scale={scale}
                  />
                </div>
              )}
            </VariableSizeList>
          )}
        </div>
      </div>
    </PdfHighlighterProvider>
  );
};

export default PdfViewer;
