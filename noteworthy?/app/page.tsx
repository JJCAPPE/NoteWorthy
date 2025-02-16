"use client";
import { Button, ButtonGroup } from "@heroui/button";
import { Card, CardHeader, CardBody, CardFooter } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { useState, useEffect } from "react";
import Image from "next/image";
import { Spacer } from "@heroui/spacer";

export const CameraIcon = ({
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

export const UploadIcon = ({
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
      width="172px"
      height="172px"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="#ffffff"
    >
      <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
      <g
        id="SVGRepo_tracerCarrier"
        stroke-linecap="round"
        stroke-linejoin="round"
      ></g>
      <g id="SVGRepo_iconCarrier">
        {" "}
        <path
          opacity="1"
          d="M4 12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12"
          stroke="#ffffff"
          stroke-width="1.5"
          stroke-linecap="round"
        ></path>{" "}
        <path
          d="M12 4L12 14M12 14L15 11M12 14L9 11"
          stroke="#ffffff"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        ></path>{" "}
      </g>
    </svg>
  );
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      setFile(event.dataTransfer.files[0]);
      event.dataTransfer.clearData();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFile(event.target.files[0]);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setIsLoading(true);
    const formData = new FormData();
    formData.append("noteImage", file);

    try {
      const response = await fetch("http://localhost:3001/upload", {
        method: "POST",
        body: formData,
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setMessage("PDF generated and displayed below.");
    } catch (error) {
      console.error("Error uploading file:", error);
      setMessage("Error uploading file");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 flex flex-col items-center justify-center">
      <Spacer y={4} />
      {/* Left Column - Always shown */}
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
                    className="items-center justify-center gap-2 mr-2"
                    radius="full"
                    variant="shadow"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
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
                  >
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <CameraIcon />
                  </Button>
                  <Button
                    as="label"
                    isIconOnly
                    aria-label="Upload"
                    color="primary"
                    variant="shadow"
                    radius="full"
                  >
                    <UploadIcon />
                  </Button>
                </CardBody>
              </Card>
              {previewUrl && (
                <div className="mt-4 flex justify-center">
                  <Image
                    src={previewUrl}
                    alt="File Preview"
                    className="max-h-64 object-contain border rounded shadow-sm"
                    width={100}
                    height={100}
                  />
                </div>
              )}
              <Button
                type="submit"
                color="secondary"
                variant="shadow"
                radius="full"
                isDisabled={!file || isLoading}
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
        <div
          className="w-full max-w-2xl overflow-auto"
          style={{ height: "calc(100vh - 200px)" }} // or a large fixed height if you prefer
        >
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0 rounded-md"
            title="Generated PDF"
          />
        </div>
      )}
    </div>
  );
}
