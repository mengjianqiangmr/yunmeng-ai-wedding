(function () {
  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    navLinks.addEventListener("click", (event) => {
      if (event.target.matches("a")) {
        navLinks.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  const filterButtons = document.querySelectorAll(".filter-chip");
  const portfolioItems = document.querySelectorAll(".portfolio-item");

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;

      filterButtons.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      portfolioItems.forEach((item) => {
        const shouldShow = filter === "all" || item.dataset.style === filter;
        item.classList.toggle("is-hidden", !shouldShow);
      });
    });
  });

  const packageSelect = document.querySelector("#packageSelect");
  const params = new URLSearchParams(window.location.search);
  const packageFromUrl = params.get("package");

  if (packageSelect && packageFromUrl) {
    const option = Array.from(packageSelect.options).find((item) => item.value === packageFromUrl);
    if (option) {
      packageSelect.value = option.value;
      localStorage.setItem("yunmengSelectedPackage", option.value);
    }
  } else if (packageSelect) {
    const savedPackage = localStorage.getItem("yunmengSelectedPackage");
    if (savedPackage) {
      const option = Array.from(packageSelect.options).find((item) => item.value === savedPackage);
      if (option) {
        packageSelect.value = option.value;
      }
    }
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (target) {
        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  const orderForm = document.querySelector("#orderForm");
  const successPanel = document.querySelector("#successPanel");
  const orderSummary = document.querySelector("#orderSummary");

  if (orderForm) {
    orderForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(orderForm);
      const order = Object.fromEntries(formData.entries());

      const isValid = validateOrderForm(orderForm, order);
      if (!isValid) {
        return;
      }

      submitOrder(order);
      renderOrderSummary(order);
      orderForm.reset();

      if (packageFromUrl && packageSelect) {
        packageSelect.value = packageFromUrl;
      }
    });
  }

  function validateOrderForm(form, order) {
    let isValid = true;
    const requiredFields = [
      { name: "nickname", message: "请填写昵称" },
      { name: "contact", message: "请填写微信号或联系方式" }
    ];

    form.querySelectorAll(".error-message").forEach((item) => {
      item.textContent = "";
    });

    requiredFields.forEach((field) => {
      const input = form.elements[field.name];
      const label = input.closest("label");
      const error = label.querySelector(".error-message");

      if (!order[field.name] || !order[field.name].trim()) {
        isValid = false;
        error.textContent = field.message;
        input.setAttribute("aria-invalid", "true");
      } else {
        input.removeAttribute("aria-invalid");
      }
    });

    return isValid;
  }

  function renderOrderSummary(order) {
    if (!successPanel || !orderSummary) {
      return;
    }

    const labels = {
      nickname: "昵称",
      contact: "联系方式",
      type: "定制类型",
      package: "意向套餐",
      style: "喜欢风格",
      urgent: "是否加急",
      message: "备注需求"
    };

    orderSummary.innerHTML = "";
    Object.entries(labels).forEach(([key, label]) => {
      const value = order[key] && order[key].trim() ? order[key] : "未填写";
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = value;
      orderSummary.append(dt, dd);
    });

    successPanel.hidden = false;
    successPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    window.alert("提交成功，咨询意向已保存。");
  }

  window.submitOrder = function submitOrder(order) {
    const orderWithMeta = {
      ...order,
      submittedAt: new Date().toISOString()
    };

    localStorage.setItem("yunmengLatestOrder", JSON.stringify(orderWithMeta));
    localStorage.setItem("yunmengSelectedPackage", order.package);

    // 正式接入时，可在这里把咨询信息发送到表格或后端服务。
  };
})();
