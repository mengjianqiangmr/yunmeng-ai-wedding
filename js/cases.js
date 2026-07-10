(function () {
  const CASES_JSON_URL = "data/cases.json";
  const CATEGORIES_JSON_URL = "data/categories.json";
  const PACKAGES_JSON_URL = "data/packages.json";

  const featuredTarget = document.querySelector("[data-cases-target='featured']");
  const portfolioTarget = document.querySelector("[data-cases-target='portfolio']");
  const packagesTarget = document.querySelector("[data-packages-target]");
  const packageSelect = document.querySelector("[data-package-select]");
  const styleSelect = document.querySelector("[data-style-select]");
  const packageSummary = document.querySelector("[data-package-summary]");
  const upgradeCopyTarget = document.querySelector("[data-upgrade-copy]");
  const upgradeFlowTarget = document.querySelector("[data-upgrade-target]");

  const needsCategories = Boolean(featuredTarget || portfolioTarget || styleSelect);
  const needsPackages = Boolean(packagesTarget || packageSelect || packageSummary || upgradeCopyTarget || upgradeFlowTarget);
  const categoriesPromise = needsCategories ? loadCategories() : Promise.resolve([]);
  const packagesPromise = needsPackages ? loadPackages() : Promise.resolve([]);
  const pageTasks = [];

  if (featuredTarget || portfolioTarget) {
    pageTasks.push(
      Promise.all([loadCases(), categoriesPromise])
        .then(([cases, categories]) => {
          const sortedCases = sortCasesByCategories(cases, categories);
          if (featuredTarget) {
            renderFeaturedCases(featuredTarget, sortedCases, categories);
          }
          if (portfolioTarget) {
            renderPortfolioFilters(sortedCases, categories);
            renderPortfolioCases(portfolioTarget, sortedCases, categories);
            bindPortfolioFilters(portfolioTarget, categories);
          }
        })
        .catch(() => {
          renderEmptyState(featuredTarget || portfolioTarget, "案例暂时加载失败，请稍后刷新。");
        })
    );
  }

  if (styleSelect) {
    pageTasks.push(
      categoriesPromise
        .then((categories) => populateStyleSelect(styleSelect, categories))
        .catch(() => null)
    );
  }

  if (needsPackages) {
    pageTasks.push(
      packagesPromise
        .then((packages) => {
          const sortedPackages = sortByOrder(packages);
          if (packagesTarget) renderPackages(packagesTarget, sortedPackages);
          if (packageSelect) populatePackageSelect(packageSelect, sortedPackages);
          if (packageSummary) renderPackageSummary(packageSummary, sortedPackages);
          if (upgradeCopyTarget || upgradeFlowTarget) {
            renderUpgradePolicy(upgradeCopyTarget, upgradeFlowTarget, sortedPackages);
          }
        })
        .catch(() => {
          if (packagesTarget) renderEmptyState(packagesTarget, "套餐信息暂时加载失败，请稍后刷新。");
        })
    );
  }

  Promise.allSettled(pageTasks).then(() => {
    document.dispatchEvent(new CustomEvent("yunmeng:catalog-ready"));
  });

  async function loadJson(url) {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Content request failed: ${url}`);
    return response.json();
  }

  async function loadCases() {
    const data = await loadJson(CASES_JSON_URL);
    return Array.isArray(data) ? data : data.cases || [];
  }

  async function loadCategories() {
    const data = await loadJson(CATEGORIES_JSON_URL);
    const categories = Array.isArray(data) ? data : data.categories || [];
    return categories.filter((item) => item.enabled !== false).sort(compareOrder);
  }

  async function loadPackages() {
    const data = await loadJson(PACKAGES_JSON_URL);
    return Array.isArray(data) ? data : data.packages || [];
  }

  function renderFeaturedCases(target, cases, categories) {
    const featuredCases = selectBalancedFeaturedCases(cases, categories, 4);
    target.innerHTML = "";

    featuredCases.forEach((item) => {
      const card = document.createElement("a");
      const theme = findCategory(categories, item.category);
      card.className = "case-card";
      card.href = theme ? `portfolio.html?theme=${encodeURIComponent(theme.slug)}` : "portfolio.html";
      card.innerHTML = [
        renderCaseImage(item, false),
        "<div>",
        `<span>${escapeHtml(item.category)}</span>`,
        `<h3>${escapeHtml(item.title)}</h3>`,
        "</div>"
      ].join("");
      bindImageFallback(card, item);
      target.appendChild(card);
    });
  }

  function selectBalancedFeaturedCases(cases, categories, limit) {
    const featured = cases.filter((item) => item.featured);
    const categoryNames = getOrderedCategoryNames(featured, categories);
    const grouped = categoryNames.map((category) => featured.filter((item) => item.category === category));
    const selected = [];
    let depth = 0;

    while (selected.length < limit && grouped.some((items) => items[depth])) {
      grouped.forEach((items) => {
        if (items[depth] && selected.length < limit) selected.push(items[depth]);
      });
      depth += 1;
    }

    return selected;
  }

  function renderPortfolioCases(target, cases, categories) {
    target.innerHTML = "";
    const categoryNames = getOrderedCategoryNames(cases, categories);

    categoryNames.forEach((categoryName) => {
      const theme = findCategory(categories, categoryName);
      const categoryCases = cases.filter((item) => item.category === categoryName);
      const section = document.createElement("section");
      const filter = getCategoryFilter(categoryName);
      section.className = "portfolio-category";
      section.dataset.filter = filter;
      section.innerHTML = [
        '<div class="portfolio-category-heading">',
        "<div>",
        `<span class="section-kicker">${escapeHtml(theme ? theme.slug.replace(/-/g, " ") : "Wedding Collection")}</span>`,
        `<h2>${escapeHtml(categoryName)}</h2>`,
        theme && theme.description ? `<p>${escapeHtml(theme.description)}</p>` : "",
        "</div>",
        `<span class="portfolio-count">${categoryCases.length} 组作品</span>`,
        "</div>",
        '<div class="case-grid portfolio-grid"></div>'
      ].join("");

      const grid = section.querySelector(".portfolio-grid");
      categoryCases.forEach((item, itemIndex) => {
        const isFirstVisibleImage = target.children.length === 0 && itemIndex === 0;
        grid.appendChild(createPortfolioCard(item, isFirstVisibleImage));
      });
      target.appendChild(section);
    });
  }

  function createPortfolioCard(item, isFirstVisibleImage) {
    const card = document.createElement("article");
    card.className = "case-card portfolio-item";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `查看${item.title}大图`);
    card.innerHTML = [
      renderCaseImage(item, isFirstVisibleImage),
      "<div>",
      `<span>${escapeHtml(item.category)}</span>`,
      `<h3>${escapeHtml(item.title)}</h3>`,
      item.description ? `<p>${escapeHtml(item.description)}</p>` : "",
      "</div>"
    ].join("");
    bindImageFallback(card, item);
    card.addEventListener("click", () => openCaseLightbox(item));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openCaseLightbox(item);
      }
    });
    return card;
  }

  function renderCaseImage(item, isPriority) {
    const source = normalizeAssetPath(item.imageThumb || item.imageOptimized || item.image);
    const width = Number(item.thumbWidth || item.imageWidth || 720);
    const height = Number(item.thumbHeight || item.imageHeight || 900);
    const loading = isPriority ? "eager" : "lazy";
    const priority = isPriority ? ' fetchpriority="high"' : "";
    return `<img src="${escapeAttribute(source)}" alt="${escapeAttribute(item.alt || item.title)}" width="${width}" height="${height}" loading="${loading}" decoding="async"${priority}>`;
  }

  function bindImageFallback(container, item) {
    const image = container.querySelector("img");
    if (!image) return;
    image.addEventListener("error", () => {
      const original = normalizeAssetPath(item.image);
      if (original && image.getAttribute("src") !== original) image.src = original;
    }, { once: true });
  }

  function renderPortfolioFilters(cases, categories) {
    const filterBar = document.querySelector(".filter-bar");
    if (!filterBar) return;

    filterBar.innerHTML = "";
    filterBar.appendChild(createFilterButton("全部", "all", true));
    getOrderedCategoryNames(cases, categories).forEach((category) => {
      filterBar.appendChild(createFilterButton(category, getCategoryFilter(category), false));
    });
  }

  function createFilterButton(label, filter, active) {
    const button = document.createElement("button");
    button.className = `filter-chip${active ? " active" : ""}`;
    button.type = "button";
    button.dataset.filter = filter;
    button.textContent = label;
    return button;
  }

  function bindPortfolioFilters(target, categories) {
    const filterButtons = Array.from(document.querySelectorAll(".filter-chip"));
    const themeFromUrl = new URLSearchParams(window.location.search).get("theme");
    const requestedTheme = categories.find((item) => item.slug === themeFromUrl);

    function applyFilter(filter) {
      filterButtons.forEach((item) => item.classList.toggle("active", item.dataset.filter === filter));
      target.querySelectorAll(".portfolio-category").forEach((section) => {
        const shouldShow = filter === "all" || section.dataset.filter === filter;
        section.classList.toggle("is-hidden", !shouldShow);
      });
    }

    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        applyFilter(button.dataset.filter);
        const theme = categories.find((item) => getCategoryFilter(item.name) === button.dataset.filter);
        const nextUrl = new URL(window.location.href);
        if (theme) nextUrl.searchParams.set("theme", theme.slug);
        else nextUrl.searchParams.delete("theme");
        window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}`);
      });
    });

    if (requestedTheme) applyFilter(getCategoryFilter(requestedTheme.name));
  }

  function renderPackages(target, packages) {
    target.innerHTML = "";
    packages.forEach((item) => {
      const card = document.createElement("article");
      const classNames = ["price-card", item.styleClass || item.slug || ""];
      if (item.recommended) classNames.push("recommended");
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

  function populatePackageSelect(select, packages) {
    const currentValue = select.value;
    select.innerHTML = '<option value="">请选择套餐</option>';
    packages.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.contactPackage || item.name;
      option.textContent = item.contactPackage || item.name;
      select.appendChild(option);
    });
    const unsure = document.createElement("option");
    unsure.value = "还不确定，想先咨询";
    unsure.textContent = "还不确定，想先咨询";
    select.appendChild(unsure);
    if (Array.from(select.options).some((option) => option.value === currentValue)) select.value = currentValue;
  }

  function populateStyleSelect(select, categories) {
    const currentValue = select.value;
    select.innerHTML = '<option value="">请选择风格</option>';
    categories.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.name;
      option.textContent = item.name;
      select.appendChild(option);
    });
    const unsure = document.createElement("option");
    unsure.value = "还不确定，需要推荐";
    unsure.textContent = "还不确定，需要推荐";
    select.appendChild(unsure);
    if (Array.from(select.options).some((option) => option.value === currentValue)) select.value = currentValue;
  }

  function renderPackageSummary(target, packages) {
    if (!packages.length) return;
    const first = packages[0];
    const last = packages[packages.length - 1];
    target.textContent = `目前提供 ${packages.length} 档套餐：从 ${stripCurrency(first.price)} 元${first.name}，到 ${stripCurrency(last.price)} 元${last.name}，已支付金额可 100% 抵扣升级。`;
  }

  function renderUpgradePolicy(copyTarget, flowTarget, packages) {
    if (packages.length < 2) return;
    const upgrades = packages.slice(0, -1).map((item, index) => ({
      from: item,
      to: packages[index + 1],
      difference: parsePrice(packages[index + 1].price) - parsePrice(item.price)
    }));

    if (copyTarget) {
      const examples = upgrades.map((item) => `从${item.from.name}升级到${item.to.name}，补 ${formatCurrency(item.difference)}`).join("；");
      const directDifference = parsePrice(packages[packages.length - 1].price) - parsePrice(packages[0].price);
      copyTarget.innerHTML = [
        `<p>已支付金额 100% 抵扣，满意后只需补齐差价即可升级。${escapeHtml(examples)}。</p>`,
        `<p>从${escapeHtml(packages[0].name)}一步升级至${escapeHtml(packages[packages.length - 1].name)}，补 ${escapeHtml(formatCurrency(directDifference))}。体验价每人限购 1 次，抵扣仅限同一套素材内升级，有效期为下单后 30 天内。</p>`
      ].join("");
    }

    if (flowTarget) {
      flowTarget.innerHTML = "";
      packages.forEach((item, index) => {
        const node = document.createElement("div");
        if (item.recommended) node.className = "active";
        node.innerHTML = `<strong>${escapeHtml(item.price)}</strong><span>${escapeHtml(item.name)}</span>`;
        flowTarget.appendChild(node);
        if (index < upgrades.length) {
          const difference = document.createElement("b");
          difference.textContent = `补 ${formatCurrency(upgrades[index].difference)}`;
          flowTarget.appendChild(difference);
        }
      });
    }
  }

  function ensureCaseLightbox() {
    let lightbox = document.querySelector(".case-lightbox");
    if (lightbox) return lightbox;

    lightbox = document.createElement("div");
    lightbox.className = "case-lightbox";
    lightbox.hidden = true;
    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");
    lightbox.setAttribute("aria-label", "作品大图预览");
    lightbox.innerHTML = [
      '<div class="case-lightbox-dialog">',
      '<button class="case-lightbox-close" type="button" aria-label="关闭作品预览">×</button>',
      '<img src="" alt="">',
      '<div class="case-lightbox-copy"><span></span><h2></h2><p></p></div>',
      "</div>"
    ].join("");
    document.body.appendChild(lightbox);

    lightbox.querySelector(".case-lightbox-close").addEventListener("click", closeCaseLightbox);
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) closeCaseLightbox();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !lightbox.hidden) closeCaseLightbox();
    });
    return lightbox;
  }

  let lightboxReturnFocus = null;

  function openCaseLightbox(item) {
    const lightbox = ensureCaseLightbox();
    const image = lightbox.querySelector("img");
    lightboxReturnFocus = document.activeElement;
    image.src = normalizeAssetPath(item.imageOptimized || item.image);
    image.alt = item.alt || item.title;
    lightbox.querySelector(".case-lightbox-copy span").textContent = item.category || "";
    lightbox.querySelector(".case-lightbox-copy h2").textContent = item.title || "";
    lightbox.querySelector(".case-lightbox-copy p").textContent = item.description || "";
    lightbox.hidden = false;
    document.body.classList.add("lightbox-open");
    lightbox.querySelector(".case-lightbox-close").focus();
  }

  function closeCaseLightbox() {
    const lightbox = document.querySelector(".case-lightbox");
    if (!lightbox || lightbox.hidden) return;
    lightbox.hidden = true;
    document.body.classList.remove("lightbox-open");
    if (lightboxReturnFocus && typeof lightboxReturnFocus.focus === "function") lightboxReturnFocus.focus();
  }

  function getOrderedCategoryNames(cases, categories) {
    const caseCategories = new Set(cases.map((item) => String(item.category || "").trim()).filter(Boolean));
    const ordered = categories.map((item) => item.name).filter((name) => caseCategories.has(name));
    caseCategories.forEach((name) => {
      if (!ordered.includes(name)) ordered.push(name);
    });
    return ordered;
  }

  function findCategory(categories, name) {
    return categories.find((item) => item.name === name) || null;
  }

  function sortCasesByCategories(items, categories) {
    const rank = new Map(categories.map((item, index) => [item.name, index]));
    return items.slice().sort((a, b) => {
      const rankA = rank.has(a.category) ? rank.get(a.category) : 9999;
      const rankB = rank.has(b.category) ? rank.get(b.category) : 9999;
      if (rankA !== rankB) return rankA - rankB;
      const orderDifference = Number(a.order || 0) - Number(b.order || 0);
      if (orderDifference !== 0) return orderDifference;
      return String(a.title || "").localeCompare(String(b.title || ""), "zh-Hans-CN");
    });
  }

  function sortByOrder(items) {
    return items.slice().sort(compareOrder);
  }

  function compareOrder(a, b) {
    return Number(a.order || 0) - Number(b.order || 0);
  }

  function getCategoryFilter(category) {
    const value = String(category || "").trim();
    return value ? `category-${hashString(value)}` : "category-other";
  }

  function hashString(value) {
    let hash = 0;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  function parsePrice(price) {
    return Number(String(price || "").replace(/[^\d.]/g, "")) || 0;
  }

  function stripCurrency(price) {
    return String(price || "").replace(/[^\d.]/g, "");
  }

  function formatCurrency(value) {
    const normalized = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
    return `¥${normalized}`;
  }

  function normalizeAssetPath(assetPath) {
    return String(assetPath || "").replace(/^\/+/, "");
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
    if (!target) return;
    target.innerHTML = `<p class="muted">${escapeHtml(message)}</p>`;
  }
})();
