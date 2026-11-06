"use strict";

const $ = (id) => document.getElementById(id);
const MAX_SIDE = 1280;

const state = {
  image: null, // { mimeType, base64, dataUrl }
  lastInput: null,
  suggestion: null,
  tryonController: null,
};

/* ---------- AI status pill ---------- */
fetch("/api/health")
  .then((r) => r.json())
  .then((h) => {
    const pill = $("ai-status");
    if (h.ai === "mock") { pill.textContent = "Demo mode"; pill.hidden = false; }
    if (h.ai === "not_configured") { pill.textContent = "AI key missing"; pill.hidden = false; }
  })
  .catch(() => {});

/* ---------- Photo upload ---------- */
/** Resize to max 1280px and re-encode as JPEG (also strips EXIF / location data). */
async function loadPhoto(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) return showFormError("Ye image file nahi hai.");
  if (file.size > 25 * 1024 * 1024) return showFormError("Photo 25 MB se choti honi chahiye.");
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return showFormError("Ye photo format browser nahi khol pa raha (HEIC?). JPG/PNG mein try karo.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  state.image = { mimeType: "image/jpeg", base64: dataUrl.split(",")[1], dataUrl };
  $("preview").src = dataUrl;
  $("preview").hidden = false;
  $("upload-empty").hidden = true;
  $("remove-photo").hidden = false;
  showFormError("");
}

$("file").addEventListener("change", (e) => loadPhoto(e.target.files[0]));
$("camera").addEventListener("change", (e) => loadPhoto(e.target.files[0]));
$("remove-photo").addEventListener("click", () => {
  state.image = null;
  $("preview").hidden = true;
  $("preview").removeAttribute("src");
  $("upload-empty").hidden = false;
  $("remove-photo").hidden = true;
  $("file").value = "";
  $("camera").value = "";
});

const dz = $("dropzone");
["dragenter", "dragover"].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.add("drag"); }));
["dragleave", "drop"].forEach((t) => dz.addEventListener(t, (e) => { e.preventDefault(); dz.classList.remove("drag"); }));
dz.addEventListener("drop", (e) => loadPhoto(e.dataTransfer.files[0]));

/* ---------- Helpers ---------- */
function showFormError(msg) {
  $("form-error").textContent = msg;
  $("form-error").hidden = !msg;
}
const radio = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;

