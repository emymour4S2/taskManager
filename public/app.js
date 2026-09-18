/**
 * ==============================================================================
 * APLICATIVO WEB DE GERENCIAMENTO DE TAREFAS - JAVASCRIPT VANILLA & FIREBASE
 * ==============================================================================
 * 
 * Instrutor: Guia Didático passo a passo
 * Tecnologias: HTML5, CSS3, JavaScript Vanilla (ES Modules) e Firebase Firestore v9+
 */

// Importação das funções do SDK Modular do Firebase v9+ via CDN oficial do Google
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  deleteDoc, 
  updateDoc, 
  serverTimestamp,
  query,
  orderBy 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

/* ==============================================================================
   1. CONFIGURAÇÃO DO PROJETO FIREBASE
   As credenciais conectam o frontend à sua instância do Google Cloud Firestore.
   ============================================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyAmw9M_STS17f3fSYkB_7Wmw...",
  authDomain: "teste-senai-18839...",
  projectId: "teste-senai-18839",
  storageBucket: "teste-senai-188...",
  messagingSenderId: "3561...",
  appId: "1:356153984202:web:...3",
  measurementId: "G-MLR..."
};

/* ==============================================================================
   2. INICIALIZAÇÃO DO FIREBASE E FIRESTORE
   - initializeApp: cria a instância da aplicação Firebase no navegador.
   - getFirestore: inicializa o serviço de banco de dados NoSQL Cloud Firestore.
   ============================================================================== */
let app;
let db;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log("Firebase inicializado com sucesso!");
} catch (error) {
  console.warn("Aviso na inicialização do Firebase:", error);
}

// Referência à coleção "tarefas" no Firestore
const colecaoTarefas = db ? collection(db, "tarefas") : null;

/* ==============================================================================
   SELEÇÃO DOS ELEMENTOS DO DOM
   Mapeamos os elementos da interface criados no index.html para manipulação.
   ============================================================================== */
const inputTarefa = document.getElementById("inputTarefa");
const btnAdicionar = document.getElementById("btnAdicionar");
const listaTarefas = document.getElementById("listaTarefas");
const contadorTarefas = document.getElementById("contadorTarefas");
const emptyState = document.getElementById("emptyState");
const statusConexao = document.getElementById("statusConexao");
const mensagemFeedback = document.getElementById("mensagemFeedback");

// Armazenamento local de contingência para garantir que a interface funcione no preview
// caso as credenciais fornecidas contenham reticências ("...") de exemplo
let tarefasMemoria = [
  { id: "demo-1", texto: "Finalizar protótipo do Design System", concluida: false, data: new Date() },
  { id: "demo-2", texto: "Revisar pull request da API de autenticação", concluida: false, data: new Date() },
  { id: "demo-3", texto: "Comprar frutas e café no mercado", concluida: true, data: new Date() }
];

/* ==============================================================================
   3. FUNÇÃO PARA ADICIONAR NOVA TAREFA
   Captura o texto digitado pelo usuário e utiliza 'addDoc' para salvar no Firestore.
   ============================================================================== */
