(function () {
  const REPO_OWNER = "mengjianqiangmr";
  const REPO_NAME = "yunmeng-ai-wedding";
  const BRANCH = "main";
  const CASES_JSON_URL = "data/cases.json";
  const PACKAGES_JSON_URL = "data/packages.json";
  const CATEGORY_STYLE_MAP = {
    "黑色蝴蝶主题": "black",
    "森系外景": "forest"
  };

  const featuredTarget = document.querySelector("[data-cases-target='featured']");
  const portfolioTarget = document.querySelector("[data-cases-target='portfolio']");
  const packagesTarget = document.querySelector("[data-packages-target]");

  if (featuredTarget || portfolioTarget) {
    loadCases()
      .then((cases) => {
        const sortedCases = sortByOrder(cases);
        if (featuredTarget) {
          renderFeaturedCases(featuredTarget, sortedCases);
        }
        if (portfolioTarget) {
          renderPortfolioCases(portfolioTarget, sortedCases);
          bindPortfolioFilters(portfolioTarget);
        }
      })
      .catch(() => {
        renderEmptyState(featuredTarget || portfolioTarget, "案例暂时加载失败，请稍后刷新。");
      });
  }

  if (packagesTarget) {
    loadPackages()
      .then((packages) => {
        renderPackages(packagesTarget, sortByOrder(packages));
      })
      .catch(() => {
        renderEmptyState(packagesTarget, "套餐信息暂时加载失败，请稍后刷新。");
      });
  }

  async function loadCases() {
    if (isGitHubPages()) {
      try {
        return await loadCasesFromGitHub();
      } catch (error) {
        return loadCasesFromJson();
      }
    }

    return loadCasesFromJson();
  }

  async function loadCasesFromGitHub() {
    const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/cases?ref=${BRANCH}`;
    const response = await fetch(apiUrl, { headers: { "Accept": "application/vnd.github+json" } });
    if (!response.ok) {
      throw new Error("GitHub cases list failed");
    }

    const files = await response.json();
    const markdownFiles = files
      .filter((file) => file.type === "file" && file.name.endsWith(".md") && file.download_url)
      .sort((a, b) => a.name.localeCompare(b.name));

    const caseFiles = await Promise.all(markdownFiles.map(async (file) => {
      const fileResponse = await fetch(file.download_url);
      if (!fileResponse.ok) {
        throw new Error(`Case file failed: ${file.name}`);
      }
      return parseCaseMarkdown(await fileResponse.text());
    }));

    return caseFiles.filter(Boolean);
  }

  async function loadCasesFromJson() {
    const response = await fetch(CASES_JSON_URL);
    if (!response.ok) {
      throw new Error("Cases JSON failed");
    }
    return response.json();
  }

  async function loadPackages() {
    const response = await fetch(PACKAGES_JSON_URL);
    if (!response.ok) {
      throw new Error("Packages JSON failed");
    }
    const data = await response.json();
    return Array.isArray(data) ? data : data.packages || [];
  }

  function renderFeaturedCases(target, cases) {
    const featuredCases = cases.filter((item) => item.featured).slice(0, 4);
    target.innerHTML = "";
    featuredCases.forEach((item) => {
      const card = document.createElement("a");
      card.className = "case-card";
      card.href = "portfolio.html";
      card.innerHTML = [
        `<img src="${escapeAttribute(normalizeAssetPath(item.image))}" alt="${escapeAttribute(item.alt || item.title)}" loading="lazy">`,
        "<div>",
        `<span>${escapeHtml(item.category)}</span>`,
        `<h3>${escapeHtml(item.title)}</h3>`,
        "</div>"
      ].join("");
      target.appendChild(card);
    });
  }

  function renderPortfolioCases(target, cases) {
    target.innerHTML = "";
    cases.forEach((item) => {
      const card = document.createElement("article");
      card.className = "case-card portfolio-item";
      card.dataset.style = item.style || getCategoryStyle(item.category);
      card.innerHTML = [
        `<img src="${escapeAttribute(normalizeAssetPath(item.image))}" alt="${escapeAttribute(item.alt || item.title)}" loading="lazy">`,
        "<div>",
        `<span>${escapeHtml(item.category)}</span>`,
        `<h3>${escapeHtml(item.title)}</h3>`,
        item.description ? `<p>${escapeHtml(item.description)}</p>` : "",
        "</div>"
      ].join("");
      target.appendChild(card);
    });
  }

  function renderPackages(target, packages) {
    target.innerHTML = "";
    packages.forEach((item) => {
      const card = document.createElement("article");
      const classNames = ["price-card", item.styleClass || item.slug || ""];
      if (item.recommended) {
        classNames.push("recommended");
      }
      card.className = classNames.filter(Boolean).join(" ");

      const features = [item.photoCount].concat(item.features || []).filter(Boolean);
      const buttonClass = item.recommended ? "btn btn-primary" : "btn btn-line";
      const packageQuery = encodeURIComponent(item.contactPackage || item.name);

      card.innerHTML = [
        item.recommended ? '<span class="recommend-badge">主推</span>' : "",
        '<div class="price-head">',
        `<span>${escapeHtml(item.name)}</span>`,
        `<strong>${escapeHtml(item.price)}</strong>`,
        "</div>",
        `<p>${escapeHtml(item.description)}</p>`,
        '<ul class="check-list">',
        features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join(""),
        "</ul>",
        `<a class="${buttonClass}" href="contact.html?package=${packageQuery}">${escapeHtml(item.buttonText || `选择${item.name}`)}</a>`
      ].join("");

      target.appendChild(card);
    });
  }

  function bindPortfolioFilters(target) {
    const filterButtons = document.querySelectorAll(".filter-chip");
    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const filter = button.dataset.filter;
        filterButtons.forEach((item) => item.classList.remove("active"));
        button.classList.add("active");

        target.querySelectorAll(".portfolio-item").forEach((item) => {
          const shouldShow = filter === "all" || item.dataset.style === filter;
          item.classList.toggle("is-hidden", !shouldShow);
        });
      });
    });
  }

  function parseCaseMarkdown(markdown) {
    const match = markdown.match(/^---\s*([\s\S]*?)\s*---/);
    if (!match) {
      return null;
    }

    return parseFrontmatter(match[1]);
  }

  function parseFrontmatter(frontmatter) {
    return frontmatter.split(/\r?\n/).reduce((data, line) => {
      const separator = line.indexOf(":");
      if (separator === -1) {
        return data;
      }

      const key = line.slice(0, separator).trim();
      const rawValue = line.slice(separator + 1).trim();
      data[key] = normalizeFrontmatterValue(rawValue);
      return data;
    }, {});
  }

  function normalizeFrontmatterValue(value) {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return Number(value);
    }
    return value.replace(/^["']|["']$/g, "");
  }

  function sortByOrder(items) {
    return items.slice().sort((a, b) => {
      const orderA = Number(a.order || 0);
      const orderB = Number(b.order || 0);
      return orderA - orderB;
    });
  }

  function getCategoryStyle(category) {
    return CATEGORY_STYLE_MAP[category] || slugify(category);
  }

  function normalizeAssetPath(path) {
    return String(path || "").replace(/^\/+/, "");
  }

  function isGitHubPages() {
    return window.location.hostname.endsWith("github.io");
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]+/g, "");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function renderEmptyState(target, message) {
    if (!target) {
      return;
    }
    target.innerHTML = `<p class="muted">${escapeHtml(message)}</p>`;
  }
})();
