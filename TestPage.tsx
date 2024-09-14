import React, { useEffect, useRef, useState } from "react";
import { PDFDocumentProxy, PDFPageProxy, TextLayer } from "pdfjs-dist";
import "./style.css";
import { usePdf } from "./PdfContext";
import { usePdfHighlighter } from "./PdfHighlighter";

interface PageProps {
  pdfDocument: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  onHighlightLayerRender?: (pageNum: number) => void;
}

const TestPage: React.FC<PageProps> = React.memo(
  ({ pdfDocument, pageNumber, scale, onHighlightLayerRender = () => {} }) => {
    const { pageRefs, highlightLayerRefs, textLayerRefs, getOrCreateTextLayer} = usePdf();
    const {
      onHighlightLayerRender: PdfHighlighterOnHighlightLayerRender,
      onTextLayerRender: PdfHighlighterOnTextLayerRender,
    } = usePdfHighlighter();
    const [isTextLayerLoading, setIsTextLayerLoading] =
      useState<boolean>(false);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const textLayerRef = useRef<HTMLDivElement | null>(null);
    const highlightLayerRef = useRef<HTMLCanvasElement | null>(null);
    const renderCanvasTaskRef = useRef<any | null>(null); // To track the ongoing render task
    const renderTextLayerTaskRef = useRef<any | null>(null)
    const prevScaleRef = useRef<number | null>(null); // To track the previous scale
    // Effect to render the PDF page to the canvas

    useEffect(() => {
      const renderCanvas = async () => {
        const page: PDFPageProxy = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        // Render the page to the canvas
        const canvas = canvasRef.current;
        const highlightLayer = highlightLayerRef.current;

        const canvasCtx = canvas?.getContext("2d");
        const highlightCtx = highlightLayer?.getContext("2d");
        if (canvas && highlightLayer && highlightCtx && canvasCtx) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          highlightLayer.width = viewport.width;
          highlightLayer.height = viewport.height;

          highlightLayerRefs.current?.set(pageNumber, highlightLayer);
          const renderContext = {
            canvasContext: canvasCtx,
            viewport,
          };

          if (renderCanvasTaskRef.current) {
            renderCanvasTaskRef.current.cancel(); // Cancel previous render task
          }
          try {
            renderCanvasTaskRef.current = page.render(renderContext);
            await renderCanvasTaskRef.current.promise; // Await the completion of the render task
          } catch (err) {
            // The task was canceled by a re-render
            // do nothing
          }
          onHighlightLayerRender(pageNumber);
          PdfHighlighterOnHighlightLayerRender(pageNumber);
        }
      };
      renderCanvas();
      // onPageRenderSuccess(pageNumber, highlightLayerRef.current)
      // Cleanup function to cancel the render task if the component unmounts
      return () => {
        if (renderCanvasTaskRef.current) {
          renderCanvasTaskRef.current.cancel();
        }
      };
    }, [pdfDocument, pageNumber, scale]); // Depend only on pdfDocument, pageNumber, and scale for canvas rendering

    useEffect(() => {
      const applyTextLayer = async () => {
        const textLayer = await getOrCreateTextLayer(pageNumber)
        if(textLayer){
          textLayerRef.current?.appendChild(textLayer)
          PdfHighlighterOnTextLayerRender(pageNumber)
        }
      }
      applyTextLayer();
      prevScaleRef.current = scale; // Update the previous scale after rendering
    }, [pdfDocument, pageNumber, scale]); // Depend on pdfDocument, pageNumber, and scale for text layer rendering

    return (
      <div
        className={`PDF__page__container`}
        style={{ position: "relative" }}
        ref={(ref) => {
          if (ref) {
            pageRefs.current?.set(pageNumber, ref);
          }
        }}
      >
        <canvas
          className={`PDF__canvas__layer page__${pageNumber}`}
          ref={canvasRef}
        />
        <div ref={textLayerRef} className="textLayer" />
        <canvas
          className={`PDF__highlight__layer page__${pageNumber}`}
          ref={highlightLayerRef}
        />
        {isTextLayerLoading &&
          <div style={{
            position:'absolute', 
            margin: 'auto', 
            zIndex: 2000,
            width: '100%',
            height: '100%',
            background: 'white'
          }}>
            LOADING
          </div>
        }
      </div>
    );
  }
);

export default TestPage;
