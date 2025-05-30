const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const dotenv = require("dotenv");
const { ok, err } = require("neverthrow");

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

/**
 * Upload a PDF file to Gemini Files API
 * @param {string} filePath - The path to the PDF file
 * @param {string} displayName - Display name for the file
 * @returns {Promise<{isOk: boolean, value?: any, error?: any}>}
 */
async function uploadPDFToGemini(filePath, displayName) {
    try {
        console.log(`[pdfHandler] Uploading PDF: ${displayName}`);

        const uploadResponse = await fileManager.uploadFile(filePath, {
            mimeType: "application/pdf",
            displayName: displayName,
        });

        // Debug the response structure
        console.log(
            `[pdfHandler] Upload response:`,
            JSON.stringify(uploadResponse, null, 2),
        );

        // The response might be the file directly or have a .file property
        const file = uploadResponse.file || uploadResponse;
        const fileName = file.name;

        console.log(`[pdfHandler] PDF uploaded successfully: ${fileName}`);

        return ok({
            file: file,
            fileName: fileName,
        });
    } catch (error) {
        console.error(`[pdfHandler] Error uploading PDF: ${error.message}`);
        return err({
            type: "PDF_UPLOAD_ERROR",
            error: error.message,
        });
    }
}

/**
 * Wait for PDF processing to complete
 * @param {string} fileName - The file name returned from upload
 * @param {Function} statusCallback - Callback function for status updates
 * @returns {Promise<{isOk: boolean, value?: any, error?: any}>}
 */
async function waitForPDFProcessing(fileName, statusCallback = null) {
    try {
        console.log(`[pdfHandler] Waiting for PDF processing: ${fileName}`);

        let getFile = await fileManager.getFile(fileName);
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes max (5 second intervals)

        while (getFile.state === "PROCESSING" && attempts < maxAttempts) {
            if (statusCallback) {
                statusCallback({
                    status: "processing_pdf",
                    content: `PDF is being processed... (${Math.round((attempts / maxAttempts) * 100)}%)`,
                    progress: Math.min(
                        10 + Math.round((attempts / maxAttempts) * 40),
                        50,
                    ),
                });
            }

            console.log(
                `[pdfHandler] PDF processing status: ${getFile.state}, attempt ${attempts + 1}`,
            );
            await new Promise((resolve) => setTimeout(resolve, 5000));
            getFile = await fileManager.getFile(fileName);
            attempts++;
        }

        if (getFile.state === "FAILED") {
            console.error(`[pdfHandler] PDF processing failed: ${fileName}`);
            return err({
                type: "PDF_PROCESSING_FAILED",
                error: "PDF processing failed on Gemini's servers",
            });
        }

        if (getFile.state === "PROCESSING") {
            console.error(`[pdfHandler] PDF processing timeout: ${fileName}`);
            return err({
                type: "PDF_PROCESSING_TIMEOUT",
                error: "PDF processing timed out",
            });
        }

        console.log(`[pdfHandler] PDF processing completed: ${fileName}`);

        return ok({
            file: getFile,
            uri: getFile.uri,
            mimeType: getFile.mimeType,
        });
    } catch (error) {
        console.error(
            `[pdfHandler] Error waiting for PDF processing: ${error.message}`,
        );
        return err({
            type: "PDF_PROCESSING_ERROR",
            error: error.message,
        });
    }
}

/**
 * Clean up uploaded PDF file from Gemini Files API
 * @param {string} fileName - The file name to delete
 * @returns {Promise<{isOk: boolean, value?: any, error?: any}>}
 */
async function cleanupGeminiFile(fileName) {
    try {
        console.log(`[pdfHandler] Cleaning up file: ${fileName}`);
        await fileManager.deleteFile(fileName);
        console.log(`[pdfHandler] File cleaned up successfully: ${fileName}`);
        return ok({ success: true });
    } catch (error) {
        console.error(
            `[pdfHandler] Failed to cleanup file ${fileName}: ${error.message}`,
        );
        return err({
            type: "CLEANUP_ERROR",
            error: error.message,
        });
    }
}

/**
 * Create file content part for Gemini generation
 * @param {string} uri - File URI from processed file
 * @param {string} mimeType - MIME type of the file
 * @returns {Object} - File content part for Gemini
 */
function createPDFContentPart(uri, mimeType) {
    return {
        fileData: {
            mimeType: mimeType,
            fileUri: uri,
        },
    };
}

/**
 * Check if a file is a PDF
 * @param {string} mimeType - MIME type to check
 * @param {string} fileName - File name to check
 * @returns {boolean} - True if file is a PDF
 */
function isPDFFile(mimeType, fileName) {
    return (
        mimeType === "application/pdf" ||
        (fileName && fileName.toLowerCase().endsWith(".pdf"))
    );
}

module.exports = {
    uploadPDFToGemini,
    waitForPDFProcessing,
    cleanupGeminiFile,
    createPDFContentPart,
    isPDFFile,
};