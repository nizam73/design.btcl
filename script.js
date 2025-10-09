function openTab(evt, tabId) {
  const contents = document.querySelectorAll(".tab-content");
  contents.forEach((tab) => (tab.style.display = "none"));
  const links = document.querySelectorAll("nav a");
  links.forEach((link) => link.classList.remove("active"));

  document.getElementById(tabId).style.display = "flex";
  evt.currentTarget.classList.add("active");
}
