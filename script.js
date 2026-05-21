function openTab(evt, tabId) {
  // Hide all tab content panels
  const contents = document.querySelectorAll(".tab-content");
  contents.forEach((tab) => (tab.style.display = "none"));

  // Deactivate all nav links + update aria-selected
  const links = document.querySelectorAll("nav a");
  links.forEach((link) => {
    link.classList.remove("active");
    // FIX: keep aria-selected in sync with visual active state
    link.setAttribute("aria-selected", "false");
  });

  // Show selected tab
  document.getElementById(tabId).style.display = "flex";

  // Activate clicked link
  evt.currentTarget.classList.add("active");
  evt.currentTarget.setAttribute("aria-selected", "true");

  // Prevent page jump from href="#"
  evt.preventDefault();
}

// FIX: Keyboard navigation — Left/Right arrow keys move between tabs
document.querySelector(".navbar").addEventListener("keydown", function (e) {
  const tabs = Array.from(document.querySelectorAll(".navbar a"));
  const current = document.activeElement;
  const idx = tabs.indexOf(current);

  if (e.key === "ArrowRight" && idx < tabs.length - 1) {
    tabs[idx + 1].focus();
    tabs[idx + 1].click();
  } else if (e.key === "ArrowLeft" && idx > 0) {
    tabs[idx - 1].focus();
    tabs[idx - 1].click();
  }
});
