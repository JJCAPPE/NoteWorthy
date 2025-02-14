const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

function compileLatex(latexCode, outputDir, callback) {
  // Write the LaTeX code to a temporary .tex file
  const tempTexPath = path.join(outputDir, "temp.tex");
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
          const logPath = path.join(outputDir, "temp.log");
          fs.readFile(logPath, "utf8", (readErr, logContent) => {
            if (!readErr) {
              console.error("LaTeX log file contents:\n", logContent);
            } else {
              console.error("Unable to read LaTeX log file at", logPath);
            }
            return callback(error);
          });
        }
        // Assuming the output PDF is named temp.pdf
        const pdfPath = path.join(outputDir, "temp.pdf");
        callback(null, pdfPath);
      }
    );
  });
}

module.exports = { compileLatex };
