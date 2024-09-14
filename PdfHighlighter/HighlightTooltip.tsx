import React, {
  PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Box } from './types';
import ReactDOM from 'react-dom';
import { usePdf } from '../PdfContext';

type HighlightToolTipProps = {
  isVisible: boolean;
  highlightBox: Box;
  pageNum?: number;
  toolTipClass?: string;
  activeModalRef?: React.MutableRefObject<Element>;
};
export const HighlightTooltip: React.FC<
  PropsWithChildren & HighlightToolTipProps
> = ({
  children,
  isVisible,
  highlightBox,
  pageNum,
  toolTipClass,
  activeModalRef,
}) => {
  const { scrollOffset } = usePdf();
  const toolTipRef = useRef<HTMLDivElement | null>(null);
  const { pageRefs, containerRef } = usePdf();
  const [toolTipH, setToolTipH] = useState(0);
  const [toolTipR, setToolTipR] = useState(0);
  const [isHighlightOob, setIsHighlightOob] = useState(false);
  useEffect(() => {
    calculateTooltipHeight();
  }, [highlightBox, pageNum]);

  const calculateTooltipHeight = () => {
    if (!pageNum) {
      setIsHighlightOob(true);
      return;
    }
    const pageRef = pageRefs.current?.get(pageNum);
    const container = containerRef.current;
    if (!pageRef || !pageRef.isConnected || !container) {
      setIsHighlightOob(true);
      return;
    }
    const pageRect = pageRef.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const pdfPageH = pageRect?.top || 0;
    const toolTipH = toolTipRef.current?.getBoundingClientRect().height || 0;
    const pdfPageL = pageRect?.left || 0;
    const calculatedHeight = pdfPageH + highlightBox.top;
    const isOutOfBounds =
      pageRect.top + highlightBox.bottom < containerRect.top ||
      pageRect.top + highlightBox.top > containerRect.bottom;

    const boundedHeight = Math.max(
      Math.min(calculatedHeight, containerRect.bottom - toolTipH),
      containerRect.top,
    );
    setToolTipH(boundedHeight);
    setToolTipR(window.innerWidth - pdfPageL - highlightBox.left + 10);

    setIsHighlightOob(isOutOfBounds);
  };

  useEffect(() => {
    calculateTooltipHeight();
  }, [scrollOffset]);

  return ReactDOM.createPortal(
    <div
      className={`absolute z-10 ${toolTipClass}`}
      style={{
        top: `${Math.floor(toolTipH)}px`,
        right: `${Math.floor(toolTipR)}px`,
        opacity: isVisible && !isHighlightOob ? '1' : '0',
        pointerEvents: isVisible && !isHighlightOob ? 'all' : 'none',
        transition: `opacity 100ms`,
      }}
      ref={toolTipRef}
    >
      {children}
    </div>,
    activeModalRef?.current
      ? activeModalRef?.current
      : (document.getElementById('root') as Element),
  );
};
