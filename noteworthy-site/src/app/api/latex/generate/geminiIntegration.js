const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const dotenv = require("dotenv");
const { ok, err, Result } = require("neverthrow");
const fs = require("fs").promises;
const path = require("path");

// Import PDF handler functions
const pdfHandlerPath = path.resolve(__dirname, "../../../../lib/pdfHandler.js");
const { uploadPDFToGemini, waitForPDFProcessing, isPDFFile } = require(
    pdfHandlerPath,
);

dotenv.config();
// Load the GEMINI_API_KEY from environment variables
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

const PROCESS_PROMPTS = {
    summary: "make a summarised, revision sheet like latex of these notes that is extremely concise and has only core concepts and definitions",
    expansion: "expand on all the details in the given notes in order for the user to be able to deeply study this content from the output, including all graphs/diagrams that are present and extra ones you deem necessary",
    base: "make a full transcription of these notes, including all graphs/diagrams that are present",
};

function getPromptText(processType) {
    switch (processType) {
        case "summary":
            return PROCESS_PROMPTS.summary;
        case "expansion":
            return PROCESS_PROMPTS.expansion;
        case "base":
            return PROCESS_PROMPTS.base;
        default:
            return PROCESS_PROMPTS.base;
    }
}

function getModel(model) {
    switch (model) {
        case "regular":
            return "gemini-2.0-flash";
        case "fast":
            return "gemini-2.0-flash-lite";
        case "pro":
            return "gemini-2.5-pro-exp-03-25";
    }
}

async function uploadToGemini(filePath, mimeType) {
    try {
        const uploadResult = await fileManager.uploadFile(filePath, {
            mimeType,
            displayName: filePath,
        });
        const file = uploadResult.file;
        console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
        return ok({
            file: file,
        });
    } catch (error) {
        return err({
            type: "GEMINI_UPLOAD_ERROR",
            error: error.message,
        });
    }
}

/**
 * Process PDF files by uploading to Gemini Files API and waiting for processing
 * @param {string} filePath - Path to the PDF file
 * @param {Function} streamCallback - Callback for status updates
 * @returns {Promise<{isOk: boolean, value?: any, error?: any}>}
 */
async function processPDFFile(filePath, streamCallback = null) {
    try {
        console.log(`[geminiIntegration] Processing PDF file: ${filePath}`);

        const fileName = path.basename(filePath);

        // Upload to Gemini Files API using file path
        if (streamCallback) {
            streamCallback("Uploading PDF to processing service...", 10);
        }

        const uploadResult = await uploadPDFToGemini(filePath, fileName);
        if (uploadResult.isErr()) {
            return uploadResult;
        }

        const { fileName: geminiFileName } = uploadResult.value;

        // Wait for processing to complete
        if (streamCallback) {
            streamCallback("PDF uploaded, waiting for processing...", 15);
        }

        const processingResult = await waitForPDFProcessing(
            geminiFileName,
            streamCallback,
        );

        if (processingResult.isErr()) {
            return processingResult;
        }

        if (streamCallback) {
            streamCallback(
                "PDF processing complete, preparing for LaTeX generation...",
                60,
            );
        }

        return ok({
            file: processingResult.value.file,
            uri: processingResult.value.uri,
            mimeType: processingResult.value.mimeType,
            fileName: geminiFileName,
            isPDF: true,
        });
    } catch (error) {
        console.error(`[geminiIntegration] Error processing PDF: ${error.message}`);
        return err({
            type: "PDF_PROCESSING_ERROR",
            error: error.message,
        });
    }
}

/**
 * Detect file type and return appropriate MIME type
 * @param {string} filePath - Path to the file
 * @returns {string} - MIME type
 */
function detectMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case ".pdf":
            return "application/pdf";
        case ".jpg":
        case ".jpeg":
            return "image/jpeg";
        case ".png":
            return "image/png";
        case ".webp":
            return "image/webp";
        default:
            return "image/jpeg"; // Default fallback
    }
}

