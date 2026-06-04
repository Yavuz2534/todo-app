// --- Supabase REST API ayarları (kütüphane gerektirmez) ---
const SUPABASE_URL = "https://lowcsekzsnskshhayrdb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxvd2NzZWt6c25za3NoaGF5cmRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTA4NTIsImV4cCI6MjA5NjE2Njg1Mn0.sY9UATk-u1Kh5S135l_WDbLNS-6AiCo9AHiISx02V1g";

const REST = SUPABASE_URL + "/rest/v1/todos";
const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: "Bearer " + SUPABASE_ANON_KEY,
  "Content-Type": "application/json",
};

// Tüm istekleri saran küçük yardımcı
async function api(method, query = "", body = null, returnData = false) {
  const opts = { method, headers: { ...HEADERS } };
  if (returnData) opts.headers["Prefer"] = "return=representation";
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(REST + query, opts);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error("HTTP " + res.status + " — " + txt);
  }
  // DELETE/PATCH return=minimal durumunda gövde boş olabilir
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// --- DOM ---
const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const countEl = document.getElementById("count");
const clearBtn = document.getElementById("clear-done");
const filters = document.getElementById("filters");

let todos = [];
let filter = "all";

function showError(msg) {
  countEl.textContent = "⚠️ " + msg;
  console.error(msg);
}

// --- Veri çekme ---
async function load() {
  try {
    todos = await api("GET", "?select=*&order=created_at.asc");
    render();
  } catch (e) {
    showError("Yüklenemedi: " + e.message);
  }
}

// --- Görsel ---
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

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.done;
    checkbox.addEventListener("change", () => toggle(todo));

    const span = document.createElement("span");
    span.className = "text";
    span.textContent = todo.text;

    const del = document.createElement("button");
    del.className = "delete";
    del.innerHTML = "&times;";
    del.setAttribute("aria-label", "Sil");
    del.addEventListener("click", () => remove(todo.id));

    li.append(checkbox, span, del);
    list.appendChild(li);
  });

  const remaining = todos.filter((t) => !t.done).length;
  countEl.textContent = `${remaining} görev kaldı`;
}

// --- İşlemler ---
async function addTodo(text) {
  try {
    const rows = await api("POST", "", { text }, true);
    todos.push(rows[0]);
    render();
  } catch (e) {
    showError("Eklenemedi: " + e.message);
  }
}

async function toggle(todo) {
  try {
    const rows = await api(
      "PATCH",
      "?id=eq." + todo.id,
      { done: !todo.done },
      true
    );
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

// --- Olaylar ---
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  input.focus();
  addTodo(text);
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

// --- Başlat ---
load();
