import React, { createContext, useContext, useEffect, useState, } from "react";
import { getCharIndexUnderMouse, isHighlightable, isCurrentBeforeAnchor, applyOffsetToHighlight, getPxOffsetOfIndex, getSpansSortedByheight, createMaxBox, getStartEndIndeciesOfRegex, } from "./util";
import { usePdf } from "../PdfContext";
import { filterMapByKeyRange } from "../util";
const PdfHighlighterContext = createContext({
    onHighlightLayerRender: (page) => { },
    onTextLayerRender: (page) => { },
});
const emptyHighlightEnd = {
    element: null,
    offset: -1,
    offsetPxStartLetter: -1,
    offsetPxEndLetter: -1,
};
export const PdfHighlighterProvider = ({ children, tooltipContent, tooltipClassName }) => {
    const [highlightedElementsBoundingRect, setHighlightedElementsBoundingRect] = useState({
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    });
    const [firstPageWithHighlights, setFirstPageWithHighlights] = useState(0);
    const [highlightedElements, setHighlightedElements] = useState(new Map());
    const [highlightAnchor, setHighlightAnchor] = useState(emptyHighlightEnd);
    const [highlightCurrent, setHighlightCurrent] = useState(emptyHighlightEnd);
    const [isHighlighting, setIsHighlighting] = useState(false);
    const [isHighlightingBackwards, setIsHighlightingBackwards] = useState(false);
    const [currentlyHighlighted, setCurrentlyHighlighted] = useState('');
    //Cached
    const [elementCache, setElementCache] = useState(new Map());
    const [spansSortedByHeight, setSpansSortedByHeight] = useState(new Map());
    const { citationText, setCitationText, currentPage, overscanCount, containerRef, pageRefs, highlightLayerRefs, textLayerRefs, loadedPageStartIndex, loadedPageEndIndex, scale, } = usePdf();
    const onHighlightLayerRender = (page) => {
        var _a;
        const pageHighlights = highlightedElements.get(page);
        const highlightLayer = (_a = highlightLayerRefs.current) === null || _a === void 0 ? void 0 : _a.get(page);
        if (pageHighlights && highlightLayer) {
            drawPageHighlights(pageHighlights, highlightLayer);
        }
    };
    const updateHighlightedElementsState = (highlights) => {
        setHighlightedElements(highlights);
        console.log('state has been updated');
        drawHighlights(highlights);
        if (!isHighlighting && highlights.size) {
            const [pageNum, maxBox] = createMaxBox(highlights);
            console.log('max box is', pageNum, maxBox);
            setHighlightedElementsBoundingRect(maxBox);
            setFirstPageWithHighlights(pageNum);
        }
        else {
        }
    };
    const drawPageHighlights = (highlightBoxes, pageCanvas) => {
        if (!pageCanvas)
            return;
        const ctx = pageCanvas === null || pageCanvas === void 0 ? void 0 : pageCanvas.getContext("2d");
        if (ctx && highlightBoxes.length > 0) {
            ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
            // Draw each highlight box
            highlightBoxes.forEach((box) => {
                ctx.fillStyle = "rgba(255, 255, 0, 0.4)";
                ctx.fillRect(box.left, box.top, box.width, box.height);
            });
        }
    };
    const drawHighlights = (highlights) => {
        highlights.forEach((highlightBoxes, pageNumber) => {
            var _a;
            const pageCanvas = ((_a = highlightLayerRefs === null || highlightLayerRefs === void 0 ? void 0 : highlightLayerRefs.current) === null || _a === void 0 ? void 0 : _a.get(pageNumber)) || null;
            drawPageHighlights(highlightBoxes, pageCanvas);
        });
    };
    // useEffect(() => {
    //   console.log('draw highlights')
    //   drawHighlights();
    //   // if (!isHighlighting && highlightedElements.entries.length) {
    //   //   const [pageNum, maxBox] = createMaxBox(highlightedElements)
    //   //   setHighlightedElementsBoundingRect(maxBox);
    //   //   setFirstPageWithHighlights(pageNum)
    //   // } else {
    //   // }
    // }, [highlightedElements, highlightLayerRefs.current?.values()]);
    useEffect(() => {
        if ((citationText === null || citationText === void 0 ? void 0 : citationText.match) !== currentlyHighlighted) {
            highlightText((citationText === null || citationText === void 0 ? void 0 : citationText.match) || "");
            setCurrentlyHighlighted((citationText === null || citationText === void 0 ? void 0 : citationText.match) || '');
        }
    }, [citationText, currentPage]);
    useEffect(() => {
        setSpansSortedByHeight((prevMap) => {
            filterMapByKeyRange(prevMap, currentPage - overscanCount, currentPage + overscanCount);
            return prevMap;
        });
    }, [currentPage]);
    const onTextLayerRerender = (page) => {
        var _a;
        const cachedSpansSorted = spansSortedByHeight.get(page);
        if (!cachedSpansSorted) {
            setElementCache(new Map());
            const textLayer = (_a = textLayerRefs.current) === null || _a === void 0 ? void 0 : _a.get(page);
            if (textLayer) {
                const sortedSpans = getSpansSortedByheight(textLayer);
                setSpansSortedByHeight((prevMap) => {
                    prevMap.set(page, sortedSpans);
                    return prevMap;
                });
            }
            console.log('u kno wen');
            highlightText((citationText === null || citationText === void 0 ? void 0 : citationText.match) || "");
        }
        else {
        }
    };
    /**
     * Create a text blob from all spans, match against searchText, ignoring all characters between [a-z][0-9]
     * @param searchText
     * @returns
     */
    const highlightText = (searchText) => {
        var _a, _b;
        let concatenatedText = "";
        const nodes = [];
        for (let i = loadedPageStartIndex; i < loadedPageEndIndex + 1; i++) {
            const textLayer = (_a = textLayerRefs.current) === null || _a === void 0 ? void 0 : _a.get(i);
            if (!textLayer) {
                continue;
            }
            const walker = document.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT, null);
            let currentNode;
            while ((currentNode = walker.nextNode())) {
                const text = currentNode.textContent || "";
                nodes.push({
                    node: currentNode,
                    pageNumber: i,
                    startOffset: concatenatedText.length,
                    endOffset: concatenatedText.length + text.length,
                });
                concatenatedText += text;
            }
        }
        let [startIndex, endIndex] = getStartEndIndeciesOfRegex(searchText, concatenatedText);
        if (startIndex === -1) {
            console.log('oy');
            updateHighlightedElementsState(new Map());
            return null;
        }
        let rangeStartNode = null;
        let rangeEndNode = null;
        let rangeStartOffset = 0;
        let rangeEndOffset = 0;
        const newHighlightedElements = new Map();
        const addHighlightBoxToPage = (pageNumber, box) => {
            var _a;
            // Initialize the array if the pageNumber doesn't exist
            if (!newHighlightedElements.has(pageNumber)) {
                newHighlightedElements.set(pageNumber, []);
            }
            // Push the new box to the array for the corresponding page number
            (_a = newHighlightedElements.get(pageNumber)) === null || _a === void 0 ? void 0 : _a.push(box);
        };
        for (let i = 0; i < nodes.length; i++) {
            const { node, pageNumber, startOffset, endOffset } = nodes[i];
            const pageRef = (_b = pageRefs.current) === null || _b === void 0 ? void 0 : _b.get(pageNumber);
            if (!pageRef) {
                continue;
            }
            const nodeParentSpan = node.parentElement;
            if (!nodeParentSpan) {
                continue;
            }
            if (!rangeStartNode &&
                startIndex >= startOffset &&
                startIndex < endOffset) {
                //We found our rage.start
                rangeStartNode = nodeParentSpan;
                rangeStartOffset = startIndex - startOffset;
                const { offsetPxStartLetter: startOffsetPx } = getPxOffsetOfIndex(rangeStartNode, rangeStartOffset);
                if (endIndex > startOffset && endIndex <= endOffset) {
                    //start node === end node
                    rangeEndOffset = endIndex - startOffset;
                    const { offsetPxEndLetter: endOffsetPx } = getPxOffsetOfIndex(rangeStartNode, rangeEndOffset);
                    const highlightBox = createHighlightBoxesFromElement(rangeStartNode, pageRef, startOffsetPx, endOffsetPx);
                    addHighlightBoxToPage(pageNumber, highlightBox);
                    break;
                }
                addHighlightBoxToPage(pageNumber, createHighlightBoxesFromElement(rangeStartNode, pageRef, startOffsetPx));
                continue;
            } //End StartNode
            if (endIndex > startOffset && endIndex <= endOffset) {
                //We found our range end node
                rangeEndNode = nodeParentSpan;
                rangeEndOffset = endIndex - startOffset;
                const { offsetPxEndLetter: endOffsetPx } = getPxOffsetOfIndex(rangeEndNode, rangeEndOffset);
                addHighlightBoxToPage(pageNumber, createHighlightBoxesFromElement(rangeEndNode, pageRef, 0, endOffsetPx));
                continue;
            } //End endNode
            if (rangeStartNode && rangeEndNode) {
                break;
            }
            if (rangeStartNode &&
                startIndex <= startOffset &&
                endOffset <= endIndex) {
                //We have a middle node
                addHighlightBoxToPage(pageNumber, createHighlightBoxesFromElement(nodeParentSpan, pageRef));
            }
        }
        console.log('u know wot');
        updateHighlightedElementsState(newHighlightedElements);
        return null;
    };
    /**
     * Page has rendered or re-rendered
     * Attach and resize hihglight layer canvas to the pdf canvas
     * Calculate 'Page Multipliers' as the %difference between the style in px and the actual boundingRect
     * The canvas is set to a certain h/w and scaled down, we need to find that scale
     */
    /**
     * Find the page in PageRefs that the current mouse position is in (on the y axis only)
     * @param event
     */
    const findPageInFocus = (event) => {
        var _a;
        const { clientY } = event;
        for (let i = loadedPageStartIndex; i < loadedPageEndIndex + 1; i++) {
            const page = (_a = pageRefs.current) === null || _a === void 0 ? void 0 : _a.get(i);
            if (page) {
                const rect = page.getBoundingClientRect();
                // Check if the mouse Y position is between the top and bottom of the page
                if (clientY >= rect.top && clientY <= rect.bottom) {
                    return i;
                }
            }
        }
        return -1; // Return -1 if no page is found in focus
    };
    /**
     * Given our array of spans stored in state, sorted by textual order by rect.top, rect.left,
     * find the span/offset closest to the mouse position that should be highlighted
     * Different logic is applied to grab the span/offset depending on if we are highlighting backwards
     * or if we are to the left/right of the closest span
     * @param event MouseEvent
     * @returns The element closest to the span
     */
    const findClosestSpanToMouse = (event, pageNumber) => {
        var _a, _b;
        const { clientX, clientY } = event;
        const pageRef = (_a = pageRefs.current) === null || _a === void 0 ? void 0 : _a.get(pageNumber);
        const sortedSpans = spansSortedByHeight.get(pageNumber);
        if (!sortedSpans || !pageRef) {
            return false;
        }
        const pageTopOffset = pageRef.getBoundingClientRect().top;
        const clientYOffsetOnPage = clientY - pageTopOffset;
        //Could make binary search, but the volume of spans is so low it shouldnt matter
        let i;
        for (i = 0; i < sortedSpans.length - 1; i++) {
            //If the next span starts below MouseY, we know we have the last eligiable span
            const nextSpan = sortedSpans[i + 1];
            if (nextSpan.rect.top > clientYOffsetOnPage) {
                break;
            }
        }
        const closestSpan = sortedSpans[i];
        let j = i;
        for (j = i; j > 0; j--) {
            //Go back through the spans that are on the same line
            if (Math.abs(sortedSpans[i].rect.top - sortedSpans[j - 1].rect.top) > 10) {
                //The next element up is a new line
                break;
            }
        }
        const startSpanOnLine = sortedSpans[j];
        if (closestSpan.rect.bottom > clientYOffsetOnPage) {
            //We are on the x axis of a line
            if (clientX < startSpanOnLine.rect.left) {
                //We are to the left of the text, return accordingly
                if (isHighlightingBackwards) {
                    return startSpanOnLine.element;
                }
                return sortedSpans[j - 1].element;
            }
        }
        if (isHighlightingBackwards) {
            //We are highlighting upwards, so the last highlighted element should be the one below the cursor
            return ((_b = sortedSpans[i + 1]) === null || _b === void 0 ? void 0 : _b.element) || null;
        }
        return sortedSpans[i].element;
    };
    /**
     * Maintains a cache of elements -> boundingBox
     * Gets the cached dom rect and apply offset, if not cached update it
     * @param element
     * @param startOffset
     * @param endOffset
     * @returns
     */
    const createHighlightBoxesFromElement = (element, pageRef, startOffset = 0, endOffset = false) => {
        if (elementCache.has(element)) {
            const cached = elementCache.get(element);
            if (cached) {
                return applyOffsetToHighlight(cached, startOffset, endOffset);
            }
        }
        // Get the bounding box of the element to be highlighted
        const { left, top, width, height } = element.getBoundingClientRect();
        // Get the position of the page container instead of the canvas
        const { left: pageLeft, top: pageTop } = pageRef.getBoundingClientRect() || { top: 0, left: 0 };
        // Calculate the position relative to the page container
        const elemHighlight = {
            left: left - pageLeft,
            top: top - pageTop,
            width: width,
            height: height,
        };
        // Cache the element's highlight box
        setElementCache((prevCache) => new Map(prevCache.set(element, elemHighlight)));
        // Apply offset adjustments to the highlight if necessary
        return applyOffsetToHighlight(elemHighlight, startOffset, endOffset);
    };
    const getElementsInRangeForPage = (range, pageElement, currentHighlight) => {
        const elements = [];
        const treeWalker = document.createTreeWalker(pageElement, NodeFilter.SHOW_ELEMENT, {
            acceptNode: (node) => {
                let closestSpan = node;
                if (range.intersectsNode(closestSpan)) {
                    return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_REJECT;
            },
        });
        while (treeWalker.nextNode()) {
            const node = treeWalker.currentNode;
            const roleText = node.getAttribute("role") || "";
            if (!roleText.includes("presentation")) {
                continue;
            }
            if (node === (highlightAnchor === null || highlightAnchor === void 0 ? void 0 : highlightAnchor.element)) {
                if (node === currentHighlight.element) {
                    //Start and end Node are the same
                    return [
                        createHighlightBoxesFromElement(node, pageElement, isHighlightingBackwards
                            ? currentHighlight.offsetPxStartLetter
                            : highlightAnchor.offsetPxStartLetter, isHighlightingBackwards
                            ? highlightAnchor.offsetPxStartLetter
                            : currentHighlight.offsetPxEndLetter),
                    ];
                }
                elements.push(createHighlightBoxesFromElement(node, pageElement, isHighlightingBackwards ? 0 : highlightAnchor.offsetPxStartLetter, isHighlightingBackwards ? highlightAnchor.offsetPxStartLetter : 0));
            }
            else if (node === (currentHighlight === null || currentHighlight === void 0 ? void 0 : currentHighlight.element)) {
                elements.push(createHighlightBoxesFromElement(node, pageElement, isHighlightingBackwards ? currentHighlight.offsetPxStartLetter : 0, isHighlightingBackwards ? 0 : currentHighlight.offsetPxEndLetter));
            }
            else {
                elements.push(createHighlightBoxesFromElement(node, pageElement));
            }
        }
        return elements;
    };
    /**
     * Update the highlighted elements across multiple pages and update state.
     */
    const updateHighlightedElements = (range, currentHighlight) => {
        if (!pageRefs.current)
            return;
        const newHighlightedElements = new Map();
        for (let i = loadedPageStartIndex; i < (Math.max(loadedPageEndIndex, currentPage)) + 1; i++) {
            const pageRef = pageRefs.current.get(i);
            if (pageRef) {
                const highlightBoxesForPage = getElementsInRangeForPage(range, pageRef, currentHighlight);
                if (highlightBoxesForPage.length > 0) {
                    newHighlightedElements.set(i, highlightBoxesForPage);
                }
            }
        }
        console.log('dis right here');
        updateHighlightedElementsState(newHighlightedElements);
    };
    /**
     * Takes the HighlightAnchor, HighlightCurrent from state and creates a range with those elements as the start/end
     * @returns
     */
    const createRangeFromHighlight = (currentHighlightEnd = false) => {
        var _a, _b, _c, _d;
        if (!highlightAnchor.element || !highlightCurrent.element) {
            return null;
        }
        const current = currentHighlightEnd
            ? currentHighlightEnd
            : highlightCurrent;
        const range = document.createRange();
        try {
            if (isHighlightingBackwards) {
                range.setStart((_a = current === null || current === void 0 ? void 0 : current.element) === null || _a === void 0 ? void 0 : _a.firstChild, current.offset);
                range.setEnd((_b = highlightAnchor === null || highlightAnchor === void 0 ? void 0 : highlightAnchor.element) === null || _b === void 0 ? void 0 : _b.firstChild, highlightAnchor.offset);
            }
            else {
                range.setStart((_c = highlightAnchor === null || highlightAnchor === void 0 ? void 0 : highlightAnchor.element) === null || _c === void 0 ? void 0 : _c.firstChild, highlightAnchor.offset);
                range.setEnd((_d = current === null || current === void 0 ? void 0 : current.element) === null || _d === void 0 ? void 0 : _d.firstChild, current.offset + 1);
            }
        }
        catch (err) {
            console.log("ERR:", err);
            return null;
        }
        return range;
    };
    const handleMouseUp = () => {
        setIsHighlighting(false);
        const range = createRangeFromHighlight();
        if (range) {
            setCitationText({ match: range.toString(), exactMatch: false });
        }
        setHighlightAnchor({
            element: null,
            offset: -1,
            offsetPxStartLetter: -1,
            offsetPxEndLetter: -1,
        });
        setHighlightCurrent({
            element: null,
            offset: -1,
            offsetPxStartLetter: -1,
            offsetPxEndLetter: -1,
        });
    };
    /**
     * When the mouse is out of bounds on a valid element, find the nearest valid element to it using the cached list of spans sorted by
     * height
     * @param event
     */
    const findNearestFocus = (event) => {
        var _a;
        const page = findPageInFocus(event);
        const span = findClosestSpanToMouse(event, page);
        if (span) {
            let offsetIndex;
            if (isHighlightingBackwards) {
                offsetIndex = 0;
            }
            else {
                offsetIndex = (_a = span.textContent) === null || _a === void 0 ? void 0 : _a.length;
            }
            const currentHighlight = {
                element: span,
                offset: offsetIndex ? offsetIndex - 1 : 0,
                offsetPxStartLetter: 0,
                offsetPxEndLetter: 0,
            };
            setHighlightCurrent(currentHighlight);
            return currentHighlight;
        }
        return false;
    };
    const handleMouseMove = (event) => {
        if (!isHighlighting || event.buttons === 0) {
            return;
        }
        event.preventDefault();
        let currentHighlight = false;
        const elementUnderCursor = document.elementFromPoint(event.clientX, event.clientY);
        if (elementUnderCursor && isHighlightable(elementUnderCursor)) {
            const { offsetNum, offsetPxStartLetter, offsetPxEndLetter } = getCharIndexUnderMouse(elementUnderCursor, event);
            let hoveredContainer = elementUnderCursor;
            const anchorElem = (highlightAnchor === null || highlightAnchor === void 0 ? void 0 : highlightAnchor.element) || null;
            if (anchorElem === null ||
                ((anchorElem === null || anchorElem === void 0 ? void 0 : anchorElem.contains(hoveredContainer)) &&
                    hoveredContainer.textContent !== (anchorElem === null || anchorElem === void 0 ? void 0 : anchorElem.textContent))) {
                setHighlightAnchor({
                    element: hoveredContainer,
                    offset: offsetNum !== null && offsetNum !== void 0 ? offsetNum : 0,
                    offsetPxStartLetter: offsetPxStartLetter !== null && offsetPxStartLetter !== void 0 ? offsetPxStartLetter : 0,
                    offsetPxEndLetter: offsetPxEndLetter !== null && offsetPxEndLetter !== void 0 ? offsetPxEndLetter : 0,
                });
            }
            currentHighlight = {
                element: hoveredContainer,
                offset: offsetNum !== null && offsetNum !== void 0 ? offsetNum : 0,
                offsetPxStartLetter: offsetPxStartLetter !== null && offsetPxStartLetter !== void 0 ? offsetPxStartLetter : 0,
                offsetPxEndLetter: offsetPxEndLetter !== null && offsetPxEndLetter !== void 0 ? offsetPxEndLetter : 0,
            };
            if (!(hoveredContainer === highlightCurrent.element &&
                offsetNum === highlightCurrent.offset)) {
                setHighlightCurrent(currentHighlight);
                //Highlight didn't move so stop the fn
                //TODO: This ends the highlight one block early because the offset / state is set async
                // return;
            }
            setIsHighlightingBackwards(isCurrentBeforeAnchor(highlightAnchor, currentHighlight));
        }
        else if (highlightAnchor.element) {
            try {
                currentHighlight = findNearestFocus(event);
            }
            catch (e) {
                console.log(e);
            }
        }
        const range = createRangeFromHighlight(currentHighlight);
        if (range) {
            updateHighlightedElements(range, currentHighlight || highlightCurrent);
        }
    };
    const handleMouseDown = () => {
        setIsHighlighting(true);
    };
    useEffect(() => {
        const pageDiv = containerRef.current;
        if (pageDiv) {
            pageDiv.addEventListener("mouseup", handleMouseUp);
            pageDiv.addEventListener("mousemove", handleMouseMove);
            pageDiv.addEventListener("mousedown", handleMouseDown);
        }
        return () => {
            if (pageDiv) {
                pageDiv.removeEventListener("mouseup", handleMouseUp);
                pageDiv.removeEventListener("mousemove", handleMouseMove);
                pageDiv.removeEventListener("mousedown", handleMouseDown);
            }
        };
    }, [
        containerRef,
        handleMouseUp,
        handleMouseMove,
        handleMouseDown,
        spansSortedByHeight,
    ]);
    return (React.createElement(PdfHighlighterContext.Provider, { value: {
            onHighlightLayerRender: onHighlightLayerRender,
            onTextLayerRender: onTextLayerRerender,
        } },
        React.createElement("div", { ref: containerRef, style: { userSelect: "none", position: "relative", display: "contents" } }, children)));
};
export const usePdfHighlighter = () => {
    return useContext(PdfHighlighterContext);
};
