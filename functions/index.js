// Importações de Módulos Essenciais
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {HfInference} = require("@huggingface/inference");
const logger = require("firebase-functions/logger");
const {defineString} = require("firebase-functions/params");

// --- Configuração Inicial ---

// Define o parâmetro para a chave de API do Hugging Face
const hfApiKey = defineString("HUGGINGFACE_API_KEY");

// Inicializa os serviços do Firebase
initializeApp();

// --- Funções Auxiliares ---

/**
 * Busca todo o conhecimento da coleção 'perguntas_respostas' no Firestore.
 * @return {Promise<string>} Uma string formatada com todo o conhecimento.
 */
async function getKnowledgeBase() {
  const db = getFirestore();
  const snapshot = await db.collection("perguntas_respostas").get();

  if (snapshot.empty) {
    logger.warn("A coleção 'perguntas_respostas' está vazia.");
    return "Nenhum conhecimento foi encontrado.";
  }

  let knowledgeBase = "";
  snapshot.forEach((doc) => {
    const data = doc.data();
    knowledgeBase += `Pergunta: ${data.pergunta}\nResposta: ${data.resposta}\n\n`;
  });

  return knowledgeBase;
}

/**
 * Formata o prompt final para ser enviado ao modelo de IA.
 * @param {string} knowledge - O conhecimento extraído do Firestore.
 * @param {string} query - A pergunta do utilizador.
 * @return {string} O prompt formatado.
 */
function formatPrompt(knowledge, query) {
  // As instruções do sistema são construídas de forma mais limpa.
  const systemInstructions = [
    "Você é um assistente virtual interno chamado \"G-Bot\".",
    "Seja prestável, direto e amigável.",
    "Responda à pergunta do utilizador usando apenas o CONHECIMENTO FORNECIDO.",
    "Se a resposta não estiver no conhecimento, diga que não tem a informação.",
  ].join(" ");

  // O bloco de conhecimento e a pergunta do utilizador são montados separadamente.
  const knowledgeBlock = [
    "--- CONHECIMENTO FORNECIDO ---",
    knowledge,
    "---",
    `PERGUNTA DO UTILIZADOR:\n"${query}"`,
  ].join("\n");

  // Formato final para modelos de instrução como o Mistral.
  return `<s>[INST] ${systemInstructions} \n\n ${knowledgeBlock} [/INST]`;
}

// --- Cloud Function Principal ---

/**
 * Função principal que interage com a API do Hugging Face.
 */
exports.askHuggingFace = onCall(async (request) => {
  const userQuery = request.data.query;

  if (!userQuery) {
    logger.error("A função foi chamada sem o parâmetro 'query'.");
    throw new HttpsError(
        "invalid-argument",
        "A função precisa de receber um parâmetro 'query'.",
    );
  }

  try {
    // 1. Obter a base de conhecimento
    const knowledge = await getKnowledgeBase();

    // 2. Formatar o prompt
    const finalPrompt = formatPrompt(knowledge, userQuery);

    // 3. Chamar a API do Hugging Face
    const hf = new HfInference(hfApiKey.value());
    const response = await hf.textGeneration({
      model: "mistralai/Mistral-7B-Instruct-v0.2",
      inputs: finalPrompt,
      parameters: {
        max_new_tokens: 250,
        temperature: 0.7,
        repetition_penalty: 1.1,
      },
    });

    // 4. Retornar a resposta
    return {reply: response.generated_text};
  } catch (error) {
    logger.error("Ocorreu um erro no processo da função:", error);
    throw new HttpsError(
        "internal",
        "Não foi possível processar a resposta do modelo de IA.",
    );
  }
});
