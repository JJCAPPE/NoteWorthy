"use client";import React, { useState, useEffect } from "react";
import Image from "next/image";
import { CameraIcon, Clipboard, ClipboardList, ListRestart } from "lucide-react";

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
}

const Convert = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [pdfUrl, setPdfUrl] = useState("/sample.pdf");
  const [pdfMetadata, setPdfMetadata] = useState<PdfMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [processType, setProcessType] = useState("base");
  const [latexCode, setLatexCode] = useState("");
  const [fullCode, setFullCode] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

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
      if (event.shiftKey && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "e") {
        if (fullCode) {
          event.preventDefault();
          copyToClipboard(fullCode);
        }
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "e") {
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
    navigator.clipboard.writeText(code)
      .then(() => alert("Copied to clipboard!"))
      .catch(err => console.error("Failed to copy:", err));
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
        setMessage(`LaTeX Error: ${errorData.error}`);
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
        console.error("PDF Error:", errorData.error, errorData.details);
        setMessage(`PDF Error: ${errorData.error}`);
        return;
      }

      const blob = await pdfResponse.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setPdfMetadata({
        sourceFiles: files.map((f) => f.name),
        processType,
        timestamp: Date.now(),
      });
      setMessage("PDF generated successfully.");
    } catch (error) {
      console.error("Error:", error);
      setMessage("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const disableConversion = files.length === 0 || 
    isLoading || 
    Boolean(
      pdfMetadata &&
      pdfMetadata.processType === processType &&
      pdfMetadata.sourceFiles.length === files.length &&
      pdfMetadata.sourceFiles.every(
        (name, i) => files[i].name === name
      )
    );
  
  const resetForm = () => {
    setPdfUrl("");
    setPdfMetadata(null);
    setFiles([]);
    setProcessType("base");
    setLatexCode("");
    setFullCode("");
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
                <span className="mb-4 block text-base font-medium text-primary">
                  CONVERT YOUR NOTES
                </span>
                <h2 className="text-[32px] font-bold leading-tight text-dark dark:text-white sm:text-[40px] md:text-[44px]">
                  Handwritten Notes to PDF
                </h2>
                <p className="mt-4 max-w-[600px] mx-auto text-base text-body-color dark:text-dark-6">
                  Upload your handwritten notes and convert them into professional PDF documents with our AI-powered tool.
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
                  <div className="border-2 border-dashed border-[#f1f1f1] dark:border-dark-3 rounded-md p-8 text-center">
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
                        className="inline-flex items-center justify-center rounded-md bg-primary px-10 py-3 text-base font-medium text-white transition duration-300 ease-in-out hover:bg-primary/90 cursor-pointer"
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
                        <div key={index} className="relative border rounded shadow-sm overflow-hidden">
                          <Image
                            src={url}
                            alt={`Preview ${index}`}
                            className="max-h-64 object-contain"
                            width={100}
                            height={Math.min(
                              100,
                              (url.match(/.*\.(.*)/) || [])[1] === "gif" ? 200 : 300
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="w-full flex justify-center border-b border-[#f1f1f1] dark:border-dark-3 mb-6">
                    <div className="flex">
                      {tabOptions.map((tab) => (
                        <div key={tab.key} className="relative">
                          <button
                            type="button"
                            className={`px-6 py-3 text-base font-medium ${
                              processType === tab.key
                                ? "text-primary border-b-2 border-primary"
                                : "text-body-color dark:text-dark-6 hover:text-primary"
                            }`}
                            onClick={() => setProcessType(tab.key)}
                            onMouseEnter={() => setActiveTooltip(tab.key)}
                            onMouseLeave={() => setActiveTooltip(null)}
                          >
                            {tab.label}
                          </button>
                          
                          {activeTooltip === tab.key && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-dark text-white text-xs rounded whitespace-nowrap">
                              {tab.tooltipContent}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-solid border-t-dark border-t-4 border-x-transparent border-x-4 border-b-0"></div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex flex-row gap-4 justify-center">
                    <div className="relative">
                      <button
                        type="submit"
                        className={`inline-flex items-center justify-center rounded-md bg-primary px-10 py-3 text-base font-medium text-white transition duration-300 ease-in-out ${
                          disableConversion
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-primary/90 cursor-pointer"
                        }`}
                        disabled={disableConversion}
                        onMouseEnter={() => setActiveTooltip("convert")}
                        onMouseLeave={() => setActiveTooltip(null)}
                      >
                        {isLoading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Converting...
                          </>
                        ) : (
                          "Convert to PDF"
                        )}
                      </button>
                      
                      {activeTooltip === "convert" && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-dark text-white text-xs rounded whitespace-nowrap min-w-[400px] text-center">
                          This may take up to a minute, depending on your document length
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-solid border-t-dark border-t-4 border-x-transparent border-x-4 border-b-0"></div>
                        </div>
                      )}
                    </div>
                    
                    <button
                      type="button"
                      className={`inline-flex items-center justify-center rounded-md px-5 py-3 text-base font-medium text-primary bg-transparent border border-primary transition duration-300 ease-in-out ${
                        files.length === 0 || isLoading
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-primary/10 cursor-pointer"
                      }`}
                      onClick={resetForm}
                      disabled={files.length === 0 || isLoading}
                    >
                      <ListRestart size={20} />
                    </button>
                  </div>
                  
                  {fullCode && (
                    <div className="mt-6 flex justify-center">
                      <div className="relative">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-md border border-primary bg-transparent px-6 py-3 text-base font-medium text-primary hover:bg-primary/10 transition duration-300 ease-in-out"
                          onClick={() => setDropdownOpen(!dropdownOpen)}
                        >
                          Get Source
                        </button>
                        
                        {dropdownOpen && (
                          <div className="absolute top-full left-0 mt-2 w-64 rounded-md bg-white shadow-lg dark:bg-dark-2 z-10">
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
                                  <div className="font-medium">Copy Snippet</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Copies a snippet of the Latex code which makes up your notes
                                  </div>
                                </div>
                                <span className="ml-auto text-xs text-gray-500">⌘E</span>
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
                                  <div className="font-medium">Copy Document</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Copy full Latex Document to clipboard
                                  </div>
                                </div>
                                <span className="ml-auto text-xs text-gray-500">⌘⇧E</span>
                              </button>
                            </div>
                          </div>
                        )}
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
                    <span className="inline-block py-2 px-6 bg-primary text-white text-sm font-medium rounded-md">
                      SAMPLE OUTPUT
                    </span>
                  </div>
                  <iframe
                    src={pdfUrl}
                    width="100%"
                    height="800"
                    title="Generated PDF"
                    className="border rounded-lg shadow-lg dark:border-dark-3"
                  />
                </div>
              ) : (
                <div className="relative">
                  <div className="mb-4 text-center">
                    <span className="inline-block py-2 px-6 bg-primary text-white text-sm font-medium rounded-md">
                      YOUR PDF DOCUMENT
                    </span>
                  </div>
                  <iframe
                    src={pdfUrl}
                    width="100%"
                    height="800"
                    title="Generated PDF"
                    className="border rounded-lg shadow-lg dark:border-dark-3"
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