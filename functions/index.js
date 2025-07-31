// Importações de Módulos Essenciais
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {getAuth} = require("firebase-admin/auth");
const {HfInference} = require("@huggingface/inference");
const logger = require("firebase-functions/logger");
const {defineString} = require("firebase-functions/params");

// --- Configuração Inicial ---
const hfApiKey = defineString("HUGGINGFACE_API_KEY");
initializeApp();

// --- Funções Auxiliares (EXISTENTES) ---
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

function formatPrompt(knowledge, query) {
  const systemInstructions = [
    "Você é um assistente virtual interno chamado \"G-Bot\".",
    "Seja prestável, direto e amigável.",
    "Responda à pergunta do utilizador usando apenas o CONHECIMENTO FORNECIDO.",
    "Se a resposta não estiver no conhecimento, diga que não tem a informação.",
  ].join(" ");
  const knowledgeBlock = [
    "--- CONHECIMENTO FORNECIDO ---",
    knowledge,
    "---",
    `PERGUNTA DO UTILIZADOR:\n"${query}"`,
  ].join("\n");
  return `<s>[INST] ${systemInstructions} \n\n ${knowledgeBlock} [/INST]`;
}

// --- Cloud Function Principal (EXISTENTE) ---
exports.askHuggingFace = onCall(async (request) => {
  const userQuery = request.data.query;
  if (!userQuery) {
    logger.error("A função foi chamada sem o parâmetro 'query'.");
    throw new HttpsError("invalid-argument", "A função precisa de receber um parâmetro 'query'.");
  }
  try {
    const knowledge = await getKnowledgeBase();
    const finalPrompt = formatPrompt(knowledge, userQuery);
    const hf = new HfInference(hfApiKey.value());
    const response = await hf.textGeneration({
      model: "mistralai/Mistral-7B-Instruct-v0.2",
      inputs: finalPrompt,
      parameters: { max_new_tokens: 250, temperature: 0.7, repetition_penalty: 1.1 },
    });
    return {reply: response.generated_text};
  } catch (error) {
    logger.error("Ocorreu um erro no processo da função:", error);
    throw new HttpsError("internal", "Não foi possível processar a resposta do modelo de IA.");
  }
});

// --- FUNÇÃO PARA DEFINIR ADMINS (COM SEGURANÇA REATIVADA) ---
exports.setAdminRole = onCall(async (request) => {
  // A verificação de segurança foi reativada.
  if (request.auth.token.admin !== true) {
    logger.warn("Utilizador não-admin tentou definir um novo admin.", {uid: request.auth.uid});
    throw new HttpsError(
      "permission-denied",
      "Apenas administradores podem adicionar outros administradores."
    );
  }

  const email = request.data.email;
  if (!email) {
    throw new HttpsError("invalid-argument", "O email é obrigatório.");
  }

  try {
    const user = await getAuth().getUserByEmail(email);
    await getAuth().setCustomUserClaims(user.uid, { admin: true });
    logger.info(`Utilizador ${email} (UID: ${user.uid}) foi promovido a admin por ${request.auth.uid}.`);
    return { message: `Sucesso! ${email} agora é um administrador.` };
  } catch (error) {
    logger.error("Erro ao definir a função de admin para o email:", {email: email, error: error});
    throw new HttpsError("internal", "Não foi possível encontrar o utilizador ou definir a permissão.");
  }
});
