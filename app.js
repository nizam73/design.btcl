// app.js  — main application logic
import { auth, db } from "./firebase-init.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let currentUser     = null;   // Firebase auth user
let isAdmin         = false;
let currentTabId    = null;
let tabs            = [];     // [{ id, name, order }]
let cards           = {};     // { tabId: [card, ...] }
let adminEmails     = [];     // list of admin emails from Firestore
let pendingLinkHref = null;   // href to open after login
let unsubTabs       = null;
let unsubCards      = {};
let openCardMoreId  = null;   // card id whose dropdown is open

const DEFAULT_ADMIN = "ahmed.nizam73@gmail.com";

// ─────────────────────────────────────────────
// DOM REFS
// ─────────────────────────────────────────────
const $  = (id) => document.getElementById(id);
const loginBtn          = $("login-btn");
const logoutBtn         = $("logout-btn");
const userAvatarWrap    = $("user-avatar-wrap");
const userAvatar        = $("user-avatar");
const moreBtn           = $("more-btn");
const moreDropdown      = $("more-dropdown");
const adminPortalBtn    = $("admin-portal-btn");
const dropdownHint      = $("dropdown-hint");
const tabsNav           = $("tabs-nav");
const addTabBtn         = $("add-tab-btn");
const tabContentArea    = $("tab-content-area");
const toast             = $("toast");

// Modals
const loginModal        = $("login-modal");
const editCardModal     = $("edit-card-modal");
const addTabModal       = $("add-tab-modal");
const editTabModal      = $("edit-tab-modal");
const adminModal        = $("admin-modal");

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
function showToast(msg, duration = 2500) {
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), duration);
}

function openModal(el)  { el.classList.remove("hidden"); }
function closeModal(el) { el.classList.add("hidden"); }

function closeAllDropdowns() {
  moreDropdown.classList.add("hidden");
  moreBtn.setAttribute("aria-expanded", "false");
  // close any open card more dropdowns
  document.querySelectorAll(".card-more-dropdown").forEach((d) => d.remove());
  openCardMoreId = null;
}

// Close dropdowns on outside click
document.addEventListener("click", (e) => {
  if (!moreBtn.contains(e.target) && !moreDropdown.contains(e.target)) {
    moreDropdown.classList.add("hidden");
    moreBtn.setAttribute("aria-expanded", "false");
  }
});

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────
const provider = new GoogleAuthProvider();

async function signInGoogle() {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code !== "auth/popup-closed-by-user") showToast("Sign-in failed: " + e.message);
  }
}

loginBtn.addEventListener("click", signInGoogle);
$("login-modal-google-btn").addEventListener("click", async () => {
  closeModal(loginModal);
  await signInGoogle();
  if (pendingLinkHref) {
    window.open(pendingLinkHref, "_blank");
    pendingLinkHref = null;
  }
});
$("login-modal-close").addEventListener("click", () => {
  closeModal(loginModal);
  pendingLinkHref = null;
});

logoutBtn.addEventListener("click", async () => {
  closeAllDropdowns();
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  await refreshAdminList();
  isAdmin = user ? adminEmails.includes(user.email.toLowerCase()) : false;

  // UI: avatar / login button
  if (user) {
    loginBtn.classList.add("hidden");
    userAvatarWrap.classList.remove("hidden");
    userAvatar.src   = user.photoURL || "";
    userAvatar.title = user.displayName || user.email;
    logoutBtn.classList.remove("hidden");
    dropdownHint.classList.add("hidden");
    if (isAdmin) adminPortalBtn.classList.remove("hidden");
    else         adminPortalBtn.classList.add("hidden");
  } else {
    loginBtn.classList.remove("hidden");
    userAvatarWrap.classList.add("hidden");
    logoutBtn.classList.add("hidden");
    adminPortalBtn.classList.add("hidden");
    dropdownHint.classList.remove("hidden");
  }

  // Admin-only UI elements
  document.querySelectorAll(".btn-edit-tab, .btn-add-card, .btn-card-more")
    .forEach((el) => { el.style.display = isAdmin ? "" : "none"; });

  if (isAdmin) addTabBtn.classList.remove("hidden");
  else         addTabBtn.classList.add("hidden");

  renderTabs();
});

// ─────────────────────────────────────────────
// ADMIN LIST
// ─────────────────────────────────────────────
async function refreshAdminList() {
  const snap = await getDoc(doc(db, "config", "admins"));
  if (snap.exists()) {
    adminEmails = (snap.data().emails || []).map((e) => e.toLowerCase());
  } else {
    // Bootstrap default admin
    await setDoc(doc(db, "config", "admins"), { emails: [DEFAULT_ADMIN] });
    adminEmails = [DEFAULT_ADMIN];
  }
}

