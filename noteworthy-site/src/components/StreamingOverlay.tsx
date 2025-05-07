import { useEffect, useRef } from "react";
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

  // Auto-scroll to bottom when content updates
  useEffect(() => {
    if (contentRef.current && status?.content) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [status?.content]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="relative max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl dark:bg-dark-2">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 dark:border-dark-3">
          <h3 className="flex items-center text-lg font-semibold text-dark dark:text-white">
            {status?.status === "thinking" && (
              <>
                <span className="mr-2">Thinking</span>
                <span className="animate-pulse">...</span>
              </>
            )}
            {status?.status === "processing" && (
              <>
                <span className="mr-2">Generating LaTeX</span>
                <span>{status.progress ? `(${status.progress}%)` : ""}</span>
              </>
            )}
            {status?.status === "complete" && "Generation Complete"}
            {status?.status === "error" && "Error Occurred"}
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
        {status?.status === "processing" && status.progress && (
          <div className="h-2 w-full bg-gray-200 dark:bg-dark-3">
            <div
              className="h-full bg-primary transition-all duration-300 ease-in-out"
              style={{ width: `${status.progress}%` }}
            />
          </div>
        )}

        {/* Content */}
        <div
          ref={contentRef}
          className="max-h-[calc(80vh-8rem)] overflow-y-auto whitespace-pre-wrap p-6 font-mono text-sm"
        >
          {status?.status === "thinking" && (
            <div className="flex h-32 items-center justify-center">
              <div className="flex animate-pulse space-x-2">
                <div className="h-3 w-3 rounded-full bg-primary"></div>
                <div className="h-3 w-3 rounded-full bg-primary"></div>
                <div className="h-3 w-3 rounded-full bg-primary"></div>
              </div>
            </div>
          )}

          {status?.status === "processing" && status.content && (
            <div className="text-dark dark:text-white">{status.content}</div>
          )}

          {status?.status === "complete" && status.content && (
            <div className="text-dark dark:text-white">{status.content}</div>
          )}

          {status?.status === "error" && (
            <div className="text-red-500">
              <p className="mb-2 font-bold">An error occurred:</p>
              <p>{status.error || "Unknown error"}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between border-t p-4 dark:border-dark-3">
          {status?.status === "complete" ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-primary px-4 py-2 text-white hover:bg-primary/90"
            >
              Close
            </button>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {status?.status === "thinking" && "Preparing to process..."}
              {status?.status === "processing" &&
                "Streaming results in real-time..."}
              {status?.status === "error" && "Generation failed."}
            </div>
          )}

          {status?.status !== "error" && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              This may take a minute or two for complex notes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StreamingOverlay;
