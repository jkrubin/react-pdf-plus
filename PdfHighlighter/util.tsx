import { MutableRefObject, RefObject, useEffect } from 'react';
import { Box, HighlightBox, HighlightEnd } from './types';

export const SAME_LINE_HEIGHT_ALLOWANCE: number = 5;

export const isHighlightable = (element: Element) => {
  if (
    element.tagName === 'SPAN' &&
    element.getAttribute('role') === 'presentation'
  ) {
    return true;
  }
  return false;
};

type CharOffset = {
  offsetNum: number;
  offsetPxStartLetter: number;
  offsetPxEndLetter: number;
};
export const getPxOffsetOfIndex = (
  span: HTMLElement,
  index: number,
): CharOffset => {
  const range = document.createRange();
  range.setStart(span.firstChild!, index);
  range.setEnd(
    span.firstChild!,
    Math.min(index + 1, span.firstChild!.textContent?.length || 0),
  );
  const rect = range.getBoundingClientRect();
  return {
    offsetNum: index,
    offsetPxStartLetter: rect.left - span.getBoundingClientRect().left,
    offsetPxEndLetter: rect.right - span.getBoundingClientRect().left,
  };
};
//TODO: Return Offset from start and end of char
export const getCharIndexUnderMouse = (
  span: HTMLElement,
  event: MouseEvent,
): CharOffset => {
  const range = document.createRange();
  for (let i = 0; i < span.textContent!.length; i++) {
    range.setStart(span.firstChild!, i);
    range.setEnd(span.firstChild!, i + 1);
    const rect = range.getBoundingClientRect();
    if (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    ) {
      const offsetPxStartLetter = rect.left - span.getBoundingClientRect().left;
      const offsetPxEndLetter = rect.right - span.getBoundingClientRect().left;
      return {
        offsetNum: i,
        offsetPxStartLetter: offsetPxStartLetter,
        offsetPxEndLetter: offsetPxEndLetter,
      };
    }
  }
  return {
    offsetNum: 0,
    offsetPxStartLetter: 0,
    offsetPxEndLetter: 0,
  };
};

export const isCurrentBeforeAnchor = (
  anchor: HighlightEnd,
  current: HighlightEnd,
): boolean => {
  if (!anchor.element || !current.element) {
    return false;
  }
  if (anchor.element === current.element) {
    return current.offset < anchor.offset;
  }

  const position = anchor.element.compareDocumentPosition(current.element);

  if (position & Node.DOCUMENT_POSITION_PRECEDING) {
    return true;
  }
  return false;
};

export const printHighlights = (
  startHighlight: HighlightEnd | null,
  endHighlight: HighlightEnd | null,
) => {
  if (!startHighlight || !endHighlight) {
    console.log(
      `Start: ${startHighlight ? 'true' : 'false'}, End: ${endHighlight ? 'true' : 'false'}`,
    );
    return;
  }
  console.log(
    `Start: ${highlightStr(startHighlight)}, End: ${highlightStr(endHighlight)}`,
  );
};

export const highlightStr = (highlight: HighlightEnd) => {
  const { element, offset } = highlight;
  const textContent = element?.textContent || '';
  const start = Math.max(0, offset - 2);
  const end = Math.min(textContent.length, offset + 2);
  return textContent.substring(start, end);
};

export const applyOffsetToHighlight = (
  box: HighlightBox,
  startOffset: number,
  endOffset: number | false,
): HighlightBox => {
  return {
    left: startOffset ? box.left + startOffset : box.left,
    top: box.top,
    width: box.width - startOffset - (endOffset ? box.width - endOffset : 0),
    height: box.height,
  };
};

export const spanSorter = (a: Element, b: Element) => {
  const { top: topA, left: leftA } = a.getBoundingClientRect();
  const { top: topB, left: leftB } = b.getBoundingClientRect();

  //Check if the tops are within 5px they should be on the same line
  if (Math.abs(topA - topB) > SAME_LINE_HEIGHT_ALLOWANCE) {
    return topA - topB;
  }

  // If the 'top' values are equal, sort by 'left'
  return leftA - leftB;
};
export const sortSpansByHeight = (spans: HTMLSpanElement[]) => {
  const sortedSpans = spans.sort(spanSorter);
  return sortedSpans;
};