async function adicionarTarefa() {
  const texto = inputTarefa.value.trim();

  // Validação simples: não permite salvar tarefas em branco
  if (!texto) {
    exibirFeedback("Por favor, digite uma descrição para a tarefa.");
    inputTarefa.focus();
    return;
  }

  // Feedback visual no botão enquanto a requisição é processada
  btnAdicionar.disabled = true;
  btnAdicionar.textContent = "Salvando...";

  try {
    // Tentativa de salvar diretamente no Firestore
    if (db && colecaoTarefas && !firebaseConfig.apiKey.includes("...")) {
      await addDoc(colecaoTarefas, {
        texto: texto,
        concluida: false,
        criadoEm: serverTimestamp() // Garante o timestamp oficial do servidor Google
      });
      console.log("Tarefa salva com sucesso no Firestore:", texto);
    } else {
      // Modo de demonstração (quando as chaves do Firebase possuem reticências)
      const novaTarefaLocal = {
        id: "local-" + Date.now(),
        texto: texto,
        concluida: false,
        criadoEm: new Date()
      };
      tarefasMemoria.unshift(novaTarefaLocal);
      renderizarTarefas(tarefasMemoria);
      exibirFeedback("Nota: Como as chaves do Firebase possuem reticências de exemplo, a tarefa foi registrada em modo de demonstração local.", "info");
    }

    // Limpa o campo de texto e devolve o foco para facilitar novas digitações
    inputTarefa.value = "";
    inputTarefa.focus();
  } catch (erro) {
    console.error("Erro ao adicionar tarefa no Firestore:", erro);
    // Contingência elegante para permitir testar a interface
    const novaTarefaLocal = {
      id: "local-" + Date.now(),
      texto: texto,
      concluida: false,
      criadoEm: new Date()
    };
    tarefasMemoria.unshift(novaTarefaLocal);
    renderizarTarefas(tarefasMemoria);
    exibirFeedback("Salvo localmente (Verifique as credenciais do seu projeto Firebase no app.js)", "info");
    inputTarefa.value = "";
    inputTarefa.focus();
  } finally {
    // Restaura o botão ao estado normal
    btnAdicionar.disabled = false;
    btnAdicionar.innerHTML = `
      <svg class="btn-icon" viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
        <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
      </svg>
      Adicionar Tarefa
    `;
  }
}

/* ==============================================================================
   4. FUNÇÃO PARA ACOMPANHAR A COLEÇÃO EM TEMPO REAL (onSnapshot)
   Ouvinte em tempo real: qualquer alteração no banco atualiza a interface
   automaticamente sem necessidade de recarregar a página.
   ============================================================================== */
function monitorarTarefasEmTempoReal() {
  if (!db || !colecaoTarefas || firebaseConfig.apiKey.includes("...")) {
    atualizarStatusConexao(false, "Modo Demonstração (Chaves com reticências)");
    renderizarTarefas(tarefasMemoria);
    return;
  }

  try {
    // Consulta ordenando por data de criação decrescente (mais recentes primeiro)
    const q = query(colecaoTarefas, orderBy("criadoEm", "desc"));

    // O onSnapshot escuta modificações no Firestore em tempo real
    onSnapshot(q, (snapshot) => {
      const tarefas = [];
      snapshot.forEach((documento) => {
        tarefas.push({
          id: documento.id,
          ...documento.data()
        });
      });

      console.log(`Recebidas ${tarefas.length} tarefas do Firestore em tempo real.`);
      atualizarStatusConexao(true, "Conectado ao Firestore");
      renderizarTarefas(tarefas);
    }, (erro) => {
      console.warn("onSnapshot com credenciais de exemplo:", erro.message);
      atualizarStatusConexao(false, "Modo Demonstração");
      renderizarTarefas(tarefasMemoria);
    });

  } catch (erro) {
    console.warn("Erro ao configurar listener do Firestore:", erro);
    atualizarStatusConexao(false, "Modo Demonstração");
    renderizarTarefas(tarefasMemoria);
  }
}

/* ==============================================================================
   5. FUNÇÃO DE RENDERIZAÇÃO DA LISTA DE TAREFAS
   Cria dinamicamente os elementos <li> para cada item da lista.
   ============================================================================== */