// ─────────────────────────────────────────────
// MORE MENU
// ─────────────────────────────────────────────
moreBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const open = moreDropdown.classList.toggle("hidden");
  moreBtn.setAttribute("aria-expanded", String(!open));
});

adminPortalBtn.addEventListener("click", () => {
  closeAllDropdowns();
  openAdminPortal();
});

// ─────────────────────────────────────────────
// FIRESTORE — REAL-TIME TABS
// ─────────────────────────────────────────────
function startTabsListener() {
  if (unsubTabs) unsubTabs();
  const q = query(collection(db, "tabs"), orderBy("order"));
  unsubTabs = onSnapshot(q, (snap) => {
    tabs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderTabs();
  });
}

startTabsListener();

// ─────────────────────────────────────────────
// TABS RENDERING
// ─────────────────────────────────────────────
function renderTabs() {
  tabsNav.innerHTML = "";
  tabs.forEach((tab) => {
    const wrap = document.createElement("span");
    wrap.className = "tab-link-wrap";

    const btn = document.createElement("button");
    btn.className = "tab-link" + (tab.id === currentTabId ? " active" : "");
    btn.textContent = tab.name;
    btn.dataset.tabId = tab.id;
    btn.addEventListener("click", () => selectTab(tab.id));

    wrap.appendChild(btn);

    if (isAdmin) {
      const editBtn = document.createElement("button");
      editBtn.className = "btn-edit-tab";
      editBtn.title = "Rename tab";
      editBtn.textContent = "✎";
      editBtn.style.display = "";
      editBtn.addEventListener("click", (e) => { e.stopPropagation(); openEditTab(tab); });
      wrap.appendChild(editBtn);
    }

    tabsNav.appendChild(wrap);
  });

  // If no tab is selected or selected tab was deleted, pick first
  if (!currentTabId && tabs.length > 0) {
    // Check URL hash for deep-link
    const hash = window.location.hash; // #tabId-cardId or #tabId
    if (hash) {
      const parts = hash.slice(1).split("-");
      const tabMatch = tabs.find((t) => t.id === parts[0]);
      if (tabMatch) { selectTab(tabMatch.id); return; }
    }
    selectTab(tabs[0].id);
  } else if (currentTabId) {
    renderCurrentTab();
  } else {
    tabContentArea.innerHTML = `<div style="text-align:center;padding:60px;color:#888;">No tabs yet. ${isAdmin ? "Use ＋ Tab to create one." : ""}</div>`;
  }
}

function selectTab(tabId) {
  currentTabId = tabId;
  // Update active class
  document.querySelectorAll(".tab-link").forEach((b) => {
    b.classList.toggle("active", b.dataset.tabId === tabId);
  });
  renderCurrentTab();

  // Handle deep-link card focus
  const hash = window.location.hash;
  if (hash) {
    const parts = hash.slice(1).split("-");
    if (parts[0] === tabId && parts[1]) {
      setTimeout(() => focusCard(parts[1]), 400);
    }
  }
}

function renderCurrentTab() {
  if (!currentTabId) return;
  tabContentArea.innerHTML = "";

  const container = document.createElement("main");
  // Admin toolbar
  if (isAdmin) {
    const toolbar = document.createElement("div");
    toolbar.className = "cards-toolbar";
    const addCardBtn = document.createElement("button");
    addCardBtn.className = "btn-add-card";
    addCardBtn.innerHTML = `＋ Add Card`;
    addCardBtn.addEventListener("click", () => openEditCardModal(null));
    toolbar.appendChild(addCardBtn);
    container.appendChild(toolbar);
  }

  const cardsWrap = document.createElement("div");
  cardsWrap.className = "cards";
  cardsWrap.id = "cards-wrap-" + currentTabId;
  container.appendChild(cardsWrap);
  tabContentArea.appendChild(container);

  // Start real-time cards listener for this tab
  startCardsListener(currentTabId, cardsWrap);
}

// ─────────────────────────────────────────────
// FIRESTORE — REAL-TIME CARDS
// ─────────────────────────────────────────────
function startCardsListener(tabId, container) {
  if (unsubCards[tabId]) unsubCards[tabId]();
  const q = query(collection(db, "tabs", tabId, "cards"), orderBy("order"));
  unsubCards[tabId] = onSnapshot(q, (snap) => {
    cards[tabId] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCards(tabId, container);
  });
}

