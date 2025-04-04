const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const dotenv = require("dotenv");
const { ok, err, Result } = require("neverthrow");
import mime from "mime-types";

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
  base: "make a full transcription of these notes, including all graphs/diagrams that are present"
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

async function waitForFilesActive(files) {
  console.log("Waiting for file processing...");
  try {
    for (const file of files) { // files is an array of file objects
      let currentFile = await fileManager.getFile(file.name);
      while (currentFile.state === "PROCESSING") {
        process.stdout.write(".");
        await new Promise((resolve) => setTimeout(resolve, 10_000));
        currentFile = await fileManager.getFile(file.name);
      }
      if (currentFile.state !== "ACTIVE") {
        return err(new Error(`File ${currentFile.name} failed to process`));
      }
    }
    console.log("...all files ready\n");
    return ok(undefined);
  } catch (error) {
    return err(error);
  }
}

// add option to use gemini-2.5-pro-exp-03-25 for longer compile time but higher quality output


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
) {
  try { 
    if (!Array.isArray(filePaths)) {
      filePaths = [filePaths];
    }
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

    let promtText = getPromptText(processType);

    const model = genAI.getGenerativeModel({
      model: getModel(modelType),
    });

    const chatSession = model.startChat({
      generationConfig,
      history: [
        {
          role: "user",
          parts: [
            ...uploadedFilesData.map((file) => ({
              fileData: {
                mimeType: file.mimeType,
                fileUri: file.uri,
              },
            })),
          ],
        },
        {
          role: "user",
          parts: [
            {
              text:
                "now, take these notes and convert them to a latex code to be added to an existing latex document " +
                promtText +
                ".\n use this formatting \nfor definitions\n\\dfn{Definiton Title}{\ncontent\n}\nfor notes\n\\nt{\ncontent\n}\nfor theorems\n\\thm{theorem title}{\ncontent\n}\nquestion and answer\n\\qs{Question title}{\nquestion content\n}\n\\sol\nsolution\nexamples\n\\ex{Question or example title}{\ncontent\n}\nalgorithms\n\\begin{algorithm}[H]\n\\KwIn{This is some input}\n\\KwOut{This is some output}\n\\SetAlgoLined\n\\SetNoFillComment\n\\tcc{This is a comment}\n\\vspace{3mm}\nsome code here;\n𝑥\n←\n0\nx←0\n;\n𝑦\n←\n0\ny←0\n;\n\\uIf{\n𝑥\n>\n5\nx>5\n} {\nx is greater than 5 \\tcp*{This is also a comment}\n}\\Else {\nx is less than or equal to 5;\n}\\ForEach{y in 0..5} {\n𝑦\n←\n𝑦\n+\n1\ny←y+1\n;\n}\\For{\n𝑦\n in \n0..5\n} {\n𝑦\n←\n𝑦\n−\n1\ny−1\n;\n}\\While{\n𝑥\n>\n5\nx>5\n}tvi {\n𝑥\n←\n𝑥\n−\n1\nx←x−1\n;\n}\\Return Return something here;\n\\caption{what}\n\\end{algorithm}\nthe commands are already implemented\nalso, never use ** for bold, always use enumerate/itemize\ninsert section and subsection where necessary, but ALWAYS use section*{} and subsection*{}\ncreate all graphs/diagrams with tikz or other packages, do not use float options such as \\begin{figure}[H] EVER \n it is to be compiled without checking using a light distribution of pdflatex, so try to use as little werid formatting and extra pacakges as possible (eg dont use tdplot_main_coords)\n center all figures with \begin{center} \end{center} since this code will be added to an existing document, return the body sections\n" +
                "the users specifications for how to convert their notes to latex are:\n" +
                customPrompt,
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

export { run };