async function api(path, body, signal) {
  let res;
  try {
    res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new Error("Server se connect nahi ho paya. Internet check karo.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? "Kuch gadbad ho gayi. Dobara try karo.");
  return data;
}

const LOADING_LINES = ["Tumhara look dekh rahe hain…", "Colours aur fit samajh rahe hain…", "Mood ke hisaab se outfit chun rahe hain…"];
let loadingTimer;
function setLoading(on) {
  $("loading").hidden = !on;
  $("submit").disabled = on;
  $("new-look").disabled = on;
  clearInterval(loadingTimer);
  if (on) {
    let i = 0;
    $("loading-text").textContent = LOADING_LINES[0];
    loadingTimer = setInterval(() => { i = (i + 1) % LOADING_LINES.length; $("loading-text").textContent = LOADING_LINES[i]; }, 2500);
  }
}

/* ---------- Main flow ---------- */
$("check-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!state.image) return showFormError("Pehle apni photo upload karo.");
  if (!$("consent").checked) return showFormError("Aage badhne ke liye consent box tick karo.");
  const mood = radio("mood");
  if (!mood) return showFormError("Mood / occasion chuno.");
  showFormError("");
  state.lastInput = {
    consent: true,
    mood,
    weather: radio("weather"),
    styleFor: radio("styleFor"),
    budget: radio("budget"),
    note: $("note").value.trim(),
  };
  runCheck();
});

async function runCheck() {
  state.tryonController?.abort();
  $("results").hidden = false;
  $("result-body").hidden = true;
  $("result-error").hidden = true;
  setLoading(true);
  $("results").scrollIntoView({ behavior: "smooth", block: "start" });
  try {
    const data = await api("/api/check", { ...state.lastInput, image: { mimeType: state.image.mimeType, base64: state.image.base64 } });
    state.suggestion = data;
    renderSuggestion(data);
    if (data.photo_ok) runTryOn();
  } catch (err) {
    $("result-error-text").textContent = err.message;
    $("result-error").hidden = false;
  } finally {
    setLoading(false);
  }
}

function renderSuggestion(d) {
  $("result-body").hidden = false;
  $("mock-banner").hidden = !d.mock;
  $("photo-issue").hidden = d.photo_ok;
  $("photo-issue").textContent = d.photo_ok ? "" : `📷 ${d.photo_issue || "Photo saaf nahi hai."} Neeche diya look general suggestion hai.`;

  const c = d.current_outfit;
  const score = Math.max(0, Math.min(10, Number(c.score) || 0));
  $("score").textContent = String(score);
  $("score-ring").style.setProperty("--p", String(score * 10));
  $("verdict").textContent = c.verdict;
  $("current-desc").textContent = c.description;
  fillList($("works"), c.works);
  fillList($("improve"), c.improve);

  const s = d.suggestion;
  $("look-title").textContent = s.title;
  $("look-vibe").textContent = s.vibe;
  $("why").textContent = s.why;
  $("grooming").textContent = `💡 ${s.grooming_tip}`;

  const sw = $("swatches");
  sw.replaceChildren(
    ...s.colors.map((col) => {
      const el = document.createElement("span");
      el.className = "swatch";
      const dot = document.createElement("i");
      if (/^#[0-9a-f]{6}$/i.test(col.hex)) dot.style.background = col.hex;
      el.append(dot, document.createTextNode(col.name));
      return el;
    }),
  );

  const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  let total = 0;
  $("pieces").replaceChildren(
    ...s.pieces.map((p) => {
      total += Number(p.est_price_inr) || 0;
      const li = document.createElement("li");
      const t = document.createElement("span"); t.className = "piece-type"; t.textContent = p.type;
      const i = document.createElement("span"); i.textContent = p.item;
      const pr = document.createElement("span"); pr.className = "piece-price"; pr.textContent = `~${inr.format(p.est_price_inr || 0)}`;
      li.append(t, i, pr);
      return li;
    }),
  );
  $("total").textContent = `Total andaaza: ~${inr.format(total)}`;

  $("before-img").src = state.image.dataUrl;
  resetTryOn(d.photo_ok);
}

function fillList(ul, items) {
  ul.replaceChildren(...(items ?? []).map((t) => { const li = document.createElement("li"); li.textContent = t; return li; }));
}

/* ---------- Try-on ---------- */
function resetTryOn(willLoad) {
  $("after-img").hidden = true;
  $("after-img").removeAttribute("src");
  $("ai-badge").hidden = true;
  $("download").hidden = true;
  $("regen-photo").hidden = true;
  $("tryon-error").hidden = true;
  $("tryon-loading").hidden = !willLoad;
  if (!willLoad) {
    $("tryon-error").textContent = "Try-on ke liye ek saaf photo chahiye jisme sirf tum ho.";
    $("tryon-error").hidden = false;
  }
}

async function runTryOn() {
  state.tryonController?.abort();
  const controller = new AbortController();
  state.tryonController = controller;
  resetTryOn(true);
  try {
    const data = await api(
      "/api/tryon",
      { consent: true, tryonDescription: state.suggestion.suggestion.tryon_description, image: { mimeType: state.image.mimeType, base64: state.image.base64 } },
      controller.signal,
    );
    const url = `data:${data.image.mimeType};base64,${data.image.base64}`;
    $("after-img").src = url;
    $("after-img").hidden = false;
    $("ai-badge").textContent = data.mock ? "DEMO — original photo" : "AI preview";
    $("ai-badge").hidden = false;
    const ext = data.image.mimeType.split("/")[1].replace("jpeg", "jpg");
    $("download").href = url;
    $("download").download = `outfit-checker-look.${ext}`;
    $("download").hidden = false;
  } catch (err) {
    if (err.name === "AbortError") return;
    $("tryon-error").textContent = err.message;
    $("tryon-error").hidden = false;
  } finally {
    if (state.tryonController === controller) {
      $("tryon-loading").hidden = true;
      $("regen-photo").hidden = false;
    }
  }
}

$("regen-photo").addEventListener("click", runTryOn);
$("new-look").addEventListener("click", runCheck);
$("retry").addEventListener("click", runCheck);
$("start-over").addEventListener("click", () => {
  state.tryonController?.abort();
  $("results").hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
});
