/**
 * SOCRATIC AI COMPANION SCRIPT
 * Integrates UI logic, LocalStorage state management, and Gemini API.
 */

// --- Configuration & Constants ---
const STORAGE_KEY = "socratic_sessions_v1";
const ACTIVE_KEY = "socratic_active_session_id";

const SYSTEM_PROMPT = `Anda adalah Socratic, asisten AI canggih yang dirancang khusus sebagai teman belajar dan riset (Study & Research Companion). 
Tujuan utama Anda BUKAN hanya memberikan jawaban langsung, melainkan membantu pengguna memahami konsep rumit secara mendalam, terstruktur, dan interaktif.
Gunakan prinsip berikut:
1. Akademik & Profesional: Gunakan bahasa Indonesia yang baku, profesional, cerdas, namun mudah dipahami.
2. Analitik & Terstruktur: Pecah konsep rumit menjadi bagian-bagian kecil (Feynman Technique). Gunakan formatting markdown (bullet points, bold, headings) agar rapi.
3. Metode Socratic: Jika diminta menguji pemahaman, jangan berikan jawaban. Ajukan pertanyaan menantang secara bertahap untuk memandu pengguna menemukan jawabannya sendiri.
4. Akurat & Objektif: Fokus pada fakta ilmiah, data, dan logika akademis.`;

const WELCOME_MESSAGE = `Halo. Saya **Socratic**, asisten riset dan pembelajaran Anda. 

Saya siap membantu Anda membedah jurnal, memahami teori kompleks, menyusun kerangka tulisan, atau menguji pemahaman Anda melalui metode dialektika.

Topik akademis atau profesional apa yang ingin kita eksplorasi hari ini?`;

let sessions = [];
let activeSessionId = null;
let isGenerating = false;

const chatWidget = document.getElementById("chat-widget");
const chatLauncher = document.getElementById("chat-launcher");
const historyDrawer = document.getElementById("history-drawer");
const chatArea = document.getElementById("chat-area");
const sessionListEl = document.getElementById("session-list");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const typingIndicator = document.getElementById("typing-indicator");

function init() {
  loadState();
  if (sessions.length === 0) {
    createNewSession("Sesi Belajar Baru", false);
  } else {
    renderSessionList();
    renderActiveChat();
  }
  setupEventListeners();
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) sessions = JSON.parse(stored);
    activeSessionId = localStorage.getItem(ACTIVE_KEY);

    // Validation
    if (activeSessionId && !sessions.find((s) => s.id === activeSessionId)) {
      activeSessionId = sessions.length > 0 ? sessions[0].id : null;
    }
  } catch (e) {
    console.error("Storage error:", e);
    sessions = [];
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  if (activeSessionId) localStorage.setItem(ACTIVE_KEY, activeSessionId);
}

function createNewSession(title = "Sesi Belajar Baru", render = true) {
  const newSession = {
    id: "sess_" + Date.now().toString(36),
    title: title,
    date: new Date().toISOString(),
    messages: [{ role: "model", text: WELCOME_MESSAGE }],
  };

  sessions.unshift(newSession);
  activeSessionId = newSession.id;
  saveState();

  if (render) {
    renderSessionList();
    renderActiveChat();
    historyDrawer.classList.remove("open");
  }

  setTimeout(() => userInput.focus(), 100);
  return newSession;
}

function switchSession(id) {
  if (activeSessionId === id || isGenerating) return;
  activeSessionId = id;
  saveState();
  renderSessionList();
  renderActiveChat();
  historyDrawer.classList.remove("open");
}

function deleteSession(id, event) {
  event.stopPropagation();
  if (isGenerating) return;

  sessions = sessions.filter((s) => s.id !== id);
  if (activeSessionId === id) {
    activeSessionId = sessions.length > 0 ? sessions[0].id : null;
    if (!activeSessionId) createNewSession("Sesi Belajar Baru", false);
  }

  saveState();
  renderSessionList();
  renderActiveChat();
}

function renderSessionList() {
  sessionListEl.innerHTML = "";
  if (sessions.length === 0) {
    sessionListEl.innerHTML =
      '<div style="text-align:center; color: var(--text-muted); margin-top: 20px; font-size: 0.85rem;">Belum ada riwayat sesi.</div>';
    return;
  }

  sessions.forEach((session) => {
    const dateStr = new Date(session.date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });
    const isActive = session.id === activeSessionId;

    const div = document.createElement("div");
    div.className = `session-item ${isActive ? "active" : ""}`;
    div.onclick = () => switchSession(session.id);

    div.innerHTML = `
          <div class="session-meta">
            <div class="session-title">${escapeHTML(session.title)}</div>
            <div class="session-date">${dateStr} · ${session.messages.length} pertukaran</div>
          </div>
          <button class="delete-btn" onclick="deleteSession('${session.id}', event)"><i class="fa-solid fa-trash-can"></i></button>
        `;
    sessionListEl.appendChild(div);
  });
}

