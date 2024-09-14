var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import React, { useEffect, useRef, useState } from "react";
import "./style.css";
import { usePdf } from "./PdfContext";
import { usePdfHighlighter } from "./PdfHighlighter";
const TestPage = React.memo(({ pdfDocument, pageNumber, scale, onHighlightLayerRender = () => { } }) => {
    const { pageRefs, highlightLayerRefs, textLayerRefs, getOrCreateTextLayer } = usePdf();
    const { onHighlightLayerRender: PdfHighlighterOnHighlightLayerRender, onTextLayerRender: PdfHighlighterOnTextLayerRender, } = usePdfHighlighter();
    const [isTextLayerLoading, setIsTextLayerLoading] = useState(false);
    const canvasRef = useRef(null);
    const textLayerRef = useRef(null);
    const highlightLayerRef = useRef(null);
    const renderCanvasTaskRef = useRef(null); // To track the ongoing render task
    const renderTextLayerTaskRef = useRef(null);
    const prevScaleRef = useRef(null); // To track the previous scale
    // Effect to render the PDF page to the canvas
    useEffect(() => {
        const renderCanvas = () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const page = yield pdfDocument.getPage(pageNumber);
            const viewport = page.getViewport({ scale });
            // Render the page to the canvas
            const canvas = canvasRef.current;
            const highlightLayer = highlightLayerRef.current;
            const canvasCtx = canvas === null || canvas === void 0 ? void 0 : canvas.getContext("2d");
            const highlightCtx = highlightLayer === null || highlightLayer === void 0 ? void 0 : highlightLayer.getContext("2d");
            if (canvas && highlightLayer && highlightCtx && canvasCtx) {
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                highlightLayer.width = viewport.width;
                highlightLayer.height = viewport.height;
                (_a = highlightLayerRefs.current) === null || _a === void 0 ? void 0 : _a.set(pageNumber, highlightLayer);
                const renderContext = {
                    canvasContext: canvasCtx,
                    viewport,
                };
                if (renderCanvasTaskRef.current) {
                    renderCanvasTaskRef.current.cancel(); // Cancel previous render task
                }
                try {
                    renderCanvasTaskRef.current = page.render(renderContext);
                    yield renderCanvasTaskRef.current.promise; // Await the completion of the render task
                }
                catch (err) {
                    // The task was canceled by a re-render
                    // do nothing
                }
                onHighlightLayerRender(pageNumber);
                PdfHighlighterOnHighlightLayerRender(pageNumber);
            }
        });
        renderCanvas();
        // onPageRenderSuccess(pageNumber, highlightLayerRef.current)
        // Cleanup function to cancel the render task if the component unmounts
        return () => {
            if (renderCanvasTaskRef.current) {
                renderCanvasTaskRef.current.cancel();
            }
        };
    }, [pdfDocument, pageNumber, scale]); // Depend only on pdfDocument, pageNumber, and scale for canvas rendering
    // Effect to render the text layer, ensuring it renders at least once
    useEffect(() => {
        const applyTextLayer = () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const textLayer = yield getOrCreateTextLayer(pageNumber);
            if (textLayer) {
                (_a = textLayerRef.current) === null || _a === void 0 ? void 0 : _a.appendChild(textLayer);
                PdfHighlighterOnTextLayerRender(pageNumber);
            }
        });
        applyTextLayer();
        prevScaleRef.current = scale; // Update the previous scale after rendering
    }, [pdfDocument, pageNumber, scale]); // Depend on pdfDocument, pageNumber, and scale for text layer rendering
    return (React.createElement("div", { className: `PDF__page__container`, style: { position: "relative" }, ref: (ref) => {
            var _a;
            if (ref) {
                (_a = pageRefs.current) === null || _a === void 0 ? void 0 : _a.set(pageNumber, ref);
            }
        } },
        React.createElement("canvas", { className: `PDF__canvas__layer page__${pageNumber}`, ref: canvasRef }),
        React.createElement("div", { ref: textLayerRef, className: "textLayer" }),
        React.createElement("canvas", { className: `PDF__highlight__layer page__${pageNumber}`, ref: highlightLayerRef }),
        isTextLayerLoading &&
            React.createElement("div", { style: {
                    position: 'absolute',
                    margin: 'auto',
                    zIndex: 2000,
                    width: '100%',
                    height: '100%',
                    background: 'white'
                } }, "LOADING")));
});
export default TestPage;
