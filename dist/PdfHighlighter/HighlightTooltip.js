import React, { useEffect, useRef, useState, } from "react";
import ReactDOM from "react-dom";
import { usePdf } from "../PdfContext";
export const HighlightTooltip = ({ children, isVisible, highlightBox, pageNum, toolTipClass, activeModalRef }) => {
    const { scrollOffset } = usePdf();
    const toolTipRef = useRef(null);
    const { pageRefs, containerRef } = usePdf();
    const [toolTipH, setToolTipH] = useState(0);
    const [toolTipR, setToolTipR] = useState(0);
    const [isHighlightOob, setIsHighlightOob] = useState(false);
    useEffect(() => {
        calculateTooltipHeight();
    }, [highlightBox, pageNum]);
    const calculateTooltipHeight = () => {
        var _a, _b;
        if (!pageNum)
            return;
        const pageRef = (_a = pageRefs.current) === null || _a === void 0 ? void 0 : _a.get(pageNum);
        const container = containerRef.current;
        if (!pageRef || !container)
            return;
        const pageRect = pageRef.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const pdfPageH = (pageRect === null || pageRect === void 0 ? void 0 : pageRect.top) || 0;
        const toolTipH = ((_b = toolTipRef.current) === null || _b === void 0 ? void 0 : _b.getBoundingClientRect().height) || 0;
        const pdfPageL = (pageRect === null || pageRect === void 0 ? void 0 : pageRect.left) || 0;
        const calculatedHeight = pdfPageH + highlightBox.top;
        const isOutOfBounds = calculatedHeight < (containerRect.top) ||
            calculatedHeight + toolTipH > containerRect.bottom;
        const boundedHeight = Math.max(Math.min(calculatedHeight, containerRect.bottom - toolTipH), containerRect.top);
        setToolTipH(boundedHeight);
        setToolTipR(window.innerWidth - pdfPageL - highlightBox.left + 10);
        setIsHighlightOob(isOutOfBounds);
    };
    useEffect(() => {
        calculateTooltipHeight();
    }, [scrollOffset]);
    return ReactDOM.createPortal(React.createElement("div", { className: `absolute z-10 ${toolTipClass}`, style: {
            top: `${Math.floor(toolTipH)}px`,
            right: `${Math.floor(toolTipR)}px`,
            opacity: isVisible && !isHighlightOob ? "1" : "0",
            pointerEvents: isVisible && !isHighlightOob ? "all" : "none",
            transition: `opacity 100ms`,
        }, ref: toolTipRef }, children), (activeModalRef === null || activeModalRef === void 0 ? void 0 : activeModalRef.current)
        ? activeModalRef === null || activeModalRef === void 0 ? void 0 : activeModalRef.current
        : document.getElementById("root"));
};
