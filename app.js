// --- Supabase ayarları (kütüphane gerektirmez) ---
const SUPABASE_URL = "https://lowcsekzsnskshhayrdb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxvd2NzZWt6c25za3NoaGF5cmRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTA4NTIsImV4cCI6MjA5NjE2Njg1Mn0.sY9UATk-u1Kh5S135l_WDbLNS-6AiCo9AHiISx02V1g";

const AUTH = SUPABASE_URL + "/auth/v1";
const REST = SUPABASE_URL + "/rest/v1/todos";

// localStorage'da saklanan oturum
let session = JSON.parse(localStorage.getItem("sb_session") || "null");

function saveSession(s) {
  session = s;
  localStorage.setItem("sb_session", JSON.stringify(s));
}
function clearSession() {
  session = null;
  localStorage.removeItem("sb_session");
}

// ====================== KİMLİK DOĞRULAMA ======================

async function authRequest(path, body) {
  const res = await fetch(AUTH + path, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.msg || data.message || "Hata");
  }
  return data;
}

async function register(email, password) {
  const data = await authRequest("/signup", { email, password });
  // E-posta onayı kapalı olduğundan signup doğrudan oturum döndürür
  if (data.access_token) {
    saveSession(data);
    return data;
  }
  // Yine de oturum gelmediyse normal giriş yap
  return login(email, password);
}

async function login(email, password) {
  const data = await authRequest("/token?grant_type=password", { email, password });
  saveSession(data);
  return data;
}

// Süresi dolan access_token'ı yenile
async function refreshSession() {
  if (!session || !session.refresh_token) return false;
  try {
    const data = await authRequest("/token?grant_type=refresh_token", {
      refresh_token: session.refresh_token,
    });
    saveSession(data);
    return true;
  } catch {
    clearSession();
    return false;
  }
}

function logout() {
  clearSession();
  showAuthScreen();
}

// ====================== VERİ (kullanıcının görevleri) ======================

