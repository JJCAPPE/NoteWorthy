const {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const dotenv = require("dotenv");
dotenv.config();
// Load the GEMINI_API_KEY from environment variables
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

/**
 * Uploads the given file to Gemini.
 *
 * See https://ai.google.dev/gemini-api/docs/prompting_with_media
 */
async function uploadToGemini(filePath, mimeType) {

    const uploadResult = await fileManager.uploadFile(filePath, {
        mimeType,
        displayName: filePath,
    });
    const file = uploadResult.file;
    console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
    return file;
}

const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-thinking-exp-01-21",
});

const generationConfig = {
    temperature: 0.7,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 65536,
    responseMimeType: "text/plain",
};

async function run(filePath = "uploads/handwritten_note.jpeg") {
    const files = [await uploadToGemini(filePath, "image/jpeg")];

    const chatSession = model.startChat({
        generationConfig,
        history: [{
                role: "user",
                parts: [{
                        fileData: {
                            mimeType: files[0].mimeType,
                            fileUri: files[0].uri,
                        },
                    },
                    {
                        text: "make a full and extended transcription of these notes on linear combinations, including a description of all graphs/diagrams that are present",
                    },
                ],
            },
            {
                role: "model",
                parts: [{
                        text: "The user wants me to transcribe handwritten notes about linear combinations. I need to carefully read and transcribe the notes, and describe all diagrams and graphs present.",
                    },
                    { text: "Here is the full transcription of the notes..." },
                ],
            },
            {
                role: "user",
                parts: [{
                    text: "now, take these notes and convert them to a latex code to be added to an existing latex document.\n\nuse this formatting\n\nfor definitions\n\\dfn{Definiton Title}{\ncontent\n}\n\nfor notes\n\\nt{\ncontent\n}\n\nfor theorems\n\\thm{theorem title}{\ncontent\n}\n\nquestion and answer\n\\qs{Question title}{\nquestion content\n}\n\n\\sol\nsolution\n\nexamples\n\\ex{Question or example title}{\ncontent\n}\n\nalgorithms\n\\begin{algorithm}[H]\n\\KwIn{This is some input}\n\\KwOut{This is some output}\n\\SetAlgoLined\n\\SetNoFillComment\n\\tcc{This is a comment}\n\\vspace{3mm}\nsome code here;\n\n𝑥\n←\n0\nx←0\n;\n\n𝑦\n←\n0\ny←0\n;\n\\uIf{\n𝑥\n>\n5\nx>5\n} {\n\nx is greater than 5 \\tcp*{This is also a comment}\n}\\Else {\n\nx is less than or equal to 5;\n}\\ForEach{y in 0..5} {\n\n𝑦\n←\n𝑦\n+\n1\ny←y+1\n;\n}\\For{\n𝑦\n in \n0..5\n} {\n\n𝑦\n←\n𝑦\n−\n1\ny←y−1\n;\n}\\While{\n𝑥\n>\n5\nx>5\n}tvi {\n\n𝑥\n←\n𝑥\n−\n1\nx←x−1\n;\n}\\Return Return something here;\n\\caption{what}\n\\end{algorithm}\n\nthe commands are already implemented\n\nalso, never use ** for bold, always use enumerate/itemize\n\ninsert section and subsection where necessary\n\ncreate all graphs/diagrams with tikz or other packages, do not use float options such as \begin{figure}[H] EVER \n\nsince this code will be added to an existing document, return the body sections\n",
                }, ],
            },
        ],
    });

    // Use streaming API to get text as it comes in
    const streamResult = await chatSession.sendMessageStream(
        "Proceed with conversion"
    );
    let accumulatedOutput = "";
    for await (const chunk of streamResult.stream) {
        const chunkText = chunk.text();
        process.stdout.write(chunkText);
        accumulatedOutput += chunkText;
    }

    return accumulatedOutput;
}

if (require.main === module) {
    run().catch(console.error);
} else {
    module.exports = {
        uploadToGemini,
        run,
    };
}