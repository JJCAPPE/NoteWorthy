const express = require("express");
const bodyParser = require("body-parser");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// POST /compile expects a JSON body with a "latex" field
app.post("/compile", (req, res) => {
  const { latex } = req.body;
  if (!latex) {
    return res.status(400).json({ error: "No LaTeX code provided" });
  }

  // Create unique filenames based on timestamp
  const uniqueId = Date.now().toString();
  const tmpDir = "/tmp";
  const texPath = path.join(tmpDir, `${uniqueId}.tex`);
  const pdfPath = path.join(tmpDir, `${uniqueId}.pdf`);

  // Write the LaTeX code to a temporary .tex file
  fs.writeFile(texPath, latex, (writeErr) => {
    if (writeErr) {
      return res.status(500).json({ error: "Error writing LaTeX file" });
    }

    // Run the latexmk command
    const cmd = `latexmk -pdf -f -interaction=nonstopmode -output-directory=${tmpDir} ${texPath}`;
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.error("LaTeXMK error:", stderr);
        return res
          .status(500)
          .json({ error: "LaTeX compilation error", details: stderr });
      }

      // Read the generated PDF file and send it as a response
      fs.readFile(pdfPath, (readErr, data) => {
        if (readErr) {
          return res.status(500).json({ error: "Error reading PDF file" });
        }
        res.set({ "Content-Type": "application/pdf" });
        res.send(data);
      });
    });
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`LaTeX service listening on port ${PORT}`);
});
