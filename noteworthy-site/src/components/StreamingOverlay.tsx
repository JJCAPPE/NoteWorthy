import { useEffect, useRef, useState } from "react";
import { LatexGenerationStatus } from "@/lib/websocket";

interface StreamingOverlayProps {
  status: LatexGenerationStatus | null;
  onClose?: () => void;
  visible: boolean;
}

const StreamingOverlay: React.FC<StreamingOverlayProps> = ({
  status,
  onClose,
  visible,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [internalStatus, setInternalStatus] =
    useState<LatexGenerationStatus | null>(status);

  // Use the most recent status (from props or internal)
  const currentStatus = internalStatus || status;

  // Listen for custom status updates
  useEffect(() => {
    const handleStatusUpdate = (event: CustomEvent<LatexGenerationStatus>) => {
      setInternalStatus(event.detail);
    };

    const element = document.querySelector("[data-status-handler]");
    if (element) {
      element.addEventListener(
        "statusUpdate",
        handleStatusUpdate as EventListener,
      );
    }

    return () => {
      if (element) {
        element.removeEventListener(
          "statusUpdate",
          handleStatusUpdate as EventListener,
        );
      }
    };
  }, []);

  // Update internal status when props change
  useEffect(() => {
    if (status) {
      setInternalStatus(status);
    }
  }, [status]);

  // Auto-scroll to bottom when content updates
  useEffect(() => {
    if (contentRef.current && currentStatus?.content) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [currentStatus?.content]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      data-status-handler
    >
      <div className="relative max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl dark:bg-dark-2">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 dark:border-dark-3">
          <h3 className="flex items-center text-lg font-semibold text-dark dark:text-white">
            {currentStatus?.status === "thinking" && (
              <>
                <span className="mr-2">Thinking</span>
                <span className="animate-pulse">...</span>
              </>
            )}
            {currentStatus?.status === "processing" && (
              <>
                <span className="mr-2">Generating LaTeX</span>
                <span>
                  {currentStatus.progress ? `(${currentStatus.progress}%)` : ""}
                </span>
              </>
            )}
            {currentStatus?.status === "processing_pdf" && (
              <>
                <span className="mr-2">Processing PDF</span>
                <span>
                  {currentStatus.progress ? `(${currentStatus.progress}%)` : ""}
                </span>
              </>
            )}
            {currentStatus?.status === "complete" && "Generation Complete"}
            {currentStatus?.status === "compiling" && (
              <>
                <span className="mr-2">Compiling PDF</span>
                <span className="animate-pulse">...</span>
              </>
            )}
            {currentStatus?.status === "error" && "Error Occurred"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        {(currentStatus?.status === "processing" ||
          currentStatus?.status === "processing_pdf") &&
          currentStatus.progress && (
            <div className="h-2 w-full bg-gray-200 dark:bg-dark-3">
              <div
                className="h-full bg-primary transition-all duration-300 ease-in-out"
                style={{ width: `${currentStatus.progress}%` }}
              />
            </div>
          )}

        {/* Indeterminate progress bar for compiling */}
        {currentStatus?.status === "compiling" && (
          <div className="h-2 w-full overflow-hidden bg-gray-200 dark:bg-dark-3">
            <div
              className="h-full animate-pulse bg-primary"
              style={{ width: "100%" }}
            ></div>
          </div>
        )}

        {/* Content */}
        <div
          ref={contentRef}
          className="max-h-[calc(80vh-8rem)] overflow-y-auto whitespace-pre-wrap p-6 font-mono text-sm"
        >
          {currentStatus?.status === "thinking" && (
            <div className="flex h-32 items-center justify-center">
              <div className="flex animate-pulse space-x-2">
                <div className="h-3 w-3 rounded-full bg-primary"></div>
                <div className="h-3 w-3 rounded-full bg-primary"></div>
                <div className="h-3 w-3 rounded-full bg-primary"></div>
              </div>
            </div>
          )}

          {currentStatus?.status === "processing_pdf" && (
            <div className="text-dark dark:text-white">
              <div className="mb-4 text-center">
                <p className="mb-2">Processing PDF document...</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {currentStatus.content ||
                    "Uploading PDF to processing service..."}
                </p>
              </div>
              <div className="flex h-32 items-center justify-center">
                <div className="flex animate-pulse space-x-2">
                  <div className="h-3 w-3 rounded-full bg-primary"></div>
                  <div className="h-3 w-3 rounded-full bg-primary"></div>
                  <div className="h-3 w-3 rounded-full bg-primary"></div>
                </div>
              </div>
            </div>
          )}

          {currentStatus?.status === "processing" && currentStatus.content && (
            <div className="text-dark dark:text-white">
              {currentStatus.content}
            </div>
          )}

          {currentStatus?.status === "complete" && currentStatus.content && (
            <div className="text-dark dark:text-white">
              {currentStatus.content}
            </div>
          )}

          {currentStatus?.status === "compiling" && (
            <div className="text-dark dark:text-white">
              <p className="text-center">Creating your PDF document...</p>
              <div className="mt-4 flex h-32 items-center justify-center">
                <div className="flex animate-pulse space-x-2">
                  <div className="h-3 w-3 rounded-full bg-primary"></div>
                  <div className="h-3 w-3 rounded-full bg-primary"></div>
                  <div className="h-3 w-3 rounded-full bg-primary"></div>
                </div>
              </div>
            </div>
          )}

          {currentStatus?.status === "error" && (
            <div className="text-red-500">
              <p className="mb-2 font-bold">An error occurred:</p>
              <p>{currentStatus.error || "Unknown error"}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between border-t p-4 dark:border-dark-3">
          {currentStatus?.status === "complete" ||
          currentStatus?.status === "compiling" ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-primary px-4 py-2 text-white hover:bg-primary/90"
            >
              Close
            </button>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {currentStatus?.status === "thinking" &&
                "Preparing to process..."}
              {currentStatus?.status === "processing_pdf" &&
                "Processing PDF document..."}
              {currentStatus?.status === "processing" &&
                "Streaming results in real-time..."}
              {currentStatus?.status === "error" && "Generation failed."}
            </div>
          )}

          {currentStatus?.status !== "error" && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {currentStatus?.status === "compiling"
                ? "This may take a few seconds..."
                : currentStatus?.status === "processing_pdf"
                  ? "PDF processing may take several minutes..."
                  : "This may take a minute or two for complex notes."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StreamingOverlay;
