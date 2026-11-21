const themeButton = document.querySelector("#theme-toggle");
const root = document.documentElement;

function syncThemeButton() {
  themeButton.setAttribute("aria-pressed", String(root.dataset.theme === "light"));
}

syncThemeButton();
themeButton.hidden = false;
themeButton.addEventListener("click", () => {
  const theme = root.dataset.theme === "light" ? "dark" : "light";
  root.dataset.theme = theme;
  syncThemeButton();
  try {
    localStorage.setItem("aql-theme", theme);
  } catch {}
});

const dialog = document.querySelector("#site-search");
const openSearch = document.querySelector("#search-open");
const input = document.querySelector("#search-input");
const results = document.querySelector("#search-results");
const status = document.querySelector("#search-status");
const items = Array.from(document.querySelector("#search-index").content.querySelectorAll("a"), (link) => ({
  link,
  title: link.textContent.trim(),
  description: link.dataset.description || "",
}));

function search() {
  const terms = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  results.replaceChildren();
  if (!terms.length) {
    status.textContent = "Type to search.";
    return;
  }

  const matches = items.filter(({ title, description }) => {
    const text = (title + " " + description).toLowerCase();
    return terms.every((term) => text.includes(term));
  });
  status.textContent = matches.length ? matches.length + (matches.length === 1 ? " result." : " results.") : "No results found.";
  for (const { link, description } of matches) {
    const result = document.createElement("li");
    result.append(link.cloneNode(true));
    if (description) {
      const summary = document.createElement("p");
      summary.textContent = description;
      result.append(summary);
    }
    results.append(result);
  }
}

openSearch.hidden = false;
openSearch.addEventListener("click", () => {
  dialog.showModal();
  input.focus();
});
dialog.addEventListener("close", () => {
  input.value = "";
  search();
  openSearch.focus();
});
input.addEventListener("input", search);

dialog.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const links = [...results.querySelectorAll("a")];
  if (!links.length) return;
  const focused = document.activeElement;
  if (focused !== input && !links.includes(focused)) return;
  event.preventDefault();
  const position = links.indexOf(focused);
  const next = event.key === "ArrowDown" ? Math.min(position + 1, links.length - 1) : position - 1;
  (links[next] || input).focus();
});
