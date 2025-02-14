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
    // Compile the .tex file to PDF using pdflatex
    exec(
      `pdflatex -interaction=nonstopmode -output-directory=${outputDir} ${tempTexPath}`,
      (error, stdout, stderr) => {
        if (error) {
          return callback(error);
        }
        // Assuming the output PDF is named temp.pdf
        const pdfPath = path.join(outputDir, "temp.pdf");
        callback(null, pdfPath);
      }
    );
  });
}

module.exports = { compileLatex };
