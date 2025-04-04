"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  CameraIcon,
  Clipboard,
  ClipboardList,
  ListRestart,
  Save,
} from "lucide-react";
import toast from "react-hot-toast";

const tabOptions = [
  {
    key: "summary",
    label: "Summary",
    tooltipContent: "Makes a concise revision sheet like transcription",
  },
  {
    key: "base",
    label: "Base",
    tooltipContent: "Makes a full transcription, including diagrams",
  },
  {
    key: "expansion",
    label: "Expansion",
    tooltipContent: "Makes extended study notes for each concept",
  },
];

interface PdfMetadata {
  sourceFiles: string[]; // File names of source images
  processType: string; // Type of processing used
  timestamp: number; // When the PDF was generated
  prompt: string; // Custom prompt used
}

const Convert = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [pdfUrl, setPdfUrl] = useState("/sample.pdf");
  const [pdfMetadata, setPdfMetadata] = useState<PdfMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [processType, setProcessType] = useState("base");
  const [latexCode, setLatexCode] = useState("");
  const [fullCode, setFullCode] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [pdfTitle, setPdfTitle] = useState("");
  const [savingPdf, setSavingPdf] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (files.length === 0) {
      setPreviewUrls([]);
      return;
    }
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (
        event.shiftKey &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "e"
      ) {
        if (fullCode) {
          event.preventDefault();
          copyToClipboard(fullCode);
        }
      } else if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "e"
      ) {
        if (latexCode) {
          event.preventDefault();
          copyToClipboard(latexCode);
        }
      }
    };
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [fullCode, latexCode]);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      setFiles(Array.from(event.dataTransfer.files));
      event.dataTransfer.clearData();
    }
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFiles(Array.from(event.target.files));
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        toast.success("Copied to clipboard!");
      })
      .catch(() => {
        toast.error("Failed to copy to clipboard");
      });
  };

  async function fetchComposedLatex(latexCode: string): Promise<string | ""> {
    try {
      const response = await fetch("/api/latex/compose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ latexCode }),
      });

      if (!response.ok) {
        console.error("Failed to fetch composed LaTeX:", response.statusText);
        return "null";
      }

      const data = await response.json();
      return data.finalLatex;
    } catch (error) {
      console.error("Error calling /api/latex/compose:", error);
      return "null";
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (files.length === 0) return;
    setIsLoading(true);

    try {
      // Step 1: Generate LaTeX
      const latexFormData = new FormData();
      files.forEach((file) => latexFormData.append("noteImage", file));
      latexFormData.append("processType", processType);

      const latexResponse = await fetch("/api/latex/generate", {
        method: "POST",
        body: latexFormData,
      });

      if (!latexResponse.ok) {
        const errorData = await latexResponse.json();
        console.error("LaTeX Error:", errorData.error, errorData.details);
        return;
      }

      const { cleanedLatex } = await latexResponse.json();

      setLatexCode(cleanedLatex);

      const fullLatex = await fetchComposedLatex(cleanedLatex);

      setFullCode(fullLatex);

      // Step 2: Generate PDF using JSON
      const pdfResponse = await fetch("/api/generatePdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latexCode: fullLatex }),
      });

      if (!pdfResponse.ok) {
        const errorData = await pdfResponse.json();
        console.error(
          "PDF_COMPILATION_ERROR:",
          errorData.error,
          errorData.details,
        );
        setPdfUrl("/error.pdf");
        return;
      }

      const blob = await pdfResponse.blob();
      setPdfBlob(blob); // Store the blob for saving later
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setPdfMetadata({
        sourceFiles: files.map((f) => f.name),
        processType,
        timestamp: Date.now(),
        prompt: customPrompt,
      });
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePdf = async () => {
    if (!pdfBlob || !pdfTitle.trim()) {
      toast.error("Please enter a title for the PDF");
      return;
    }

    if (!pdfBlob) {
      toast.error("No PDF content available to save");
      return;
    }

    setSavingPdf(true);
    try {
      const formData = new FormData();
      formData.append('title', pdfTitle);
      formData.append('pdf', pdfBlob);
      formData.append('processType', pdfMetadata?.processType || 'base');
      formData.append('sourceFiles', JSON.stringify(pdfMetadata?.sourceFiles || []));
      formData.append('prompt', pdfMetadata?.prompt || '');
      
      const response = await fetch('/api/pdf/save', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Failed to save PDF");
      }

      toast.success("PDF saved successfully!");
      setShowSaveDialog(false);
      setPdfTitle("");
    } catch (error) {
      console.error("Error saving PDF:", error);
      toast.error("Failed to save PDF");
    } finally {
      setSavingPdf(false);
    }
  };

  const disableConversion =
    files.length === 0 ||
    isLoading ||
    Boolean(
      pdfMetadata &&
      pdfMetadata.processType === processType &&
      pdfMetadata.sourceFiles.length === files.length &&
      pdfMetadata.prompt === customPrompt &&
        pdfMetadata.sourceFiles.every((name, i) => files[i].name === name),
    );

  const resetForm = () => {
    setPdfUrl("/sample.pdf");
    setPdfMetadata(null);
    setFiles([]);
    setProcessType("base");
    setLatexCode("");
    setFullCode("");
    setCustomPrompt("");
    setPreviewUrls([]);
    setIsLoading(false);
  };

  return (
    <section id="handwritten-notes" className="relative py-20 md:py-[120px]">
      <div className="absolute left-0 top-0 -z-[1] h-full w-full dark:bg-dark"></div>
      <div className="absolute left-0 top-0 -z-[1] h-1/2 w-full bg-[#E9F9FF] dark:bg-dark-700 lg:h-[45%] xl:h-1/2"></div>
      <div className="container px-4">
        <div className="-mx-4 flex flex-wrap items-start justify-center">
          <div className="w-full px-4 lg:w-7/12 xl:w-6/12">
            <div className="wow fadeInUp mb-12 lg:mb-0" data-wow-delay=".15s">
              <div className="mb-10 text-center">
                <span className="mb-2 block text-base font-medium text-primary">
                  CONVERT YOUR HANDWRITTEN NOTES
                </span>
                <h2 className="text-[32px] font-bold leading-tight text-dark dark:text-white sm:text-[40px] md:text-[44px]">
                   Notes to PDF
                </h2>
                <p className="mx-auto mt-4 max-w-[600px] text-base text-body-color dark:text-dark-6">
                  Upload your handwritten notes and convert them into
                  professional PDF documents with our AI-powered tool.
                </p>
              </div>

              <div
                className={`wow fadeInUp rounded-lg bg-white p-8 shadow-testimonial dark:bg-dark-2 dark:shadow-none ${
                  isDragging ? "border-2 border-primary" : ""
                }`}
                data-wow-delay=".2s"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
              >
                <div className="flex items-center justify-center">
                  <h3 className="mb-8 text-2xl font-semibold text-dark dark:text-white">
                    Upload Your Notes
                  </h3>
                </div>
                <p className="mb-6 text-center text-base text-body-color dark:text-dark-6">
                  Upload JPEG, PNG, or WEBP files
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                  <div className="rounded-md border-2 border-dashed border-[#f1f1f1] p-8 text-center dark:border-dark-3">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-upload"
                    />
                    <div className="flex flex-col items-center justify-center gap-4">
                      <label
                        htmlFor="file-upload"
                        className="inline-flex cursor-pointer items-center justify-center rounded-md bg-primary px-10 py-3 text-base font-medium text-white transition duration-300 ease-in-out hover:bg-primary/90"
                      >
                        Upload Files
                      </label>

                      <p className="text-sm text-body-color dark:text-dark-6">
                        Drag and drop your files here or click to browse
                      </p>
                    </div>
                  </div>

                  {previewUrls.length > 0 && (
                    <div className="mt-4 flex flex-wrap justify-center gap-4">
                      {previewUrls.map((url, index) => (
                        <div
                          key={index}
                          className="relative overflow-hidden rounded border shadow-sm"
                        >
                          <Image
                            src={url}
                            alt={`Preview ${index}`}
                            className="max-h-64 object-contain"
                            width={100}
                            height={Math.min(
                              100,
                              (url.match(/.*\.(.*)/) || [])[1] === "gif"
                                ? 200
                                : 300,
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mb-2 flex w-full justify-center border-b border-[#f1f1f1] dark:border-dark-3">
                    <div className="flex">
                      {tabOptions.map((tab) => (
                        <div key={tab.key} className="relative">
                          <button
                            type="button"
                            className={`px-6 py-3 text-base font-medium ${
                              processType === tab.key
                                ? "border-b-2 border-primary text-primary"
                                : "text-body-color hover:text-primary dark:text-dark-6"
                            }`}
                            onClick={() => setProcessType(tab.key)}
                            onMouseEnter={() => setActiveTooltip(tab.key)}
                            onMouseLeave={() => setActiveTooltip(null)}
                          >
                            {tab.label}
                          </button>
                          {activeTooltip === tab.key && (
                            <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 transform whitespace-nowrap rounded bg-dark px-3 py-1 text-xs text-white">
                              {tab.tooltipContent}
                              <div className="absolute left-1/2 top-full -translate-x-1/2 transform border-x-4 border-b-0 border-t-4 border-solid border-x-transparent border-t-dark"></div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mb-2 flex w-full justify-center">
                    <textarea
                      value={customPrompt}
                      onChange={(e) => {
                        setCustomPrompt(e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = e.target.scrollHeight + "px";
                      }}
                      placeholder="Add custom instructions (optional)"
                      className="min-h-[48px] w-full max-w-md resize-none overflow-hidden rounded-lg border border-[#f1f1f1] bg-transparent px-4 py-3 text-body-color focus:outline-none focus:ring-2 focus:ring-primary dark:border-dark-3 dark:text-dark-6"
                      rows={1}
                    />
                  </div>
                  <div className="flex flex-row justify-center gap-4">
                    <div className="relative">
                      <button
                        type="submit"
                        className={`inline-flex items-center justify-center rounded-md bg-primary px-10 py-3 text-base font-medium text-white transition duration-300 ease-in-out ${
                          disableConversion
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer hover:bg-primary/90"
                        }`}
                        disabled={disableConversion}
                        onMouseEnter={() => setActiveTooltip("convert")}
                        onMouseLeave={() => setActiveTooltip(null)}
                      >
                        {isLoading ? (
                          <>
                            <svg
                              className="-ml-1 mr-3 h-5 w-5 animate-spin text-white"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            Converting...
                          </>
                        ) : (
                          "Convert to PDF"
                        )}
                      </button>

                      {activeTooltip === "convert" && (
                        <div className="absolute bottom-full left-1/2 mb-2 min-w-[400px] -translate-x-1/2 transform whitespace-nowrap rounded bg-dark px-3 py-1 text-center text-xs text-white">
                          This may take up to a minute, depending on your
                          document length
                          <div className="absolute left-1/2 top-full -translate-x-1/2 transform border-x-4 border-b-0 border-t-4 border-solid border-x-transparent border-t-dark"></div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className={`inline-flex items-center justify-center rounded-md border border-primary bg-transparent px-5 py-3 text-base font-medium text-primary transition duration-300 ease-in-out ${
                        files.length === 0 || isLoading
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer hover:bg-primary/10"
                      }`}
                      onClick={resetForm}
                      disabled={files.length === 0 || isLoading}
                    >
                      <ListRestart size={20} />
                    </button>
                  </div>

                  <div className="mt-6 flex justify-center space-x-4">
                    <button
                      type="button"
                      className={`inline-flex items-center justify-center rounded-md px-10 py-3 text-base font-medium transition duration-300 ease-in-out ${
                        pdfUrl !== "/sample.pdf" && pdfBlob
                          ? "bg-primary text-white hover:bg-primary/90"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400"
                      }`}
                      onClick={() => setShowSaveDialog(true)}
                      disabled={!(pdfUrl !== "/sample.pdf" && pdfBlob)}
                    >
                      <Save className="mr-2 h-5 w-5" />
                      Save PDF
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        className={`inline-flex items-center justify-center rounded-md px-6 py-3 text-base font-medium transition duration-300 ease-in-out ${
                          fullCode
                            ? "border border-primary bg-transparent text-primary hover:bg-primary/10"
                            : "border border-gray-300 bg-transparent text-gray-500 cursor-not-allowed dark:border-gray-700 dark:text-gray-400"
                        }`}
                        onClick={() => fullCode && setDropdownOpen(!dropdownOpen)}
                        disabled={!fullCode}
                      >
                        Get Source
                      </button>

                      {dropdownOpen && fullCode && (
                        <div className="absolute left-0 top-full z-10 mt-2 w-64 rounded-md bg-white shadow-lg dark:bg-dark-2">
                          <div className="py-1">
                            <button
                              type="button"
                              className="flex w-full items-center px-4 py-3 text-left text-sm hover:bg-gray-100 dark:hover:bg-dark-3"
                              onClick={() => {
                                copyToClipboard(latexCode);
                                setDropdownOpen(false);
                              }}
                            >
                              <Clipboard className="mr-3 h-5 w-5 text-gray-500" />
                              <div>
                                <div className="font-medium">
                                  Copy Snippet
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Copies a snippet of the Latex code which
                                  makes up your notes
                                </div>
                              </div>
                              <span className="ml-auto text-xs text-gray-500">
                                ⌘E
                              </span>
                            </button>

                            <button
                              type="button"
                              className="flex w-full items-center px-4 py-3 text-left text-sm hover:bg-gray-100 dark:hover:bg-dark-3"
                              onClick={() => {
                                copyToClipboard(fullCode);
                                setDropdownOpen(false);
                              }}
                            >
                              <ClipboardList className="mr-3 h-5 w-5 text-gray-500" />
                              <div>
                                <div className="font-medium">
                                  Copy Document
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Copy full Latex Document to clipboard
                                </div>
                              </div>
                              <span className="ml-auto text-xs text-gray-500">
                                ⌘⇧E
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Save PDF Dialog */}
                  {showSaveDialog && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-dark-2">
                        <h3 className="mb-4 text-xl font-semibold text-dark dark:text-white">
                          Save PDF
                        </h3>
                        <div className="mb-4">
                          <label
                            htmlFor="pdf-title"
                            className="mb-2 block text-sm font-medium text-dark dark:text-white"
                          >
                            Enter a title for your PDF
                          </label>
                          <input
                            id="pdf-title"
                            type="text"
                            value={pdfTitle}
                            onChange={(e) => setPdfTitle(e.target.value)}
                            className="w-full rounded-md border border-[#f1f1f1] bg-transparent px-4 py-2 text-body-color focus:outline-none focus:ring-2 focus:ring-primary dark:border-dark-3 dark:text-dark-6"
                            placeholder="e.g., Math Notes - Calculus I"
                            autoFocus
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-md border border-primary bg-transparent px-4 py-2 text-sm font-medium text-primary transition duration-300 ease-in-out hover:bg-primary/10"
                            onClick={() => {
                              setShowSaveDialog(false);
                              setPdfTitle("");
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className={`inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition duration-300 ease-in-out ${
                              !pdfTitle.trim() || savingPdf
                                ? "cursor-not-allowed opacity-50"
                                : "cursor-pointer hover:bg-primary/90"
                            }`}
                            onClick={handleSavePdf}
                            disabled={!pdfTitle.trim() || savingPdf}
                          >
                            {savingPdf ? (
                              <>
                                <svg
                                  className="-ml-1 mr-2 h-4 w-4 animate-spin text-white"
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  ></circle>
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  ></path>
                                </svg>
                                Saving...
                              </>
                            ) : (
                              "Save"
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>

          <div className="w-full px-4 lg:w-5/12 xl:w-6/12">
            <div className="wow fadeInUp" data-wow-delay=".2s">
              {pdfUrl === "/sample.pdf" ? (
                <div className="relative">
                  <div className="mb-4 text-center">
                    <span className="inline-block rounded-md bg-primary px-6 py-2 text-sm font-medium text-white">
                      SAMPLE OUTPUT
                    </span>
                  </div>
                  <iframe
                    src={pdfUrl}
                    width="100%"
                    height="800"
                    title="Generated PDF"
                    className="rounded-lg border shadow-lg dark:border-dark-3"
                  />
                </div>
              ) : (
                <div className="relative">
                  <div className="mb-4 text-center">
                    <span className="inline-block rounded-md bg-primary px-6 py-2 text-sm font-medium text-white">
                      YOUR PDF DOCUMENT
                    </span>
                  </div>
                  <iframe
                    src={pdfUrl}
                    width="100%"
                    height="800"
                    title="Generated PDF"
                    className="rounded-lg border shadow-lg dark:border-dark-3"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Convert;
