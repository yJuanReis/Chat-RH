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

// --- Funções Auxiliares ---

/**
 * Busca todo o conhecimento da coleção 'perguntas_respostas' no Firestore.
 * @return {Promise<string>} Uma string formatada com todo o conhecimento.
 */
async function getKnowledgeBase() {
  const db = getFirestore();
  const snapshot = await db.collection("perguntas_respostas").get();
  if (snapshot.empty) {
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

// --- Cloud Functions ---

/**
 * Função principal que interage com a API do Hugging Face.
 */
exports.askHuggingFace = onCall(async (request) => {
  const userQuery = request.data.query;
  if (!userQuery) {
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

/**
 * Define um utilizador como administrador através de custom claims.
 * Apenas um administrador já existente pode chamar esta função.
 */
exports.setAdminRole = onCall(async (request) => {
  if (request.auth.token.admin !== true) {
    throw new HttpsError("permission-denied", "Apenas administradores podem adicionar outros administradores.");
  }
  const email = request.data.email;
  if (!email) {
    throw new HttpsError("invalid-argument", "O email é obrigatório.");
  }
  try {
    const user = await getAuth().getUserByEmail(email);
    await getAuth().setCustomUserClaims(user.uid, { admin: true });
    return { message: `Sucesso! ${email} agora é um administrador.` };
  } catch (error) {
    logger.error("Erro ao definir a função de admin para o email:", {email: email, error: error});
    throw new HttpsError("internal", "Não foi possível encontrar o utilizador ou definir a permissão.");
  }
});

/**
 * Cria um novo utilizador no sistema.
 * Apenas um administrador pode chamar esta função.
 */
exports.createUser = onCall(async (request) => {
  if (request.auth.token.admin !== true) {
    throw new HttpsError("permission-denied", "Apenas administradores podem criar novos utilizadores.");
  }

  const { email, password, displayName, role } = request.data;
  if (!email || !password || !displayName || !role) {
    throw new HttpsError("invalid-argument", "Todos os campos (nome, e-mail, senha, tipo) são obrigatórios.");
  }

  try {
    const userRecord = await getAuth().createUser({
      email: email,
      password: password,
      displayName: displayName,
    });

    if (role === 'admin') {
      await getAuth().setCustomUserClaims(userRecord.uid, { admin: true });
    }

    const db = getFirestore();
    await db.collection('users').doc(userRecord.uid).set({
      displayName: displayName,
      email: email,
      role: role,
    });

    return { message: `Utilizador ${displayName} criado com sucesso.` };
  } catch (error) {
    logger.error("Erro ao criar novo utilizador:", { email: email, error: error });
    if (error.code === 'auth/email-already-exists') {
        throw new HttpsError("already-exists", "Este e-mail já está a ser utilizado.");
    }
    throw new HttpsError("internal", "Ocorreu um erro ao criar o utilizador.");
  }
});

/**
 * Lista todos os utilizadores do sistema.
 * Apenas um administrador pode chamar esta função.
 */
exports.listUsers = onCall(async (request) => {
    if (request.auth.token.admin !== true) {
        throw new HttpsError("permission-denied", "Apenas administradores podem listar utilizadores.");
    }
    try {
        const userRecords = await getAuth().listUsers(1000);
        const users = userRecords.users.map((user) => ({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'Sem nome',
            role: user.customClaims && user.customClaims.admin ? 'admin' : 'comum',
        }));
        return { users: users };
    } catch (error) {
        logger.error("Erro ao listar utilizadores:", error);
        throw new HttpsError("internal", "Ocorreu um erro ao buscar a lista de utilizadores.");
    }
});