function renderizarTarefas(tarefas) {
  // Limpa a lista atual para re-renderizar
  listaTarefas.innerHTML = "";

  // Atualiza o contador de tarefas
  const total = tarefas.length;
  contadorTarefas.textContent = `${total} ${total === 1 ? 'tarefa' : 'tarefas'}`;

  // Se não houver tarefas, exibe a mensagem de lista vazia
  if (total === 0) {
    emptyState.style.display = "flex";
    return;
  } else {
    emptyState.style.display = "none";
  }

  // Cria um elemento <li> para cada tarefa
  tarefas.forEach((tarefa) => {
    const li = document.createElement("li");
    li.className = `task-item ${tarefa.concluida ? "completed" : ""}`;
    li.dataset.id = tarefa.id;

    // Container do conteúdo da tarefa
    const contentDiv = document.createElement("div");
    contentDiv.className = "task-content";

    // Botão circular de alternar conclusão (Checkbox estilizado)
    const btnToggle = document.createElement("button");
    btnToggle.type = "button";
    btnToggle.className = "btn-toggle-task";
    btnToggle.title = tarefa.concluida ? "Marcar como pendente" : "Marcar como concluída";
    btnToggle.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
    btnToggle.addEventListener("click", () => alternarConclusaoTarefa(tarefa.id, !tarefa.concluida));

    // Texto da tarefa
    const spanTexto = document.createElement("span");
    spanTexto.className = "task-text";
    spanTexto.textContent = tarefa.texto || "Tarefa sem descrição";

    contentDiv.appendChild(btnToggle);
    contentDiv.appendChild(spanTexto);

    // Botão de excluir tarefa
    const btnExcluir = document.createElement("button");
    btnExcluir.type = "button";
    btnExcluir.className = "btn-delete-task";
    btnExcluir.title = "Excluir tarefa";
    btnExcluir.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
    `;
    btnExcluir.addEventListener("click", () => excluirTarefa(tarefa.id));

    li.appendChild(contentDiv);
    li.appendChild(btnExcluir);

    listaTarefas.appendChild(li);
  });
}

/* ==============================================================================
   6. FUNÇÕES AUXILIARES DE GERENCIAMENTO (Alternar status e Excluir)
   ============================================================================== */

// Alterna o status de concluído utilizando updateDoc no Firestore
async function alternarConclusaoTarefa(id, novoStatus) {
  try {
    if (db && !id.startsWith("local-") && !id.startsWith("demo-")) {
      const docRef = doc(db, "tarefas", id);
      await updateDoc(docRef, { concluida: novoStatus });
    } else {
      // Atualização local na memória
      const item = tarefasMemoria.find(t => t.id === id);
      if (item) item.concluida = novoStatus;
      renderizarTarefas(tarefasMemoria);
    }
  } catch (erro) {
    console.error("Erro ao atualizar tarefa:", erro);
  }
}

// Remove o documento da coleção utilizando deleteDoc no Firestore
async function excluirTarefa(id) {
  try {
    if (db && !id.startsWith("local-") && !id.startsWith("demo-")) {
      const docRef = doc(db, "tarefas", id);
      await deleteDoc(docRef);
    } else {
      // Exclusão local na memória
      tarefasMemoria = tarefasMemoria.filter(t => t.id !== id);
      renderizarTarefas(tarefasMemoria);
    }
  } catch (erro) {
    console.error("Erro ao excluir tarefa:", erro);
  }
}

// Exibe mensagem informativa amigável temporária
function exibirFeedback(mensagem, tipo = "erro") {
  mensagemFeedback.textContent = mensagem;
  mensagemFeedback.style.display = "block";
  if (tipo === "info") {
    mensagemFeedback.style.backgroundColor = "#EFF6FF";
    mensagemFeedback.style.borderColor = "#93C5FD";
    mensagemFeedback.style.color = "#1E40AF";
  } else {
    mensagemFeedback.style.backgroundColor = "#FEF2F2";
    mensagemFeedback.style.borderColor = "#FCA5A5";
    mensagemFeedback.style.color = "#991B1B";
  }
  setTimeout(() => {
    mensagemFeedback.style.display = "none";
  }, 4000);
}

// Atualiza o indicador visual de conexão do Firestore
function atualizarStatusConexao(ativo, texto) {
  const dot = statusConexao.querySelector(".status-dot");
  const label = statusConexao.querySelector(".status-label");
  if (ativo) {
    dot.style.backgroundColor = "var(--color-success)";
    label.textContent = texto;
  } else {
    dot.style.backgroundColor = "var(--color-secondary)";
    label.textContent = texto;
  }
}

/* ==============================================================================
   7. REGISTRO DE EVENTOS (LISTENERS)
   ============================================================================== */

// Clique no botão "Adicionar Tarefa"
btnAdicionar.addEventListener("click", adicionarTarefa);

// Pressionar a tecla "Enter" no campo de entrada
inputTarefa.addEventListener("keypress", (evento) => {
  if (evento.key === "Enter") {
    evento.preventDefault();
    adicionarTarefa();
  }
});

// Inicializa o ouvinte em tempo real assim que a página carregar
window.addEventListener("DOMContentLoaded", () => {
  console.log("Taskflow iniciado com sucesso.");
  monitorarTarefasEmTempoReal();
});
