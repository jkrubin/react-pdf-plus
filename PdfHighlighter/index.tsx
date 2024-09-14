import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Box, HighlightBox, HighlightEnd } from './types';
import {
  getCharIndexUnderMouse,
  isHighlightable,
  isCurrentBeforeAnchor,
  applyOffsetToHighlight,
  getPxOffsetOfIndex,
  getSpansSortedByheight,
  createMaxBox,
  printHighlights,
  getStartEndIndeciesOfRegex,
} from './util';
import { HighlightTooltip } from './HighlightTooltip';
import { usePdf } from '../PdfContext';
import { filterMapByKeyRange } from '../util';
export type PdfHighlighterContextType = {
  onHighlightLayerRender: (page: number) => void;
  onTextLayerRender: (page: number) => void;
};
const PdfHighlighterContext = createContext<PdfHighlighterContextType>({
  onHighlightLayerRender: (page: number) => {},
  onTextLayerRender: (page: number) => {},
});

const emptyHighlightEnd: HighlightEnd = {
  element: null,
  offset: -1,
  offsetPxStartLetter: -1,
  offsetPxEndLetter: -1,
};
interface PdfHighlighterProps {
  children: React.ReactNode;
  tooltipContent?: ReactNode;
  tooltipClassName?: string;
}
export const PdfHighlighterProvider: React.FC<PdfHighlighterProps> = ({
  children,
  tooltipContent,
  tooltipClassName,
}) => {
  const [highlightedElementsBoundingRect, setHighlightedElementsBoundingRect] =
    useState<Box>({
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    });
  const [firstPageWithHighlights, setFirstPageWithHighlights] =
    useState<number>(0);
  const pdfHighlighterContainerRef = useRef<HTMLDivElement>(null);
  const highlightedElements = useRef<Map<number, HighlightBox[]>>(new Map());
  const [highlightAnchor, setHighlightAnchor] =
    useState<HighlightEnd>(emptyHighlightEnd);
  const [highlightCurrent, setHighlightCurrent] =
    useState<HighlightEnd>(emptyHighlightEnd);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [isHighlightingBackwards, setIsHighlightingBackwards] = useState(false);
  const [currentlyHighlighted, setCurrentlyHighlighted] = useState('');
  //Cached
  const [elementCache, setElementCache] = useState<Map<Element, HighlightBox>>(
    new Map(),
  );
  const [spansSortedByHeight, setSpansSortedByHeight] = useState<
    Map<number, { element: Element; rect: DOMRect }[]>
  >(new Map());

  const {
    citationText,
    setCitationText,
    currentPage,
    overscanCount,
    containerRef,
    pageRefs,
    highlightLayerRefs,
    textLayerRefs,
    loadedPageStartIndex,
    loadedPageEndIndex,
    scale,
  } = usePdf();

  useEffect(() => {
    drawHighlights(highlightedElements.current);
  }, [highlightedElements.current]);

  const onHighlightLayerRender = (page: number) => {
    const pageHighlights = highlightedElements.current.get(page);
    const highlightLayer = highlightLayerRefs.current?.get(page);
    if (pageHighlights && highlightLayer) {
      drawPageHighlights(pageHighlights, highlightLayer);
    }
  };

  const updateHighlightedElementsState = (
    highlights: Map<number, HighlightBox[]>,
  ) => {
    highlightedElements.current = highlights;
    // drawHighlights(highlights);

    if (!isHighlighting && highlights.size) {
      const [pageNum, maxBox] = createMaxBox(highlights);
      setHighlightedElementsBoundingRect(maxBox);
      setFirstPageWithHighlights(pageNum);
    } else {
    }
  };

  const drawPageHighlights = (
    highlightBoxes: HighlightBox[],
    pageCanvas: HTMLCanvasElement | null,
  ) => {
    if (!pageCanvas) return;
    const ctx = pageCanvas?.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
      // Draw each highlight box
      highlightBoxes.forEach((box) => {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
        ctx.fillRect(box.left, box.top, box.width, box.height);
      });
    }
  };

  const drawHighlights = (highlights: Map<number, HighlightBox[]>) => {
    for (
      let i = currentPage - overscanCount;
      i < currentPage + overscanCount + 1;
      i++
    ) {
      const highlightBoxes = highlights.get(i) || [];
      const pageCanvas = highlightLayerRefs?.current?.get(i) || null;
      if (pageCanvas?.isConnected) {
        drawPageHighlights(highlightBoxes, pageCanvas);
      } else {
      }
    }
  };

  useEffect(() => {
    if (!citationText?.match) {
      updateHighlightedElementsState(new Map());
    } else if (citationText?.match !== currentlyHighlighted) {
      highlightText(citationText?.match || '');
    }
  }, [citationText?.match, currentPage]);

  useEffect(() => {
    setSpansSortedByHeight((prevMap) => {
      filterMapByKeyRange(
        prevMap,
        currentPage - overscanCount,
        currentPage + overscanCount,
      );
      return prevMap;
    });
  }, [currentPage]);

  const onTextLayerRerender = (page: number) => {
    const cachedSpansSorted = spansSortedByHeight.get(page);
    if (!cachedSpansSorted || !cachedSpansSorted[0]?.element.isConnected) {
      setElementCache(new Map());
      const textLayer = textLayerRefs.current?.get(page);
      if (textLayer && textLayer.isConnected) {
        const sortedSpans = getSpansSortedByheight(textLayer);
        setSpansSortedByHeight((prevMap) => {
          prevMap.set(page, sortedSpans);
          return prevMap;
        });
      }
    } else {
      if (citationText?.match !== currentlyHighlighted) {
        highlightText(citationText?.match || '');
      }
    }
  };
  /**
   * Create a text blob from all spans, match against searchText, ignoring all characters between [a-z][0-9]
   * @param searchText
   * @returns
   */
  const highlightText = (searchText: string) => {
    if (!searchText) {
      updateHighlightedElementsState(new Map());
      return;
    }
    let concatenatedText = '';
    const nodes: {
      node: Node;
      pageNumber: number;
      startOffset: number;
      endOffset: number;
    }[] = [];
    for (let i = loadedPageStartIndex; i < loadedPageEndIndex + 1; i++) {
      const textLayer = textLayerRefs.current?.get(i);
      if (!textLayer) {
        continue;
      }

      const walker = document.createTreeWalker(
        textLayer,
        NodeFilter.SHOW_TEXT,
        null,
      );
      let currentNode;

      while ((currentNode = walker.nextNode())) {
        const text = currentNode.textContent || '';

        nodes.push({
          node: currentNode,
          pageNumber: i,
          startOffset: concatenatedText.length,
          endOffset: concatenatedText.length + text.length,
        });
        concatenatedText += text;
      }
    }
    let [startIndex, endIndex] = getStartEndIndeciesOfRegex(
      searchText,
      concatenatedText,
    );
    if (startIndex === -1) {
      updateHighlightedElementsState(new Map());
      return null;
    }
    let rangeStartNode: HTMLElement | null = null;
    let rangeEndNode: HTMLElement | null = null;
    let rangeStartOffset = 0;
    let rangeEndOffset = 0;
    const newHighlightedElements = new Map<number, HighlightBox[]>();

    const addHighlightBoxToPage = (pageNumber: number, box: HighlightBox) => {
      // Initialize the array if the pageNumber doesn't exist
      if (!newHighlightedElements.has(pageNumber)) {
        newHighlightedElements.set(pageNumber, []);
      }

      // Push the new box to the array for the corresponding page number
      newHighlightedElements.get(pageNumber)?.push(box);
    };

    for (let i = 0; i < nodes.length; i++) {
      const { node, pageNumber, startOffset, endOffset } = nodes[i];
      const pageRef = pageRefs.current?.get(pageNumber);
      if (!pageRef) {
        continue;
      }
      const nodeParentSpan = node.parentElement;
      if (!nodeParentSpan) {
        continue;
      }
      if (
        !rangeStartNode &&
        startIndex >= startOffset &&
        startIndex < endOffset
      ) {
        //We found our rage.start
        rangeStartNode = nodeParentSpan;
        if (!rangeStartNode.isConnected) {
          //We are trying to highlight text on a text layer that is between rendering
          //Next time we get a rendered text layer we will try to highlight again
          return;
        }
        rangeStartOffset = startIndex - startOffset;
        const { offsetPxStartLetter: startOffsetPx } = getPxOffsetOfIndex(
          rangeStartNode,
          rangeStartOffset,
        );
        if (endIndex > startOffset && endIndex <= endOffset) {
          //start node === end node
          rangeEndOffset = endIndex - startOffset;
          const { offsetPxEndLetter: endOffsetPx } = getPxOffsetOfIndex(
            rangeStartNode,
            rangeEndOffset,
          );
          const highlightBox = createHighlightBoxesFromElement(
            rangeStartNode,
            pageRef,
            startOffsetPx,
            endOffsetPx,
          );
          addHighlightBoxToPage(pageNumber, highlightBox);
          break;
        }
        addHighlightBoxToPage(
          pageNumber,
          createHighlightBoxesFromElement(
            rangeStartNode,
            pageRef,
            startOffsetPx,
          ),
        );
        continue;
      } //End StartNode
      if (endIndex > startOffset && endIndex <= endOffset) {
        //We found our range end node
        rangeEndNode = nodeParentSpan;
        rangeEndOffset = endIndex - startOffset;
        const { offsetPxEndLetter: endOffsetPx } = getPxOffsetOfIndex(
          rangeEndNode,
          rangeEndOffset,
        );
        addHighlightBoxToPage(
          pageNumber,
          createHighlightBoxesFromElement(
            rangeEndNode,
            pageRef,
            0,
            endOffsetPx,
          ),
        );
        continue;
      } //End endNode
      if (rangeStartNode && rangeEndNode) {
        break;
      }
      if (
        rangeStartNode &&
        startIndex <= startOffset &&
        endOffset <= endIndex
      ) {
        //We have a middle node
        addHighlightBoxToPage(
          pageNumber,
          createHighlightBoxesFromElement(nodeParentSpan, pageRef),
        );
      }
    }
    updateHighlightedElementsState(newHighlightedElements);
    setCurrentlyHighlighted(searchText);
    return null;
  };

  /**
   * Find the page in PageRefs that the current mouse position is in (on the y axis only)
   * @param event
   */
  const findPageInFocus = (event: MouseEvent): number => {
    const { clientY } = event;

    for (let i = loadedPageStartIndex; i < loadedPageEndIndex + 1; i++) {
      const page = pageRefs.current?.get(i);
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
  const findClosestSpanToMouse = (
    event: MouseEvent,
    pageNumber: number,
  ): Element | false => {
    const { clientX, clientY } = event;
    const pageRef = pageRefs.current?.get(pageNumber);
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
      if (
        Math.abs(sortedSpans[i].rect.top - sortedSpans[j - 1].rect.top) > 10
      ) {
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
      return sortedSpans[i + 1]?.element || null;
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
  const createHighlightBoxesFromElement = (
    element: Element,
    pageRef: HTMLDivElement,
    startOffset: number = 0,
    endOffset: number | false = false,
  ): HighlightBox => {
    if (elementCache.has(element)) {
      const cached = elementCache.get(element);
      if (cached) {
        return applyOffsetToHighlight(cached, startOffset, endOffset);
      }
    }
    // Get the bounding box of the element to be highlighted
    const { left, top, width, height } = element.getBoundingClientRect();

    // Get the position of the page container instead of the canvas
    const { left: pageLeft, top: pageTop } =
      pageRef.getBoundingClientRect() || { top: 0, left: 0 };

    // Calculate the position relative to the page container
    const elemHighlight = {
      left: left - pageLeft,
      top: top - pageTop,
      width: width,
      height: height,
    };
    // Cache the element's highlight box
    setElementCache(
      (prevCache) => new Map(prevCache.set(element, elemHighlight)),
    );

    // Apply offset adjustments to the highlight if necessary
    return applyOffsetToHighlight(elemHighlight, startOffset, endOffset);
  };

  const getElementsInRangeForPage = (
    range: Range,
    pageElement: HTMLDivElement,
    currentHighlight: HighlightEnd,
  ): HighlightBox[] => {
    const elements: HighlightBox[] = [];
    const treeWalker = document.createTreeWalker(
      pageElement,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          let closestSpan = node;
          if (range.intersectsNode(closestSpan)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT;
        },
      },
    );

    while (treeWalker.nextNode()) {
      const node = treeWalker.currentNode;
      const roleText = (node as Element).getAttribute('role') || '';
      if (!roleText.includes('presentation')) {
        continue;
      }
      if ((node as Element) === highlightAnchor?.element) {
        if ((node as Element) === currentHighlight.element) {
          //Start and end Node are the same
          return [
            createHighlightBoxesFromElement(
              node as Element,
              pageElement,
              isHighlightingBackwards
                ? currentHighlight.offsetPxStartLetter
                : highlightAnchor.offsetPxStartLetter,
              isHighlightingBackwards
                ? highlightAnchor.offsetPxStartLetter
                : currentHighlight.offsetPxEndLetter,
            ),
          ];
        }
        elements.push(
          createHighlightBoxesFromElement(
            node as Element,
            pageElement,
            isHighlightingBackwards ? 0 : highlightAnchor.offsetPxStartLetter,
            isHighlightingBackwards ? highlightAnchor.offsetPxStartLetter : 0,
          ),
        );
      } else if ((node as Element) === currentHighlight?.element) {
        elements.push(
          createHighlightBoxesFromElement(
            node as Element,
            pageElement,
            isHighlightingBackwards ? currentHighlight.offsetPxStartLetter : 0,
            isHighlightingBackwards ? 0 : currentHighlight.offsetPxEndLetter,
          ),
        );
      } else {
        elements.push(
          createHighlightBoxesFromElement(node as Element, pageElement),
        );
      }
    }
    return elements;
  };

  /**
   * Update the highlighted elements across multiple pages and update state.
   */
  const updateHighlightedElements = (
    range: Range,
    currentHighlight: HighlightEnd,
  ) => {
    if (!pageRefs.current) return;

    const newHighlightedElements = new Map<number, HighlightBox[]>();
    for (
      let i = loadedPageStartIndex;
      i < Math.max(loadedPageEndIndex, currentPage) + 1;
      i++
    ) {
      const pageRef = pageRefs.current.get(i);
      if (pageRef) {
        const highlightBoxesForPage = getElementsInRangeForPage(
          range,
          pageRef,
          currentHighlight,
        );
        if (highlightBoxesForPage.length > 0) {
          newHighlightedElements.set(i, highlightBoxesForPage);
        }
      }
    }
    updateHighlightedElementsState(newHighlightedElements);
  };

  /**
   * Takes the HighlightAnchor, HighlightCurrent from state and creates a range with those elements as the start/end
   * @returns
   */
  const createRangeFromHighlight = (
    currentHighlightEnd: HighlightEnd | false = false,
  ) => {
    if (!highlightAnchor.element || !highlightCurrent.element) {
      return null;
    }
    const current = currentHighlightEnd
      ? currentHighlightEnd
      : highlightCurrent;
    const range = document.createRange();
    try {
      if (isHighlightingBackwards) {
        range.setStart(current?.element?.firstChild as Node, current.offset);
        range.setEnd(
          highlightAnchor?.element?.firstChild as Node,
          highlightAnchor.offset,
        );
      } else {
        range.setStart(
          highlightAnchor?.element?.firstChild as Node,
          highlightAnchor.offset,
        );
        range.setEnd(current?.element?.firstChild as Node, current.offset + 1);
      }
    } catch (err) {
      console.log('ERR:', err);
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
  const findNearestFocus = (event: MouseEvent): HighlightEnd | false => {
    const page = findPageInFocus(event);
    const span = findClosestSpanToMouse(event, page);
    if (span) {
      let offsetIndex;
      if (isHighlightingBackwards) {
        offsetIndex = 0;
      } else {
        offsetIndex = span.textContent?.length;
      }
      const currentHighlight: HighlightEnd = {
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

  const handleMouseMove = (event: MouseEvent) => {
    if (!isHighlighting || event.buttons === 0) {
      return;
    }
    event.preventDefault();
    let currentHighlight: HighlightEnd | false = false;
    const elementUnderCursor = document.elementFromPoint(
      event.clientX,
      event.clientY,
    );
    if (elementUnderCursor && isHighlightable(elementUnderCursor)) {
      const { offsetNum, offsetPxStartLetter, offsetPxEndLetter } =
        getCharIndexUnderMouse(elementUnderCursor as HTMLElement, event);
      let hoveredContainer = elementUnderCursor as Node;
      const anchorElem = highlightAnchor?.element || null;
      if (
        anchorElem === null ||
        (anchorElem?.contains(hoveredContainer as HTMLElement) &&
          hoveredContainer.textContent !== anchorElem?.textContent)
      ) {
        setHighlightAnchor({
          element: hoveredContainer as HTMLElement,
          offset: offsetNum ?? 0,
          offsetPxStartLetter: offsetPxStartLetter ?? 0,
          offsetPxEndLetter: offsetPxEndLetter ?? 0,
        });
      }
      currentHighlight = {
        element: hoveredContainer as HTMLElement,
        offset: offsetNum ?? 0,
        offsetPxStartLetter: offsetPxStartLetter ?? 0,
        offsetPxEndLetter: offsetPxEndLetter ?? 0,
      };
      if (
        !(
          hoveredContainer === highlightCurrent.element &&
          offsetNum === highlightCurrent.offset
        )
      ) {
        setHighlightCurrent(currentHighlight as HighlightEnd);
        //Highlight didn't move so stop the fn
        //TODO: This ends the highlight one block early because the offset / state is set async
        // return;
      }
      setIsHighlightingBackwards(
        isCurrentBeforeAnchor(highlightAnchor, currentHighlight),
      );
    } else if (highlightAnchor.element) {
      try {
        currentHighlight = findNearestFocus(event);
      } catch (e) {
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
      pageDiv.addEventListener('mouseup', handleMouseUp);
      pageDiv.addEventListener('mousemove', handleMouseMove);
      pageDiv.addEventListener('mousedown', handleMouseDown);
    }
    return () => {
      if (pageDiv) {
        pageDiv.removeEventListener('mouseup', handleMouseUp);
        pageDiv.removeEventListener('mousemove', handleMouseMove);
        pageDiv.removeEventListener('mousedown', handleMouseDown);
      }
    };
  }, [
    containerRef,
    handleMouseUp,
    handleMouseMove,
    handleMouseDown,
    spansSortedByHeight,
  ]);

  return (
    <PdfHighlighterContext.Provider
      value={{
        onHighlightLayerRender: onHighlightLayerRender,
        onTextLayerRender: onTextLayerRerender,
      }}
    >
      <div
        ref={pdfHighlighterContainerRef}
        style={{
          userSelect: 'none',
          position: 'relative',
          display: 'contents',
        }}
      >
        {children}
        {tooltipContent && (
          <HighlightTooltip
            isVisible={
              !isHighlighting &&
              !!citationText?.match.length &&
              highlightedElements.current.size > 0
            }
            highlightBox={highlightedElementsBoundingRect}
            pageNum={firstPageWithHighlights}
            toolTipClass={tooltipClassName}
          >
            <div>{tooltipContent}</div>
          </HighlightTooltip>
        )}
      </div>
    </PdfHighlighterContext.Provider>
  );
};

export const usePdfHighlighter = () => {
  return useContext(PdfHighlighterContext);
};
