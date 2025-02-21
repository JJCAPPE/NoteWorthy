"use client";
import { Button } from "@heroui/button";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { useState, useEffect } from "react";
import Image from "next/image";
import { Spacer } from "@heroui/spacer";
import { Tabs, Tab } from "@heroui/tabs";
import { Tooltip } from "@heroui/tooltip";
import dotenv from "dotenv";
import { ListRestart } from "lucide-react";
import { Upload, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";

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

interface PdfMetadata {
  sourceFiles: string[]; // File names of source images
  processType: string; // Type of processing used
  timestamp: number; // When the PDF was generated
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [messageText, setMessageText] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfMetadata, setPdfMetadata] = useState<PdfMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processType, setProcessType] = useState("base");

  // Update previews when files change
  useEffect(() => {
    if (files.length === 0) {
      setPreviewUrls([]);
      return;
    }
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  // Remove the manual file input change handler.
  // File selection is now handled by antd’s Upload via beforeUpload.

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
      setPdfMetadata({
        sourceFiles: files.map((f) => f.name),
        processType,
        timestamp: Date.now(),
      });
      setMessageText("PDF generated and displayed below.");
    } catch (error) {
      console.error("Error uploading files:", error);
      setMessageText("Error uploading files");
      setPdfMetadata(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Optional: keep your drag & drop behavior on the card
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(event.dataTransfer.files);
      setFiles((prev) => [...prev, ...droppedFiles]);
      event.dataTransfer.clearData();
    }
  };

  return (
    <div
      className={`flex ${pdfUrl ? "flex-row" : "flex-col"} items-center justify-start min-h-screen w-[90vw] mx-auto`}
    >
      <Spacer y={4} />
      <div className="container flex flex-col justify-center mx-auto px-4">
        <Spacer y={4} />
        <Tooltip
          showArrow
          defaultOpen
          color="success"
          content="Rotate Horizonaly for Better Viewing"
        >
          <Card
            onDragOver={handleDragOver}
            onDrop={handleDrop}
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
                    {/* File selection via antd Upload */}
                    <Upload
                      beforeUpload={(file) => {
                        setFiles((prev) => [...prev, file]);
                        return false; // Prevent auto-upload
                      }}
                      multiple
                      accept="image/*"
                      showUploadList={false}
                    >
                      <Button
                        color="primary"
                        className="relative cursor-pointer items-center justify-center gap-2 mr-2"
                        radius="full"
                        variant="shadow"
                      >
                        <UploadOutlined />
                        Select Files
                      </Button>
                    </Upload>
                    {/* Camera capture using antd Upload with capture attribute */}
                    <Upload
                      beforeUpload={(file) => {
                        setFiles((prev) => [...prev, file]);
                        return false;
                      }}
                      multiple={false}
                      accept="image/*"
                      capture="environment"
                      showUploadList={false}
                    >
                      <Button
                        as="label"
                        isIconOnly
                        aria-label="Camera"
                        color="primary"
                        variant="shadow"
                        radius="full"
                        className="relative cursor-pointer"
                      >
                        <CameraIcon />
                      </Button>
                    </Upload>
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
                <div className="flex flex-row gap-4 justify-center">
                  <Button
                    className="w-full max-w-md"
                    type="submit"
                    color="secondary"
                    variant="shadow"
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
                    color="danger"
                    variant="shadow"
                    radius="full"
                    onPress={() => {
                      setPdfUrl("");
                      setPdfMetadata(null);
                      setFiles([]);
                      setProcessType("base");
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
      </div>

      <Spacer y={4} />
      {pdfUrl && (
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
