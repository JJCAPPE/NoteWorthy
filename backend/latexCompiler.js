const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

function compileLatex(latexCode, outputDir, callback) {
  // Generate a unique ID for all temporary files
  const uniqueId = uuidv4();
  const tempTexPath = path.join(outputDir, `${uniqueId}.tex`);

  fs.writeFile(tempTexPath, latexCode, (err) => {
    if (err) {
      return callback(err);
    }
    // Compile the .tex file to PDF using latexmk
    exec(
      `latexmk -pdf -f -interaction=nonstopmode -output-directory=${outputDir} ${tempTexPath}`,
      (error, stdout, stderr) => {
        if (error) {
          console.error("LaTeX compilation error:");
          console.error("STDOUT:\n", stdout);
          console.error("STDERR:\n", stderr);
          // Attempt to read the log file for more details
          const logPath = path.join(outputDir, `${uniqueId}.log`);
          fs.readFile(logPath, "utf8", (readErr, logContent) => {
            if (!readErr) {
              console.error("LaTeX log file contents:\n", logContent);
            } else {
              console.error("Unable to read LaTeX log file at", logPath);
            }
            return callback(error);
          });
        }
        // Assuming the output PDF is named with the same base as the tex file
        const pdfPath = path.join(outputDir, `${uniqueId}.pdf`);
        callback(null, pdfPath);
      }
    );
  });
}

module.exports = { compileLatex };