function renderActiveChat() {
  
  const msgs = chatArea.querySelectorAll(".message");
  msgs.forEach((m) => m.remove());

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  if (!activeSession) return;

  activeSession.messages.forEach((msg) => {
    appendMessageUI(msg.role, msg.text, false);
  });
  scrollToBottom();
}

function appendMessageUI(role, text, animate = true) {
  const div = document.createElement("div");
  div.className = `message ${role === "user" ? "user" : "bot"}`;
  
  if (animate) {
    div.style.opacity = "0";
    div.style.transform = "translateY(10px)";
    div.style.transition = "all 0.3s ease";
  }

  const iconClass = role === "user" ? "fa-user" : "fa-brain";
  const formattedText = role === "model" ? formatMarkdown(text) : escapeHTML(text).replace(/\n/g, "<br>");

  div.innerHTML = `
    <div class="msg-icon"><i class="fa-solid ${iconClass}"></i></div>
    <div class="msg-bubble">${formattedText}</div>
  `;

  chatArea.appendChild(div);

  if (animate) {
    setTimeout(() => {
      div.style.opacity = "1";
      div.style.transform = "translateY(0)";
    }, 10);
  }
  
  scrollToBottom();
}

// --- UI Interactions ---
function toggleChat() {
  const isOpen = chatWidget.classList.contains("open");
  if (isOpen) {
    chatWidget.classList.remove("open");
    chatLauncher.classList.remove("active");
    historyDrawer.classList.remove("open");
  } else {
    chatWidget.classList.add("open");
    chatLauncher.classList.add("active");
    setTimeout(() => {
      userInput.focus();
      scrollToBottom();
    }, 200);
  }
}

function toggleHistory() {
  historyDrawer.classList.toggle("open");
}

function startWithPrompt(text) {
  toggleChat();
  if (!isGenerating) {
    userInput.value = text;
    adjustTextareaHeight();
    setTimeout(() => handleSubmission(), 300);
  }
}

function adjustTextareaHeight() {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
}

function scrollToBottom() {
  setTimeout(() => {
    chatArea.scrollTop = chatArea.scrollHeight;
  }, 50);
}

// --- Core Logic & API ---
function setupEventListeners() {
  userInput.addEventListener("input", adjustTextareaHeight);

  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmission();
    }
  });

  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSubmission();
  });
}

async function handleSubmission() {
  const text = userInput.value.trim();
  if (!text || isGenerating) return;

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  if (!activeSession) return;

  if (activeSession.messages.length === 1 && activeSession.title === "Sesi Belajar Baru") {
    activeSession.title = text.length > 30 ? text.substring(0, 30) + "..." : text;
  }

  activeSession.messages.push({ role: "user", text: text });
  activeSession.date = new Date().toISOString();
  saveState();
  renderSessionList();
  appendMessageUI("user", text);

  userInput.value = "";
  adjustTextareaHeight();
  isGenerating = true;
  sendBtn.disabled = true;
  typingIndicator.style.display = "flex";
  scrollToBottom();

  const chatHistory = activeSession.messages.map((m) => ({
    role: m.role,
    text: m.text,
  }));

  try {
    const response = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation: chatHistory }),
    });

    const result = await response.json();

    if (result.result) {
      const modelText = result.result;

      activeSession.messages.push({ role: "model", text: modelText });
      activeSession.date = new Date().toISOString();
      saveState();

      typingIndicator.style.display = "none";
      appendMessageUI("model", modelText);
    } else {
      throw new Error("Invalid API response format");
    }
  } catch (error) {
    console.error("API Error:", error);
    typingIndicator.style.display = "none";
    appendMessageUI(
      "model",
      "Mohon maaf, terjadi gangguan koneksi ke server lokal. Pastikan server Node.js sudah berjalan."
    );
  } finally {
    isGenerating = false;
    sendBtn.disabled = false;
    renderSessionList();
    setTimeout(() => userInput.focus(), 100);
  }
}

// --- Utilities ---
function escapeHTML(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatMarkdown(text) {
  if (!text) return "";
  try {
    if (typeof marked !== "undefined" && typeof DOMPurify !== "undefined") {
      // Configure marked to use breaks for newlines
      marked.setOptions({ breaks: true, gfm: true });
      const rawHtml = marked.parse(text);
      return DOMPurify.sanitize(rawHtml);
    }
  } catch (e) {
    console.warn("Markdown parsing failed:", e);
  }
  return escapeHTML(text).replace(/\n/g, "<br>");
}

// Start App
document.addEventListener("DOMContentLoaded", init);
