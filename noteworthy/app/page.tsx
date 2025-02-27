"use client";
import { Button, ButtonGroup } from "@heroui/button";
import { Card, CardHeader, CardBody, CardFooter } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { useState, useEffect } from "react";
import Image from "next/image";
import { Spacer } from "@heroui/spacer";
import { Tabs, Tab } from "@heroui/tabs";
import { Tooltip } from "@heroui/tooltip";
import dotenv from "dotenv";
import { ListRestart, Clipboard, ClipboardList } from "lucide-react";
import "@upstash/feedback/index.css";
import { CameraIcon } from "@/components/icons";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import FeedbackWidget from "@upstash/feedback";

dotenv.config();

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

export default function Home() {
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

  const iconClasses =
    "text-xl text-default-500 pointer-events-none flex-shrink-0";

  useEffect(() => {
    if (files.length === 0) {
      setPreviewUrls([]);
      return;
    }
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      setFiles(Array.from(event.dataTransfer.files));
      event.dataTransfer.clearData();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFiles(Array.from(event.target.files));
    }
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

  return (
    <div
      className={`flex ${pdfUrl ? "flex-row" : "flex-col"} items-center justify-start min-h-screen w-[90vw] mx-auto `}
    >
      <Spacer y={4} />
      <div className="container flex flex-col justify-center mx-auto px-4">
        <Spacer y={4} />
        <Tooltip
          showArrow
          defaultOpen
          color="primary"
          content="Rotate Horizonally for Better Viewing"
        >
          <Card
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnter={() => setIsDragging(true)}
            onDragLeave={() => setIsDragging(false)}
            className="w-full max-w-[1000px]"
          >
            <CardHeader className="flex-col gap-3">
              <p className="text-2xl font-bold text-center">
                <b>Convert your Handwritten Notes to PDF</b>
              </p>
              <p className="text-small text-default-500">
                Upload JPEG, PNG, or WEBP files
              </p>
            </CardHeader>
            <Divider />
            <CardBody>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Card className="border-2 border-gray-200 bg-transparent shadow-none w-full">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      width: "100%",
                      height: "100%",
                      zIndex: 1,
                      opacity: 0,
                    }}
                  />
                  <CardBody className="flex flex-row gap-2 justify-center py-8 px-4">
                    <Button
                      as="label"
                      color="primary"
                      className="relative cursor-pointer items-center justify-center gap-2 mr-2"
                      radius="full"
                      variant="solid"
                    >
                      <span>Upload Files</span>
                    </Button>
                    <Button
                      as="label"
                      isIconOnly
                      aria-label="Camera"
                      color="primary"
                      variant="ghost"
                      radius="full"
                      className="relative cursor-pointer"
                    >
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileChange}
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          width: "100%",
                          height: "100%",
                          opacity: 0,
                          pointerEvents: "auto",
                        }}
                      />
                      <CameraIcon />
                    </Button>
                  </CardBody>
                </Card>
                {previewUrls.length > 0 && (
                  <div className="mt-4 flex flex-wrap justify-center gap-4">
                    {previewUrls.map((url, index) => (
                      <Image
                        key={index}
                        src={url}
                        alt={`Preview ${index}`}
                        className="max-h-64 object-contain border rounded shadow-sm"
                        width={100}
                        height={Math.min(
                          100,
                          (url.match(/.*\.(.*)/) || [])[1] === "gif" ? 200 : 300
                        )}
                      />
                    ))}
                  </div>
                )}
                <div className="w-full flex justify-center">
                  <Tabs
                    selectedKey={processType}
                    onSelectionChange={(key) => setProcessType(key as string)}
                    color="primary"
                    variant="bordered"
                  >
                    {tabOptions.map((tab) => (
                      <Tab
                        key={tab.key}
                        title={
                          <Tooltip
                            content={tab.tooltipContent}
                            placement="top"
                            color={
                              processType === tab.key ? "primary" : undefined
                            }
                          >
                            <span>{tab.label}</span>
                          </Tooltip>
                        }
                      />
                    ))}
                  </Tabs>
                </div>
                <div className="flex flex-row gap-4 justify-center">
                  <Button
                    className="w-full max-w-md"
                    type="submit"
                    color="primary"
                    variant="ghost"
                    radius="full"
                    isDisabled={
                      files.length === 0 ||
                      isLoading ||
                      Boolean(
                        pdfMetadata &&
                          pdfMetadata.processType === processType &&
                          pdfMetadata.sourceFiles.length === files.length &&
                          pdfMetadata.sourceFiles.every(
                            (name, i) => files[i].name === name
                          )
                      )
                    }
                    isLoading={isLoading}
                  >
                    Convert to PDF
                  </Button>
                  <Button
                    color="primary"
                    variant="solid"
                    radius="full"
                    onPress={() => {
                      setPdfUrl("");
                      setPdfMetadata(null);
                      setFiles([]);
                      setProcessType("base");
                      setLatexCode("");
                      setFullCode("");
                    }}
                    isDisabled={files.length === 0 || isLoading}
                  >
                    <ListRestart size={25} />
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </Tooltip>
        <Spacer y={4} />
        {fullCode && <Dropdown>
          <DropdownTrigger>
            <Button color="primary" variant="bordered"><b>Get Source</b></Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Dropdown menu with description"
            variant="faded"
          >
            <DropdownItem
              key="new"
              description="Copies a snippet of the Latex code which makes up your notes, can be pasted into existing Latex document"
              shortcut="⌘C"
              startContent={<Clipboard className={iconClasses} />}
              onPress={() => navigator.clipboard.writeText(latexCode)}
            >
              Copy Snippet
            </DropdownItem>
            <DropdownItem
              key="copy"
              description="Copy full Latex Document to clipboard"
              shortcut="⌘⇧C"
              startContent={<ClipboardList className={iconClasses} />}
              onPress={() => navigator.clipboard.writeText(fullCode)}
            >
              Copy Document
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>}
        <FeedbackWidget type="full" />
        <Spacer y={4} />
      </div>

      <Spacer y={4} />
      {pdfUrl === "/sample.pdf" ? (
        <Tooltip
          showArrow
          defaultOpen
          color="primary"
          offset={-40}
          content={
            <span style={{ fontWeight: "bold", fontSize: "1.2rem" }}>
              MAKE YOUR NOTES LOOK LIKE THIS
            </span>
          }
        >
          <div className="mt-8 w-full max-w-4xl">
            <iframe
              src={pdfUrl}
              width="100%"
              height="800"
              title="Generated PDF"
              className="border rounded-md shadow-md"
            />
          </div>
        </Tooltip>
      ) : (
        <div className="mt-8 w-full max-w-4xl">
          <iframe
            src={pdfUrl}
            width="100%"
            height="800"
            title="Generated PDF"
            className="border rounded-md shadow-md"
          />
        </div>
      )}
    </div>
  );
}
