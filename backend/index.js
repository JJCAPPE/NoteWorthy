const express = require("express");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3001;
const upload = multer({ dest: "uploads/" });

app.use(cors());

app.post("/upload", upload.single("noteImage"), async(req, res) => {
    console.log("File received:", req.file);
    try {
        // Import the Gemini integration
        const { run: runGemini } = require("./geminiIntegration");
        // Get the LaTeX code by processing the uploaded image
        const latexCode = await runGemini(req.file.path);
        console.log("Received LaTeX code:", latexCode);

        // Clean up the LaTeX code: remove starting ```latex and ending ```
        let cleanedLatex = latexCode.trim();
        if (cleanedLatex.startsWith("```latex")) {
            cleanedLatex = cleanedLatex.substring("```latex".length).trim();
        }
        if (cleanedLatex.endsWith("```")) {
            cleanedLatex = cleanedLatex.substring(0, cleanedLatex.length - 3).trim();
        }

        // Read the template file that contains the header and footer with a <content> placeholder
        const fs = require("fs");
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
            // Compile the final LaTeX code into a PDF; output will be in the "uploads" directory
            compileLatex(finalLatex, "uploads", (err, pdfPath) => {
                if (err) {
                    console.error("LaTeX compilation error:", err);
                    return res.status(500).json({
                        message: "LaTeX compilation error",
                        error: err.toString(),
                    });
                }
                console.log("PDF generated at:", pdfPath);
                // Send the generated PDF file to the client. The 'root' option resolves pdfPath relative to the project root.
                res.sendFile(pdfPath, { root: "." });
            });
        });
    } catch (error) {
        console.error("Error processing file:", error);
        res.status(500).json({
            message: "Error processing file",
            error: error.toString(),
        });
    }
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}...`);
});