export const getSpansSortedByheight = (
  pageRef: HTMLDivElement,
): { element: HTMLSpanElement; rect: DOMRect }[] => {
  if (pageRef) {
    let allSpans: HTMLSpanElement[] = Array.from(
      pageRef.querySelectorAll(`span[role='presentation']`) || [],
    ) as HTMLSpanElement[];
    return sortSpansByHeight(allSpans).map((span) => {
      const pageBox = pageRef.getBoundingClientRect();
      const spanBox = span.getBoundingClientRect();
      const relativeRect: DOMRect = {
        ...spanBox.toJSON(),
        top: spanBox.top - pageBox.top,
        bottom: spanBox.bottom - pageBox.top,
        y: spanBox.y - pageBox.top,
      };
      return { element: span, rect: relativeRect };
    });
  } else {
    return [];
  }
};

export const useMutationObserver = (
  refs: MutableRefObject<RefObject<HTMLDivElement>[]>,
  callback: MutationCallback,
  options: MutationObserverInit,
) => {
  useEffect(() => {
    const observers: MutationObserver[] = [];
    const currentRefs = refs.current;
    currentRefs.forEach((ref) => {
      const targetNode = ref.current?.querySelector('.textLayer');
      if (targetNode) {
        const observer = new MutationObserver(callback);
        observer.observe(targetNode, options);
        observers.push(observer);
      }
    });

    const handleResize = () => {
      observers.forEach((observer, index) => {
        const targetNode =
          currentRefs[index].current?.querySelector('.textLayer');
        if (targetNode) {
          observer.disconnect();
          observer.observe(targetNode, options);
        }
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      observers.forEach((observer) => observer.disconnect());
      window.removeEventListener('resize', handleResize);
    };
  }, [refs.current, callback, options]);
};

export const createMaxBox = (
  highlightedElements: Map<number, HighlightBox[]>,
): [number, Box] => {
  const maxBox: Box = {
    top: 999999,
    left: 999999,
    right: -999999,
    bottom: -999999,
  };
  let firstPageWithHighlights = 0;
  highlightedElements.forEach((_, key) => {
    if (!firstPageWithHighlights || key < firstPageWithHighlights) {
      firstPageWithHighlights = key;
    }
  });
  const elemsOnFirstPage = highlightedElements.get(firstPageWithHighlights);
  if (!elemsOnFirstPage) return [0, { top: 0, left: 0, bottom: 0, right: 0 }];
  for (const el of elemsOnFirstPage) {
    const right = el.left + el.width;
    const bottom = el.top + el.height;
    maxBox.top = Math.min(el.top, maxBox.top);
    maxBox.left = Math.min(el.left, maxBox.left);
    maxBox.right = Math.max(right, maxBox.right);
    maxBox.bottom = Math.max(bottom, maxBox.bottom);
  }
  return [firstPageWithHighlights, maxBox];
};

export const getStartEndIndeciesOfRegex = (
  searchText: string,
  concatenatedText: string,
): [number, number] => {
  let startIndex: number;
  let endIndex: number;
  if (searchText.length > 1000) {
    //Search start and end of biig text blob
    const searchPatternStart = searchText
      .slice(0, 1000)
      .slice()
      .replace(/[^a-zA-Z0-9]/g, '')
      .split('')
      .join('[^a-zA-Z0-9]*');
    const searchPatternEnd = searchText
      .slice(-1000)
      .slice()
      .replace(/[^a-zA-Z0-9]/g, '')
      .split('')
      .join('[^a-zA-Z0-9]*');

    const startRegex = new RegExp(searchPatternStart, 'i');
    const startMatch = startRegex.exec(concatenatedText.slice());
    const endRegex = new RegExp(searchPatternEnd, 'i');
    const endMatch = endRegex.exec(concatenatedText.slice());
    if (!startMatch || !endMatch) {
      return [-1, -1];
    }
    startIndex = startMatch.index;
    endIndex = endMatch.index + endMatch[0].length;
  } else {
    const searchPattern = searchText
      .slice(0, 1000)
      .slice()
      .replace(/[^a-zA-Z0-9]/g, '')
      .split('')
      .join('[^a-zA-Z0-9]*');
    const regex = new RegExp(searchPattern, 'i');
    const match = regex.exec(concatenatedText.slice());
    if (!match) {
      return [-1, -1];
    }
    startIndex = match.index;
    endIndex = startIndex + match[0].length - 1;
  }
  return [startIndex, endIndex];
};
