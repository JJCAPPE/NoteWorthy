import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("noteImage", file);

    try {
      const response = await fetch("http://localhost:3001/upload", {
        method: "POST",
        body: formData,
      });

      // Get the PDF blob
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setMessage("PDF generated and displayed below.");
    } catch (error) {
      console.error("Error uploading file:", error);
      setMessage("Error uploading file");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1> Handwritten Notes to LaTeX PDF Converter </h1>{" "}
      <form onSubmit={handleSubmit}>
        <input type="file" accept="image/*" onChange={handleFileChange} />{" "}
        <br />
        <br />
        <button type="submit"> Upload and Convert </button>{" "}
      </form>{" "}
      {message && <p> {message} </p>}{" "}
      {pdfUrl && (
        <div>
          <h2> Generated PDF: </h2>{" "}
          <iframe src={pdfUrl} width="600" height="800" title="Generated PDF" />
        </div>
      )}{" "}
    </div>
  );
}