async function api(method, query = "", body = null, returnData = false, retry = true) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: "Bearer " + session.access_token, // kullanıcının JWT'si
    "Content-Type": "application/json",
  };
  if (returnData) headers["Prefer"] = "return=representation";

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(REST + query, opts);

  // Token süresi dolduysa bir kez yenileyip tekrar dene
  if (res.status === 401 && retry) {
    const ok = await refreshSession();
    if (ok) return api(method, query, body, returnData, false);
    logout();
    throw new Error("Oturum sona erdi, lütfen tekrar giriş yap");
  }

  if (!res.ok) {
    const txt = await res.text();
    throw new Error("HTTP " + res.status + " — " + txt);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ====================== DOM ======================

const authScreen = document.getElementById("auth-screen");
const todoScreen = document.getElementById("todo-screen");
const authForm = document.getElementById("auth-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const registerBtn = document.getElementById("register-btn");
const authMsg = document.getElementById("auth-msg");
const userEmail = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");

const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const countEl = document.getElementById("count");
const clearBtn = document.getElementById("clear-done");
const filters = document.getElementById("filters");
const dueInput = document.getElementById("due-input");

// --- Tema seçici ---
const themeSelect = document.getElementById("theme-select");
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem("theme", t);
  themeSelect.value = t;
}
themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
applyTheme(localStorage.getItem("theme") || "ironman");

let todos = [];
let filter = "all";

function showError(msg) {
  countEl.textContent = "⚠️ " + msg;
  console.error(msg);
}
function setAuthMsg(msg, type) {
  authMsg.textContent = msg;
  authMsg.className = "auth-msg" + (type ? " " + type : "");
}

// ====================== EKRAN GEÇİŞLERİ ======================

function showAuthScreen() {
  authScreen.hidden = false;
  todoScreen.hidden = true;
}

function showTodoScreen() {
  authScreen.hidden = true;
  todoScreen.hidden = false;
  userEmail.textContent = session.user ? session.user.email : "";
  load();
}

// ====================== TODO İŞLEMLERİ ======================

async function load() {
  try {
    todos = await api("GET", "?select=*&order=created_at.asc");
    render();
  } catch (e) {
    showError("Yüklenemedi: " + e.message);
  }
}

function render() {
  const visible = todos.filter((t) => {
    if (filter === "active") return !t.done;
    if (filter === "done") return t.done;
    return true;
  });

  list.innerHTML = "";

  if (visible.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Görev yok 🎉";
    list.appendChild(li);
  }

  visible.forEach((todo) => {
    const li = document.createElement("li");
    li.className = "todo-item" + (todo.done ? " done" : "");
    li.dataset.id = todo.id;
    li.dataset.due = todo.due_at || "";
    li.dataset.done = todo.done ? "1" : "";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.done;
    checkbox.addEventListener("change", () => toggle(todo));

    const main = document.createElement("div");
    main.className = "todo-main";

    const span = document.createElement("span");
    span.className = "text";
    span.textContent = todo.text;
    main.appendChild(span);

    if (todo.due_at) {
      const due = document.createElement("span");
      due.className = "due";
      main.appendChild(due);
    }

    const del = document.createElement("button");
    del.className = "delete";
    del.innerHTML = "&times;";
    del.setAttribute("aria-label", "Sil");
    del.addEventListener("click", () => remove(todo.id));

    li.append(checkbox, main, del);
    list.appendChild(li);
  });

  const remaining = todos.filter((t) => !t.done).length;
  countEl.textContent = `${remaining} görev kaldı`;
  updateUrgency();
}

// Kalan süreyi metne çevir
function formatRemaining(ms) {
  if (ms < 0) return "⏰ Süresi geçti";
  const min = Math.round(ms / 60000);
  if (min < 60) return `⏰ ${min} dk kaldı`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `⏰ ${hr} saat kaldı`;
  const day = Math.round(hr / 24);
  return `⏰ ${day} gün kaldı`;
}

// Kalan süre etiketlerini ve "acil" (kırmızı yanıp sönme) durumunu güncelle.
// Tam yeniden çizim yapmaz; sadece zaman ve sınıfı tazeler.
function updateUrgency() {
  const now = Date.now();
  const URGENT_MS = 60 * 60 * 1000; // son 1 saat veya geçmiş → acil
  document.querySelectorAll(".todo-item[data-id]").forEach((li) => {
    const dueStr = li.dataset.due;
    const dueEl = li.querySelector(".due");
    if (!dueStr || !dueEl) return;
    const diff = new Date(dueStr).getTime() - now;
    dueEl.textContent = formatRemaining(diff);
    const urgent = !li.dataset.done && diff <= URGENT_MS;
    li.classList.toggle("urgent", urgent);
  });
}

// Zaman ilerledikçe etiketleri/yanıp sönmeyi tazele
setInterval(updateUrgency, 20000);

async function addTodo(text, dueIso) {
  try {
    const body = { text };
    if (dueIso) body.due_at = dueIso; // isteğe bağlı son tarih
    const rows = await api("POST", "", body, true); // user_id otomatik (auth.uid())
    todos.push(rows[0]);
    render();
  } catch (e) {
    showError("Eklenemedi: " + e.message);
  }
}

async function toggle(todo) {
  try {
    const rows = await api("PATCH", "?id=eq." + todo.id, { done: !todo.done }, true);
    const i = todos.findIndex((t) => t.id === todo.id);
    if (i !== -1) todos[i] = rows[0];
    render();
  } catch (e) {
    showError("Güncellenemedi: " + e.message);
  }
}

async function remove(id) {
  try {
    await api("DELETE", "?id=eq." + id);
    todos = todos.filter((t) => t.id !== id);
    render();
  } catch (e) {
    showError("Silinemedi: " + e.message);
  }
}

async function clearDone() {
  try {
    await api("DELETE", "?done=eq.true");
    todos = todos.filter((t) => !t.done);
    render();
  } catch (e) {
    showError("Temizlenemedi: " + e.message);
  }
}

// ====================== OLAYLAR ======================

// Giriş yap (form submit)
authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthMsg("Giriş yapılıyor...", "");
  try {
    await login(emailInput.value.trim(), passwordInput.value);
    showTodoScreen();
  } catch (err) {
    setAuthMsg("Giriş başarısız: " + err.message, "error");
  }
});

// Hesap oluştur
registerBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || password.length < 6) {
    setAuthMsg("Geçerli e-posta ve en az 6 karakter şifre gir.", "error");
    return;
  }
  setAuthMsg("Hesap oluşturuluyor...", "");
  try {
    await register(email, password);
    showTodoScreen();
  } catch (err) {
    setAuthMsg("Kayıt başarısız: " + err.message, "error");
  }
});

logoutBtn.addEventListener("click", logout);

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  // datetime-local yerel saat verir; ISO'ya çevirip kaydediyoruz
  const dueIso = dueInput.value ? new Date(dueInput.value).toISOString() : null;
  input.value = "";
  dueInput.value = "";
  input.focus();
  addTodo(text, dueIso);
});

clearBtn.addEventListener("click", clearDone);

filters.addEventListener("click", (e) => {
  if (!e.target.matches(".filter-btn")) return;
  filter = e.target.dataset.filter;
  document
    .querySelectorAll(".filter-btn")
    .forEach((b) => b.classList.toggle("active", b === e.target));
  render();
});

// ====================== BAŞLAT ======================
// Daha önce giriş yapıldıysa doğrudan todo ekranını aç
if (session && session.access_token) {
  showTodoScreen();
} else {
  showAuthScreen();
}
