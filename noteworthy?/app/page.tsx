"use client";
import { Link } from "@heroui/link";
import { Snippet } from "@heroui/snippet";
import { Code } from "@heroui/code";
import { button as buttonStyles } from "@heroui/theme";
import { Button, ButtonGroup } from "@heroui/button";

import { siteConfig } from "@/config/site";
import { title, subtitle } from "@/components/primitives";
import { GithubIcon } from "@/components/icons";
import { useState } from "react";

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

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md p-6 shadow-lg rounded-lg bg-white">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-row gap-2 justify-center">
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
          </div>
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
        {message && <p className="mt-4 text-center text-red-500"> {message}</p>}
      </div>
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
