var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import React, { useEffect, useState, useCallback, } from "react";
import { getDocument } from "pdfjs-dist";
import { VariableSizeList, } from "react-window";
import "./style.css";
import { usePdf } from "./PdfContext";
import debounce from "debounce";
import TestPage from "./TestPage";
import { PdfHighlighterProvider } from "./PdfHighlighter";
const PdfViewer = ({ url, fileOptions = {}, }) => {
    var _a, _b;
    const { documentStatus, setdocumentStatus, pdfDocument, setPdfDocument, setNumPages, scale, setScale, currentPage, setCurrentPage, loadedPageStartIndex, loadedPageEndIndex, setLoadedPageStartIndex, setLoadedPageEndIndex, pageDimensions, setPageDimensions, containerRef, listRef, pageRefs, setScrollOffset, } = usePdf();
    const [documentHeight, setDocumentHeight] = useState(0);
    // Calculate row height for each page
    const computeRowHeight = useCallback((index) => {
        var _a;
        return (((_a = pageDimensions === null || pageDimensions === void 0 ? void 0 : pageDimensions.get(index + 1)) === null || _a === void 0 ? void 0 : _a.height) || 0) * scale;
    }, [pageDimensions, scale]);
    const findPageInMiddle = () => {
        var _a, _b;
        const containerBox = (_a = containerRef.current) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect();
        if (!containerBox)
            return currentPage;
        const containerMidPoint = containerBox.height / 2 + containerBox.top;
        let closestPage = currentPage;
        for (let i = loadedPageStartIndex; i <= loadedPageEndIndex; i++) {
            const pageRef = (_b = pageRefs.current) === null || _b === void 0 ? void 0 : _b.get(i + 1);
            if (!pageRef) {
                continue;
            }
            const rect = pageRef === null || pageRef === void 0 ? void 0 : pageRef.getBoundingClientRect();
            if (rect.top <= containerMidPoint && rect.bottom >= containerMidPoint) {
                closestPage = i + 1;
                break;
            }
        }
        return closestPage;
    };
    const handleListScroll = (props) => {
        const { scrollOffset } = props;
        const pageInMiddle = findPageInMiddle();
        setCurrentPage(pageInMiddle);
        setScrollOffset(scrollOffset);
    };
    const handleItemsRendered = ({ overscanStartIndex, overscanStopIndex, }) => {
        setLoadedPageStartIndex(overscanStartIndex);
        setLoadedPageEndIndex(overscanStopIndex);
        const closestPage = findPageInMiddle();
        setCurrentPage(closestPage);
    };
    // Load the PDF document
    useEffect(() => {
        const loadDocument = () => __awaiter(void 0, void 0, void 0, function* () {
            const docParams = Object.assign({ url: url }, fileOptions);
            const loadingTask = getDocument(docParams);
            const pdfDoc = yield loadingTask.promise;
            setPdfDocument(pdfDoc);
            setNumPages(pdfDoc.numPages);
            console.log('loaded document ', pdfDoc);
            const dimensions = new Map();
            let totalHeight = 0;
            for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
                const page = yield pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1.0 });
                dimensions.set(pageNum, {
                    width: viewport.width,
                    height: viewport.height,
                });
                totalHeight += viewport.height;
            }
            setDocumentHeight(totalHeight);
            setPageDimensions(dimensions);
            setdocumentStatus("READY");
        });
        setdocumentStatus("LOADING");
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
    const handleResizeDebounced = useCallback(debounce((entries) => __awaiter(void 0, void 0, void 0, function* () {
        if (!entries || entries.length === 0)
            return;
        // Get the first page of the PDF to determine the original viewport width
        const page = yield (pdfDocument === null || pdfDocument === void 0 ? void 0 : pdfDocument.getPage(1));
        const viewport = page === null || page === void 0 ? void 0 : page.getViewport({ scale: 1.0 });
        const originalViewportWidth = viewport === null || viewport === void 0 ? void 0 : viewport.width;
        const { width } = entries[0].contentRect;
        setScale(width / (originalViewportWidth || 600));
    }), 500), [pdfDocument, currentPage]);
    useEffect(() => {
        const container = containerRef.current;
        if (!container)
            return;
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
            listRef.current.scrollToItem(currentPage - 1, "start");
        }
    }, [scale]);
    return (React.createElement(PdfHighlighterProvider, { tooltipContent: "Hello World" },
        React.createElement("div", { style: {
                height: "100%",
                border: "3px solid #666",
                borderRadius: "5px",
            } },
            React.createElement("div", { ref: containerRef, style: {
                    height: "100%",
                    position: "relative",
                } }, documentStatus === "READY" && (
            /**
             * IMPORTANT NOTE: VariableSizeList Will rerender every time props/context changes
             * When the component rerenders, all the pages will UNMOUNT and REMOUNT.
             * If there is any constantly changing data it should not be consumed by this component
             */
            React.createElement(VariableSizeList, { height: ((_a = containerRef.current) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect().height) || 0, width: ((_b = containerRef.current) === null || _b === void 0 ? void 0 : _b.getBoundingClientRect().width) || 0, itemCount: (pdfDocument === null || pdfDocument === void 0 ? void 0 : pdfDocument.numPages) || 0, itemSize: computeRowHeight, itemData: {
                    scale,
                    numPages: (pdfDocument === null || pdfDocument === void 0 ? void 0 : pdfDocument.numPages) || 0,
                }, overscanCount: 2, onItemsRendered: handleItemsRendered, onScroll: handleListScroll, ref: listRef, style: { overflowX: "hidden" } }, ({ index, style }) => (React.createElement("div", { style: style },
                React.createElement(TestPage, { pdfDocument: pdfDocument, pageNumber: index + 1, scale: scale })))))))));
};
export default PdfViewer;