// ─────────────────────────────────────────────
// CARDS RENDERING
// ─────────────────────────────────────────────
function renderCards(tabId, container) {
  container.innerHTML = "";
  const tabCards = cards[tabId] || [];

  if (tabCards.length === 0) {
    container.innerHTML = `<div class="empty-tab"><p>${isAdmin ? 'No cards yet. Use ＋ Add Card above.' : 'No files here yet.'}</p></div>`;
    return;
  }

  tabCards.forEach((card, idx) => {
    container.appendChild(buildCardEl(card, tabId, idx));
  });
}

function buildCardEl(card, tabId, animIdx) {
  const el = document.createElement("div");
  el.className = "card";
  el.id = "card-" + card.id;
  el.style.animationDelay = (animIdx * 0.05) + "s";

  // ── Action buttons row (top-right) ──
  const actions = document.createElement("div");
  actions.className = "card-actions";

  // Share button (always visible)
  const shareBtn = document.createElement("button");
  shareBtn.className = "btn-card-share";
  shareBtn.title = "Share this card";
  shareBtn.setAttribute("aria-label", "Share card");
  shareBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;
  shareBtn.addEventListener("click", (e) => { e.stopPropagation(); copyCardLink(tabId, card.id); });
  actions.appendChild(shareBtn);

  // More button (admin only)
  if (isAdmin) {
    const moreBtn = document.createElement("button");
    moreBtn.className = "btn-card-more";
    moreBtn.title = "Card options";
    moreBtn.setAttribute("aria-label", "Card options");
    moreBtn.innerHTML = `⋮`;
    moreBtn.style.display = "";
    moreBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleCardMoreDropdown(card, tabId, el, moreBtn); });
    actions.appendChild(moreBtn);
  }

  el.appendChild(actions);

  // ── Card content ──
  const h2 = document.createElement("h2");
  h2.textContent = card.headline || "Untitled";
  el.appendChild(h2);

  if (card.desc) {
    const p = document.createElement("p");
    p.className = "card-desc";
    p.textContent = card.desc;
    el.appendChild(p);
  }
  if (card.warning) {
    const w = document.createElement("p");
    w.className = "warning";
    w.textContent = "⚠ " + card.warning;
    el.appendChild(w);
  }

  if (card.imageName) {
    const div = document.createElement("div");
    div.appendChild(makeDivider());
    const img = document.createElement("img");
    img.src = card.imageName;
    img.alt = card.imageAlt || card.headline || "";
    img.className = "preview";
    img.onerror = () => { img.style.display = "none"; }; // hide broken images
    const lbl = document.createElement("p");
    lbl.className = "preview-label";
    lbl.textContent = "Preview";
    div.appendChild(img);
    div.appendChild(lbl);
    el.appendChild(div);
  }

  // Buttons
  const hasButtons = card.btnGreen || card.btnDark || card.btnLight;
  if (hasButtons) {
    el.appendChild(makeDivider());
    const btns = document.createElement("div");
    btns.className = "buttons";
    if (card.btnGreen) btns.appendChild(makeFileBtn("Vector File", "green", card.btnGreen));
    if (card.btnDark)  btns.appendChild(makeFileBtn("Image File",  "dark",  card.btnDark));
    if (card.btnLight) btns.appendChild(makeFileBtn("PDF File",    "light", card.btnLight));
    el.appendChild(btns);
  }

  return el;
}

function makeDivider() {
  const d = document.createElement("div");
  d.className = "divider";
  return d;
}

function makeFileBtn(label, colorClass, href) {
  const a = document.createElement("a");
  a.className = "btn " + colorClass;
  a.textContent = label + " >";
  // Intercept click — require login
  a.addEventListener("click", (e) => {
    e.preventDefault();
    if (currentUser) {
      window.open(href, "_blank");
    } else {
      pendingLinkHref = href;
      openModal(loginModal);
    }
  });
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}