const generationConfig = {
    temperature: 0.7,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 65536,
    responseMimeType: "text/plain",
};

async function run(
    filePaths,
    processType,
    modelType,
    customPrompt,
    streamCallback = null, // Optional callback for streaming updates
) {
    console.log("[geminiIntegration] Starting run function with:", {
        fileCount: Array.isArray(filePaths) ? filePaths.length : 1,
        processType,
        modelType,
        hasCustomPrompt: !!customPrompt,
        hasStreamCallback: !!streamCallback,
    });

    let uploadedFilesData = [];
    let pdfFilesToCleanup = [];

    try {
        if (!Array.isArray(filePaths)) {
            filePaths = [filePaths];
        }

        console.log("[geminiIntegration] Processing files...");

        // Separate PDFs from images and process accordingly
        for (const filePath of filePaths) {
            const mimeType = detectMimeType(filePath);

            if (isPDFFile(mimeType, filePath)) {
                // Process PDF through Files API
                console.log(`[geminiIntegration] Processing PDF: ${filePath}`);
                const pdfResult = await processPDFFile(filePath, streamCallback);

                if (pdfResult.isErr()) {
                    console.error(
                        "[geminiIntegration] PDF processing error:",
                        pdfResult.error,
                    );
                    return pdfResult;
                }

                const pdfData = pdfResult.value;
                uploadedFilesData.push({
                    fileData: {
                        mimeType: pdfData.mimeType,
                        fileUri: pdfData.uri,
                    },
                });

                // Keep track of PDF files for cleanup
                pdfFilesToCleanup.push(pdfData.fileName);
            } else {
                // Process image through regular upload
                console.log(`[geminiIntegration] Processing image: ${filePath}`);
                const uploadResult = await uploadToGemini(filePath, mimeType);

                if (uploadResult.isErr()) {
                    console.error(
                        "[geminiIntegration] Image upload error:",
                        uploadResult.error,
                    );
                    return uploadResult;
                }

                uploadedFilesData.push({
                    fileData: {
                        mimeType: uploadResult.value.file.mimeType,
                        fileUri: uploadResult.value.file.uri,
                    },
                });
            }
        }

        console.log("[geminiIntegration] All files processed successfully");

        let promtText = getPromptText(processType);
        console.log("[geminiIntegration] Using model:", getModel(modelType));

        try {
            const model = genAI.getGenerativeModel({
                model: getModel(modelType),
            });

            console.log("[geminiIntegration] Starting chat session");
            const chatSession = model.startChat({
                generationConfig,
                history: [{
                        role: "user",
                        parts: uploadedFilesData,
                    },
                    {
                        role: "user",
                        parts: [{
                            text: "now, take these notes and convert them to a latex code to be added to an existing latex document " +
                                promtText +
                                ".\n use this formatting \nfor definitions\n\\dfn{Definiton Title}{\ncontent\n}\nfor notes\n\\nt{\ncontent\n}\nfor theorems\n\\thm{theorem title}{\ncontent\n}\nquestion and answer\n\\qs{Question title}{\nquestion content\n}\n\\sol\nsolution\nexamples\n\\ex{Question or example title}{\ncontent\n}\nalgorithms\n\\begin{algorithm}[H]\n\\KwIn{This is some input}\n\\KwOut{This is some output}\n\\SetAlgoLined\n\\SetNoFillComment\n\\tcc{This is a comment}\n\\vspace{3mm}\nsome code here;\n𝑥\n←\n0\nx←0\n;\n𝑦\n←\n0\ny←0\n;\n\\uIf{\n𝑥\n>\n5\nx>5\n} {\nx is greater than 5 \\tcp*{This is also a comment}\n}\\Else {\nx is less than or equal to 5;\n}\\ForEach{y in 0..5} {\n𝑦\n←\n𝑦\n+\n1\ny←y+1\n;\n}\\For{\n𝑦\n in \n0..5\n} {\n𝑦\n←\n𝑦\n−\n1\ny−1\n;\n}\\While{\n𝑥\n>\n5\nx>5\n}tvi {\n𝑥\n←\n𝑥\n−\n1\nx←x−1\n;\n}\\Return Return something here;\n\\caption{what}\n\\end{algorithm}\nthe commands are already implemented\nalso, never use ** for bold, always use enumerate/itemize\ninsert section and subsection where necessary, but ALWAYS use section*{} and subsection*{}\ncreate all graphs/diagrams with tikz or other packages, do not use float options such as \\begin{figure}[H] EVER \n it is to be compiled without checking using a light distribution of pdflatex, so try to use as little werid formatting and extra pacakges as possible (eg dont use tdplot_main_coords)\n center all figures with \\begin{center} \\end{center} since this code will be added to an existing document, return the body sections\n" +
                                "the users specifications for how to convert their notes to latex are:\n" +
                                customPrompt,
                        }, ],
                    },
                ],
            });

            console.log("[geminiIntegration] Sending message stream");
            const streamResult = await chatSession.sendMessageStream(
                "Proceed with conversion",
            );

            let accumulatedOutput = "";
            let counter = 0;
            const totalChunks = 50; // Estimate for progress calculation

            try {
                if (streamCallback) {
                    // Using stream with callback for WebSocket mode
                    console.log("[geminiIntegration] Processing with stream callback");
                    let lastProgressReported = 0;

                    for await (const chunk of streamResult.stream) {
                        const chunkText = chunk.text();
                        accumulatedOutput += chunkText;
                        counter++;

                        // Calculate progress (approximate) - start from 65% since PDF processing takes 60%
                        const progress = Math.min(
                            65 + Math.floor((counter / totalChunks) * 35),
                            99,
                        );

                        // Only log every 10% to avoid flooding
                        if (progress >= lastProgressReported + 10) {
                            console.log(`[geminiIntegration] Stream progress: ${progress}%`);
                            lastProgressReported = progress;
                        }

                        // Call the callback with the accumulated output and progress
                        streamCallback(accumulatedOutput, progress);
                    }
                    console.log("[geminiIntegration] Stream complete");
                } else {
                    // Original behavior for REST API mode
                    console.log("[geminiIntegration] Processing without stream callback");
                    for await (const chunk of streamResult.stream) {
                        const chunkText = chunk.text();
                        process.stdout.write(chunkText);
                        accumulatedOutput += chunkText;
                    }
                }
            } catch (streamError) {
                console.error(
                    "[geminiIntegration] Error processing stream:",
                    streamError,
                );
                throw streamError;
            }

            console.log("[geminiIntegration] Generation completed successfully");

            return ok({
                output: accumulatedOutput,
                pdfFilesToCleanup: pdfFilesToCleanup,
            });
        } catch (apiError) {
            console.error("[geminiIntegration] API error:", apiError);
            return err({
                type: "GEMINI_API_ERROR",
                error: apiError.message,
            });
        }
    } catch (error) {
        console.error("[geminiIntegration] Generation error:", error);
        return err({
            type: "GEMINI_GENERATION_ERROR",
            error: error.message,
        });
    } finally {
        // Clean up PDF files in the background
        if (pdfFilesToCleanup.length > 0) {
            console.log("[geminiIntegration] Cleaning up PDF files...");
            // Don't await this - do it in background to not delay response
            cleanupPDFFiles(pdfFilesToCleanup);
        }
    }
}

/**
 * Clean up PDF files from Gemini Files API (background operation)
 * @param {string[]} fileNames - Array of file names to cleanup
 */
async function cleanupPDFFiles(fileNames) {
    const { cleanupGeminiFile } = require(pdfHandlerPath);

    for (const fileName of fileNames) {
        try {
            await cleanupGeminiFile(fileName);
        } catch (error) {
            console.error(
                `[geminiIntegration] Failed to cleanup PDF file ${fileName}:`,
                error,
            );
        }
    }
}

// Export for CommonJS
module.exports = { run };