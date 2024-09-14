var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { TextLayer } from 'pdfjs-dist';
import { filterMapByKeyRange } from '../util';
const PdfContext = createContext(undefined);
export const PdfProvider = ({ children }) => {
    const [citationText, setCitationText] = useState(null);
    const [overscanCount, setOverscanCount] = useState(3);
    const [documentStatus, setdocumentStatus] = useState('UNSET');
    const [pdfDocument, setPdfDocument] = useState(null);
    const pageRefs = useRef(new Map());
    const textLayerRefs = useRef(new Map());
    const textLayerPromiseCache = useRef(new Map());
    const highlightLayerRefs = useRef(new Map());
    const [numPages, setNumPages] = useState(0);
    const [pageDimensions, setPageDimensions] = useState(new Map());
    const [currentPage, setCurrentPage] = useState(0);
    const [loadedPageStartIndex, setLoadedPageStartIndex] = useState(0);
    const [loadedPageEndIndex, setLoadedPageEndIndex] = useState(0);
    const [scrollOffset, setScrollOffset] = useState(0);
    const [scale, setScale] = useState(1.0);
    const listRef = useRef(null);
    const containerRef = useRef(null);
    const scrollToPage = useCallback((pageIndex) => {
        if (listRef.current) {
            listRef.current.scrollToItem(pageIndex - 1, 'start');
        }
    }, []);
    const setCurrentPageAndScroll = (page) => {
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
    const getOrCreateTextLayerCache = (pageNumber) => __awaiter(void 0, void 0, void 0, function* () {
        if (!pdfDocument)
            return;
        // If the text layer already exists in the cache, return it
        if (textLayerRefs.current.has(pageNumber)) {
            return textLayerRefs.current.get(pageNumber);
        }
        // If a promise is already in the cache for this page, return that promise
        if (textLayerPromiseCache.current.has(pageNumber)) {
            return textLayerPromiseCache.current.get(pageNumber);
        }
        // Create a new promise for the text layer rendering
        const renderTextLayerPromise = (() => __awaiter(void 0, void 0, void 0, function* () {
            const textLayerDiv = document.createElement('div');
            textLayerDiv.className = 'textLayer';
            const page = yield pdfDocument.getPage(pageNumber);
            const viewport = page.getViewport({ scale });
            textLayerDiv.style.width = `${viewport.width}px`;
            textLayerDiv.style.height = `${viewport.height}px`;
            textLayerDiv.style.setProperty("--scale-factor", scale.toString());
            const textContent = yield page.getTextContent();
            const textLayer = new TextLayer({
                container: textLayerDiv,
                textContentSource: textContent,
                viewport,
            });
            yield textLayer.render();
            // Store the rendered text layer in the cache
            textLayerRefs.current.set(pageNumber, textLayerDiv);
            // Remove the promise from the cache once the rendering is complete
            textLayerPromiseCache.current.delete(pageNumber);
            return textLayerDiv;
        }))();
        // Cache the promise and return it
        textLayerPromiseCache.current.set(pageNumber, renderTextLayerPromise);
        return renderTextLayerPromise;
    });
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
    return (React.createElement(PdfContext.Provider, { value: {
            citationText,
            setCitationText,
            overscanCount,
            documentStatus,
            setdocumentStatus,
            pdfDocument,
            setPdfDocument,
            numPages,
            setNumPages,
            scale,
            setScale,
            currentPage,
            setCurrentPage,
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
        } }, children));
};
export const usePdf = () => {
    const context = useContext(PdfContext);
    if (!context) {
        throw new Error('usePdf must be used within a PdfProvider');
    }
    return context;
};
