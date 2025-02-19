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

dotenv.config();
const apiBase = "http://localhost:3001";

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

const CameraIcon = ({
  fill,
  size,
  height,
  width,
  ...props
}: {
  fill?: string;
  size?: number;
  height?: number;
  width?: number;
  [key: string]: any;
}) => {
  fill = fill || "currentColor";
  return (
    <svg
      fill="none"
      height={size || height || 24}
      viewBox="0 0 24 24"
      width={size || width || 24}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        clipRule="evenodd"
        d="M17.44 6.236c.04.07.11.12.2.12 2.4 0 4.36 1.958 4.36 4.355v5.934A4.368 4.368 0 0117.64 21H6.36A4.361 4.361 0 012 16.645V10.71a4.361 4.361 0 014.36-4.355c.08 0 .16-.04.19-.12l.06-.12.106-.222a97.79 97.79 0 01.714-1.486C7.89 3.51 8.67 3.01 9.64 3h4.71c.97.01 1.76.51 2.22 1.408.157.315.397.822.629 1.31l.141.299.1.22zm-.73 3.836c0 .5.4.9.9.9s.91-.4.91-.9-.41-.909-.91-.909-.9.41-.9.91zm-6.44 1.548c.47-.47 1.08-.719 1.73-.719.65 0 1.26.25 1.72.71.46.459.71 1.068.71 1.717A2.438 2.438 0 0112 15.756c-.65 0-1.26-.25-1.72-.71a2.408 2.408 0 01-.71-1.717v-.01c-.01-.63.24-1.24.7-1.699zm4.5 4.485a3.91 3.91 0 01-2.77 1.15 3.921 3.921 0 01-3.93-3.926 3.865 3.865 0 011.14-2.767A3.921 3.921 0 0112 9.402c1.05 0 2.04.41 2.78 1.15.74.749 1.15 1.738 1.15 2.777a3.958 3.958 0 01-1.16 2.776z"
        fill={fill}
        fillRule="evenodd"
      />
    </svg>
  );
};

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [processType, setProcessType] = useState("base");

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (files.length === 0) return;
    setIsLoading(true);
    const formData = new FormData();
    files.forEach((file) => formData.append("noteImage", file));
    formData.append("processType", processType);

    try {
      const response = await fetch(`/api/upload`, {
        method: "POST",
        body: formData,
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setMessage("PDF generated and displayed below.");
    } catch (error) {
      console.error("Error uploading files:", error);
      setMessage("Error uploading files");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen">
      <Spacer y={4} />
      <div className="flex justify-center">
        <Spacer y={4} />
        <Card
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnter={() => setIsDragging(true)}
          onDragLeave={() => setIsDragging(false)}
          className="w-full max-w-[1000px]"
        >
          <CardHeader className="flex gap-3">
            <h1 className="text-2xl font-extrabold text-center">
              Convert your Handwritten Notes to PDF
            </h1>
          </CardHeader>
          <Divider />
          <CardBody>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Card className="border-2 border-gray-200 bg-transparent shadow-none w-full">
                <CardBody className="flex flex-row gap-2 justify-center py-8 px-4">
                  <Button
                    as="label"
                    color="primary"
                    className="relative cursor-pointer items-center justify-center gap-2 mr-2"
                    radius="full"
                    variant="shadow"
                  >
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
                        opacity: 0,
                        pointerEvents: "auto",
                      }}
                    />
                    <span>Upload Notes</span>
                  </Button>
                  <Button
                    as="label"
                    isIconOnly
                    aria-label="Camera"
                    color="primary"
                    variant="shadow"
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
                  color="warning"
                >
                  {tabOptions.map((tab) => (
                    <Tab
                      key={tab.key}
                      title={
                        <Tooltip
                          content={tab.tooltipContent}
                          placement="top"
                          color={
                            processType === tab.key ? "warning" : undefined
                          }
                        >
                          <span>{tab.label}</span>
                        </Tooltip>
                      }
                    />
                  ))}
                </Tabs>
              </div>
              <Button
                type="submit"
                color="secondary"
                variant="shadow"
                radius="full"
                isDisabled={files.length === 0 || isLoading}
                isLoading={isLoading}
              >
                Convert to PDF
              </Button>
            </form>
          </CardBody>
        </Card>
        <Spacer y={4} />
      </div>

      <Spacer y={4} />
      {pdfUrl && (
        <div className="w-full max-w-[1000px] min-h-screen overflow-auto">
          <iframe
            src={pdfUrl}
            className="h-full w-full border-0 rounded-md"
            title="Generated PDF"
          />
        </div>
      )}
    </div>
  );
}
