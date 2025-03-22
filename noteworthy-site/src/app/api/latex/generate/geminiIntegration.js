const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const dotenv = require("dotenv");
const { ok, err, Result } = require("neverthrow");

dotenv.config();
// Load the GEMINI_API_KEY from environment variables
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

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

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-pro-exp-02-05",
});

const generationConfig = {
  temperature: 0.7,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 65536,
  responseMimeType: "text/plain",
};

async function run(
  filePaths = ["uploads/handwritten_note.jpeg"],
  processType = "base",
) {
  try {
    // Allow a single string or an array of file paths
    if (!Array.isArray(filePaths)) {
      filePaths = [filePaths];
    }

    // Upload all files concurrently and combine the results
    const uploadResults = await Promise.all(
      filePaths.map((filePath) => uploadToGemini(filePath, "image/jpeg")),
    );
    const filesResult = Result.combine(uploadResults);
    if (filesResult.isErr()) {
      return err({
        type: "GEMINI_FILE_UPLOAD_ERROR",
        error: filesResult.error,
      });
    }
    const uploadedFilesData = filesResult.value.map((result) => result.file);

    let transcriptionText = "";
    if (processType === "summary") {
      transcriptionText =
        "make a summarised, revision sheet like transcription of these notes that is extremely concise and has only core concepts";
    } else if (processType === "expansion") {
      transcriptionText =
        "expand on all the details in the given notes in order for the user to be able to deeply study this content from the output";
    } else {
      transcriptionText =
        "make a full and extended transcription of these notes on linear combinations, including a description of all graphs/diagrams that are present";
    }

    let promtText = "";
    if (processType === "summary") {
      promtText =
        "make a summarised, revision sheet like latex of these notes that is extremely concise and has only core concepts and definitions";
    } else if (processType === "expansion") {
      promtText =
        "expand on all the details in the given notes in order for the user to be able to deeply study this content from the output , including all graphs/diagrams that are present and extra ones you deem necessary";
    } else {
      promtText =
        "make a full transcription of these notes on linear combinations, including all graphs/diagrams that are present";
    }

    const chatSession = model.startChat({
      generationConfig,
      history: [
        {
          role: "user",
          parts: [
            // Include each uploaded file's metadata
            ...uploadedFilesData.map((file) => ({
              fileData: {
                mimeType: file.mimeType,
                fileUri: file.uri,
              },
            })),
            { text: transcriptionText },
          ],
        },
        {
          role: "model",
          parts: [
            {
              text: "The user wants me to transcribe handwritten notes about linear combinations. I need to carefully read and transcribe the notes, and describe all diagrams and graphs present.",
            },
            { text: "Here is the full transcription of the notes..." },
          ],
        },
        {
          role: "user",
          parts: [
            {
              text:
                "now, take these notes and convert them to a latex code to be added to an existing latex document " +
                promtText +
                ".\n use this formatting \nfor definitions\n\\dfn{Definiton Title}{\ncontent\n}\nfor notes\n\\nt{\ncontent\n}\nfor theorems\n\\thm{theorem title}{\ncontent\n}\nquestion and answer\n\\qs{Question title}{\nquestion content\n}\n\\sol\nsolution\nexamples\n\\ex{Question or example title}{\ncontent\n}\nalgorithms\n\\begin{algorithm}[H]\n\\KwIn{This is some input}\n\\KwOut{This is some output}\n\\SetAlgoLined\n\\SetNoFillComment\n\\tcc{This is a comment}\n\\vspace{3mm}\nsome code here;\n𝑥\n←\n0\nx←0\n;\n𝑦\n←\n0\ny←0\n;\n\\uIf{\n𝑥\n>\n5\nx>5\n} {\nx is greater than 5 \\tcp*{This is also a comment}\n}\\Else {\nx is less than or equal to 5;\n}\\ForEach{y in 0..5} {\n𝑦\n←\n𝑦\n+\n1\ny←y+1\n;\n}\\For{\n𝑦\n in \n0..5\n} {\n𝑦\n←\n𝑦\n−\n1\ny−1\n;\n}\\While{\n𝑥\n>\n5\nx>5\n}tvi {\n𝑥\n←\n𝑥\n−\n1\nx←x−1\n;\n}\\Return Return something here;\n\\caption{what}\n\\end{algorithm}\nthe commands are already implemented\nalso, never use ** for bold, always use enumerate/itemize\ninsert section and subsection where necessary, but ALWAYS use section*{} and subsection*{}\ncreate all graphs/diagrams with tikz or other packages, do not use float options such as \\begin{figure}[H] EVER \n it is to be compiled without checking, so try to use as little werid formatting and extra pacakges as possible (eg dont use tdplot_main_coords)\nsince this code will be added to an existing document, return the body sections\n",
            },
          ],
        },
      ],
    });

    const streamResult = await chatSession.sendMessageStream(
      "Proceed with conversion",
    );
    let accumulatedOutput = "";
    for await (const chunk of streamResult.stream) {
      const chunkText = chunk.text();
      process.stdout.write(chunkText);
      accumulatedOutput += chunkText;
    }
    return ok({
      output: accumulatedOutput,
    });
  } catch (error) {
    return err({
      type: "GEMINI_GENERATION_ERROR",
      error: error.message,
    });
  }
}

if (require.main === module) {
  run().then((result) => {
    result.match({
      ok: (output) => console.log(output),
      err: (e) => console.error(e),
    });
  });
} else {
  module.exports = {
    uploadToGemini,
    run,
  };
}