// ─────────────────────────────────────────────
// CARD MORE DROPDOWN
// ─────────────────────────────────────────────
function toggleCardMoreDropdown(card, tabId, cardEl, anchorBtn) {
  // Close if already open for this card
  const existing = cardEl.querySelector(".card-more-dropdown");
  if (existing) { existing.remove(); openCardMoreId = null; return; }

  // Close any other open dropdown
  document.querySelectorAll(".card-more-dropdown").forEach((d) => d.remove());

  const dropdown = document.createElement("div");
  dropdown.className = "card-more-dropdown";

  const editItem = document.createElement("button");
  editItem.textContent = "✏ Edit";
  editItem.addEventListener("click", () => { dropdown.remove(); openEditCardModal(card, tabId); });
  dropdown.appendChild(editItem);

  const deleteItem = document.createElement("button");
  deleteItem.className = "danger";
  deleteItem.textContent = "🗑 Delete";
  deleteItem.addEventListener("click", () => { dropdown.remove(); deleteCard(tabId, card.id); });
  dropdown.appendChild(deleteItem);

  cardEl.appendChild(dropdown);
  openCardMoreId = card.id;

  // Close on outside click
  setTimeout(() => {
    document.addEventListener("click", function handler() {
      dropdown.remove();
      openCardMoreId = null;
      document.removeEventListener("click", handler);
    }, { once: true });
  }, 10);
}

// ─────────────────────────────────────────────
// SHARE / DEEP LINK
// ─────────────────────────────────────────────
function copyCardLink(tabId, cardId) {
  const url = `${location.origin}${location.pathname}#${tabId}-${cardId}`;
  navigator.clipboard.writeText(url).then(() => showToast("Link copied!"));
}

function focusCard(cardId) {
  const el = document.getElementById("card-" + cardId);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("highlight-focus");
  setTimeout(() => el.classList.remove("highlight-focus"), 2200);
}

// Handle hash on page load
window.addEventListener("load", () => {
  const hash = window.location.hash;
  if (hash) {
    const parts = hash.slice(1).split("-");
    const tabId = parts[0];
    const cardId = parts[1];
    if (tabId) {
      // tabs listener will pick this up in renderTabs → selectTab
    }
  }
});

// ─────────────────────────────────────────────
// EDIT / ADD CARD MODAL
// ─────────────────────────────────────────────
function openEditCardModal(card, tabId) {
  const tid = tabId || currentTabId;
  $("edit-card-title").textContent = card ? "Edit Card" : "Add Card";
  $("ec-headline").value  = card?.headline  || "";
  $("ec-desc").value      = card?.desc      || "";
  $("ec-warning").value   = card?.warning   || "";
  $("ec-image").value     = card?.imageName || "";
  $("ec-alt").value       = card?.imageAlt  || "";
  $("ec-btn-green").value = card?.btnGreen  || "";
  $("ec-btn-dark").value  = card?.btnDark   || "";
  $("ec-btn-light").value = card?.btnLight  || "";
  $("ec-tab-id").value    = tid;
  $("ec-card-id").value   = card?.id || "";
  openModal(editCardModal);
}

$("edit-card-close").addEventListener("click",   () => closeModal(editCardModal));
$("edit-card-cancel").addEventListener("click",  () => closeModal(editCardModal));
editCardModal.addEventListener("click", (e) => { if (e.target === editCardModal) closeModal(editCardModal); });

$("edit-card-save").addEventListener("click", async () => {
  const tabId  = $("ec-tab-id").value;
  const cardId = $("ec-card-id").value;
  const data = {
    headline:  $("ec-headline").value.trim(),
    desc:      $("ec-desc").value.trim(),
    warning:   $("ec-warning").value.trim(),
    imageName: $("ec-image").value.trim(),
    imageAlt:  $("ec-alt").value.trim(),
    btnGreen:  $("ec-btn-green").value.trim(),
    btnDark:   $("ec-btn-dark").value.trim(),
    btnLight:  $("ec-btn-light").value.trim(),
    updatedAt: serverTimestamp(),
  };

  if (!data.headline) { showToast("Headline is required."); return; }

  try {
    if (cardId) {
      // Update existing
      await updateDoc(doc(db, "tabs", tabId, "cards", cardId), data);
      showToast("Card updated.");
    } else {
      // Add new — append at end
      const existing = cards[tabId] || [];
      data.order = existing.length;
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, "tabs", tabId, "cards"), data);
      showToast("Card added.");
    }
    closeModal(editCardModal);
  } catch (e) {
    showToast("Error: " + e.message);
  }
});

// ─────────────────────────────────────────────
// DELETE CARD
// ─────────────────────────────────────────────
async function deleteCard(tabId, cardId) {
  if (!confirm("Delete this card? This cannot be undone.")) return;
  try {
    await deleteDoc(doc(db, "tabs", tabId, "cards", cardId));
    showToast("Card deleted.");
  } catch (e) {
    showToast("Error: " + e.message);
  }
}

