import os
import google.generativeai as genai
import firebase_admin
from firebase_admin import credentials, firestore
from flask import Flask, request, jsonify
from flask_cors import CORS

# --- Configuração Inicial ---

# Inicializa o Flask App
app = Flask(__name__)
# Permite que o seu site (frontend) possa fazer chamadas a este servidor
CORS(app)

# Carrega as credenciais para aceder ao Firebase a partir de um ficheiro local.
# IMPORTANTE: Descarregue o seu ficheiro de credenciais da consola do Google Cloud
# e renomeie-o para "serviceAccountKey.json" na mesma pasta que este ficheiro.
try:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("Firebase inicializado com sucesso.")
except Exception as e:
    print(f"Erro ao inicializar o Firebase: {e}")
    db = None

# Configura a API do Gemini
# IMPORTANTE: Crie uma chave de API na Google AI Studio e defina-a como uma variável de ambiente.
# No terminal, antes de executar o ficheiro, faça: export GOOGLE_API_KEY="SUA_CHAVE_AQUI"
try:
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("A variável de ambiente GOOGLE_API_KEY não foi definida.")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    print("Modelo Gemini configurado com sucesso.")
except Exception as e:
    print(f"Erro ao configurar o Gemini: {e}")
    model = None

# --- Funções Auxiliares ---

def get_knowledge_base():
    """Busca todo o conhecimento da coleção 'perguntas_respostas' no Firestore."""
    if not db:
        return "Erro: A base de dados Firestore não foi inicializada."
    
    docs = db.collection('perguntas_respostas').stream()
    knowledge_base = ""
    for doc in docs:
        data = doc.to_dict()
        knowledge_base += f"Pergunta: {data.get('pergunta', '')}\nResposta: {data.get('resposta', '')}\n\n"
    
    return knowledge_base if knowledge_base else "Nenhum conhecimento foi encontrado."

def format_prompt(knowledge, query):
    """Formata o prompt final para ser enviado ao modelo Gemini."""
    system_instructions = (
        "Você é um assistente virtual interno chamado \"G-Bot\". "
        "Seja prestável, direto e amigável. "
        "Responda à pergunta do utilizador usando apenas o CONHECIMENTO FORNECIDO. "
        "Se a resposta não estiver no conhecimento, diga que não tem a informação e não invente nada."
    )
    
    return (
        f"{system_instructions}\n\n"
        f"--- CONHECIMENTO FORNECIDO ---\n"
        f"{knowledge}\n"
        f"---\n\n"
        f"PERGUNTA DO UTILIZADOR:\n"
        f"\"{query}\""
    )

# --- Rota da API ---

@app.route('/ask', methods=['POST'])
def ask_gemini():
    """Recebe uma pergunta, busca o conhecimento e consulta o Gemini."""
    if not model or not db:
        return jsonify({"error": "O servidor não foi inicializado corretamente. Verifique os logs."}), 500

    data = request.get_json()
    if not data or 'query' not in data:
        return jsonify({"error": "O campo 'query' é obrigatório."}), 400

    user_query = data['query']
    
    try:
        # 1. Obter a base de conhecimento
        knowledge = get_knowledge_base()
        
        # 2. Formatar o prompt
        final_prompt = format_prompt(knowledge, user_query)
        
        # 3. Chamar a API do Gemini
        response = model.generate_content(final_prompt)
        
        # 4. Retornar a resposta
        return jsonify({"reply": response.text})

    except Exception as e:
        print(f"Ocorreu um erro: {e}")
        return jsonify({"error": "Não foi possível processar a resposta do modelo de IA."}), 500

# --- Execução do Servidor ---

if __name__ == '__main__':
    # Executa o servidor na porta 8080, acessível na sua rede local.
    app.run(host='0.0.0.0', port=8080, debug=True)
