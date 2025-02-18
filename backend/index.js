const express = require("express");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const app = express();
const PORT = process.env.PORT || 3001;

// Function to clear files from directories
function clearUploads() {
  const directories = [
    path.join(__dirname, "uploads", "images"),
    path.join(__dirname, "uploads", "latexuploads"),
  ];

  directories.forEach((dir) => {
    try {
      if (!fs.existsSync(dir)) {
        console.log(`Directory ${dir} does not exist.`);
        return;
      }
      const files = fs.readdirSync(dir);
      files.forEach((file) => {
        const filePath = path.join(dir, file);
        fs.unlinkSync(filePath);
        console.log(`Deleted file: ${filePath}`);
      });
    } catch (error) {
      console.error(`Error clearing directory ${dir}:`, error);
    }
  });
}

app.get("/clear", ((req, res) => {
    console.log("Clearing uploads on every request...");
    clearUploads();
    res.sendStatus(200);
  }));
// Change from single to multiple file uploads; adjust maxCount as needed
const upload = multer({ dest: "uploads/images/" });

app.use(cors());

app.post("/upload", upload.array("noteImage", 10), async (req, res) => {
  console.log("Files received:", req.files);
  try {
    const processType = req.body.processType || "base";
    console.log("Process type:", processType);

    // Import the Gemini integration
    const { run: runGemini } = require("./geminiIntegration");

    // Map over the uploaded files to extract their paths
    const filePaths = req.files.map((file) => file.path);
    // Get the LaTeX code by processing the uploaded images
    const latexCode = await runGemini(filePaths, processType);
    console.log("Received LaTeX code:", latexCode);

    // Clean up the LaTeX code: remove starting ```latex and ending ```
    let cleanedLatex = latexCode.trim();
    if (cleanedLatex.startsWith("```latex")) {
      cleanedLatex = cleanedLatex.substring("```latex".length).trim();
    }
    if (cleanedLatex.endsWith("```")) {
      cleanedLatex = cleanedLatex.substring(0, cleanedLatex.length - 3).trim();
    }
    // If the cleaned LaTeX contains a \begin{document}, remove it and everything before
    const documentStart = "\\begin{document}";
    const docIndex = cleanedLatex.indexOf(documentStart);
    if (docIndex !== -1) {
      cleanedLatex = cleanedLatex
        .substring(docIndex + documentStart.length)
        .trim();
    }
    // Remove any instances of ", tdplot_main_coords"
    cleanedLatex = cleanedLatex.replace(/, tdplot_main_coords/g, "");

    // Read the template file that contains the header and footer with a <content> placeholder
    const templatePath = path.join(__dirname, "templates", "main.txt");
    fs.readFile(templatePath, "utf8", (err, template) => {
      if (err) {
        console.error("Error reading template:", err);
        return res.status(500).json({
          message: "Error reading LaTeX template",
          error: err.toString(),
        });
      }
      // Insert the cleaned LaTeX into the template
      const finalLatex = template.replace("<content>", cleanedLatex);

      // Import the LaTeX compiler
      const { compileLatex } = require("./latexCompiler");
      // Compile the final LaTeX code into a PDF; output will be in the "uploads/latexuploads" directory
      compileLatex(finalLatex, "uploads/latexuploads", (err, pdfPath) => {
        if (err) {
          console.error("LaTeX compilation error:", err);
          return res.status(500).json({
            message: "LaTeX compilation error",
            error: err.toString(),
          });
        }
        console.log("PDF generated at:", pdfPath);
        // Send the generated PDF file to the client.
        res.sendFile(pdfPath, { root: "." });
      });
    });
  } catch (error) {
    console.error("Error processing files:", error);
    res.status(500).json({
      message: "Error processing files",
      error: error.toString(),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}...`);
});