// ─────────────────────────────────────────────
// ADD TAB MODAL
// ─────────────────────────────────────────────
addTabBtn.addEventListener("click", () => {
  $("new-tab-name").value = "";
  openModal(addTabModal);
  setTimeout(() => $("new-tab-name").focus(), 100);
});

$("add-tab-close").addEventListener("click",  () => closeModal(addTabModal));
$("add-tab-cancel").addEventListener("click", () => closeModal(addTabModal));
addTabModal.addEventListener("click", (e) => { if (e.target === addTabModal) closeModal(addTabModal); });

$("add-tab-save").addEventListener("click", async () => {
  const name = $("new-tab-name").value.trim();
  if (!name) { showToast("Tab name is required."); return; }
  try {
    const newTab = await addDoc(collection(db, "tabs"), {
      name,
      order: tabs.length,
      createdAt: serverTimestamp(),
    });
    closeModal(addTabModal);
    showToast("Tab created.");
    // Switch to new tab
    setTimeout(() => selectTab(newTab.id), 300);
  } catch (e) {
    showToast("Error: " + e.message);
  }
});

// ─────────────────────────────────────────────
// EDIT TAB MODAL
// ─────────────────────────────────────────────
function openEditTab(tab) {
  $("edit-tab-name").value = tab.name;
  $("edit-tab-id").value   = tab.id;
  openModal(editTabModal);
  setTimeout(() => $("edit-tab-name").focus(), 100);
}

$("edit-tab-close").addEventListener("click",  () => closeModal(editTabModal));
$("edit-tab-cancel").addEventListener("click", () => closeModal(editTabModal));
editTabModal.addEventListener("click", (e) => { if (e.target === editTabModal) closeModal(editTabModal); });

$("edit-tab-save").addEventListener("click", async () => {
  const name  = $("edit-tab-name").value.trim();
  const tabId = $("edit-tab-id").value;
  if (!name) { showToast("Tab name is required."); return; }
  try {
    await updateDoc(doc(db, "tabs", tabId), { name });
    closeModal(editTabModal);
    showToast("Tab renamed.");
  } catch (e) {
    showToast("Error: " + e.message);
  }
});

// ─────────────────────────────────────────────
// ADMIN PORTAL
// ─────────────────────────────────────────────
function openAdminPortal() {
  renderAdminList();
  openModal(adminModal);
}

$("admin-modal-close").addEventListener("click",  () => closeModal(adminModal));
$("admin-modal-close2").addEventListener("click", () => closeModal(adminModal));
adminModal.addEventListener("click", (e) => { if (e.target === adminModal) closeModal(adminModal); });

function renderAdminList() {
  const list = $("admin-list");
  list.innerHTML = "";
  adminEmails.forEach((email) => {
    const item = document.createElement("div");
    item.className = "admin-item";

    const span = document.createElement("span");
    span.className = "admin-email";
    span.textContent = email;

    const right = document.createElement("div");
    right.style.display = "flex"; right.style.alignItems = "center"; right.style.gap = "8px";

    if (email === DEFAULT_ADMIN.toLowerCase()) {
      const badge = document.createElement("span");
      badge.className = "admin-badge";
      badge.textContent = "Default";
      right.appendChild(badge);
    } else {
      const removeBtn = document.createElement("button");
      removeBtn.className = "btn-remove-admin";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => removeAdmin(email));
      right.appendChild(removeBtn);
    }

    item.appendChild(span);
    item.appendChild(right);
    list.appendChild(item);
  });
}

$("add-admin-btn").addEventListener("click", async () => {
  const emailInput = $("new-admin-email");
  const email = emailInput.value.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast("Enter a valid email address.");
    return;
  }
  if (adminEmails.includes(email)) { showToast("Already an admin."); return; }
  adminEmails.push(email);
  await saveAdminList();
  emailInput.value = "";
  renderAdminList();
  showToast("Admin added.");
});

async function removeAdmin(email) {
  if (email === DEFAULT_ADMIN.toLowerCase()) { showToast("Cannot remove default admin."); return; }
  adminEmails = adminEmails.filter((e) => e !== email);
  await saveAdminList();
  renderAdminList();
  showToast("Admin removed.");
}

async function saveAdminList() {
  await setDoc(doc(db, "config", "admins"), { emails: adminEmails });
}

// ─────────────────────────────────────────────
// KEYBOARD — close modals on Escape
// ─────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  [loginModal, editCardModal, addTabModal, editTabModal, adminModal].forEach((m) => {
    if (!m.classList.contains("hidden")) closeModal(m);
  });
  closeAllDropdowns();
});
