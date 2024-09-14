var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import React, { useEffect, useRef } from 'react';
import { TextLayer } from 'pdfjs-dist';
import './style.css';
const Page = ({ pdfDocument, pageNumber, scale }) => {
    const canvasRef = useRef(null);
    const textLayerRef = useRef(null);
    const renderTaskRef = useRef(null); // To track the ongoing render task
    useEffect(() => {
        const renderPage = () => __awaiter(void 0, void 0, void 0, function* () {
            const page = yield pdfDocument.getPage(pageNumber);
            const viewport = page.getViewport({ scale });
            // Render the page to the canvas
            const canvas = canvasRef.current;
            const context = canvas === null || canvas === void 0 ? void 0 : canvas.getContext('2d');
            if (canvas && context) {
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                const renderContext = {
                    canvasContext: context,
                    viewport,
                };
                if (renderTaskRef.current) {
                    renderTaskRef.current.cancel();
                }
                try {
                    renderTaskRef.current = page.render(renderContext);
                    yield renderTaskRef.current.promise; // Await the completion of the render task
                }
                catch (err) {
                    //The task was cancelled by a rerender
                    //do nothing
                }
            }
            // Render the text layer
            const textLayerDiv = textLayerRef.current;
            if (textLayerDiv) {
                textLayerDiv.style.width = `${viewport.width}px`;
                textLayerDiv.style.height = `${viewport.height}px`;
                textLayerDiv.style.setProperty('--scale-factor', scale.toString());
                const textContent = yield page.getTextContent();
                const textLayer = new TextLayer({
                    container: textLayerDiv,
                    textContentSource: textContent,
                    viewport,
                });
                yield textLayer.render();
            }
        });
        renderPage();
        // Cleanup function to cancel the render task if the component unmounts
        return () => {
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }
        };
    }, [pdfDocument, pageNumber, scale]);
    return (React.createElement("div", { style: { position: 'relative', } },
        React.createElement("canvas", { ref: canvasRef }),
        React.createElement("div", { ref: textLayerRef, className: "textLayer" })));
};
export default Page;
