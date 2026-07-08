(function () {
  const CONTACT_FORM_ENDPOINT = "";
  const SERVICE_WECHAT_ID = "YOUR_WECHAT_ID";

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
  const packageValueMap = {
    "体验试拍版": "29.9元体验试拍版",
    "效果确认版": "199元效果确认版",
    "婚礼实用版": "599元婚礼实用版",
    "婚礼全流程版": "999元全流程定制版",
    "29.9元体验试拍版": "29.9元体验试拍版",
    "199元效果确认版": "199元效果确认版",
    "599元婚礼实用版": "599元婚礼实用版",
    "999元全流程定制版": "999元全流程定制版",
    "还不确定，想先咨询": "还不确定，想先咨询"
  };
  const normalizedPackageFromUrl = packageValueMap[packageFromUrl] || packageFromUrl;

  if (packageSelect && normalizedPackageFromUrl) {
    const option = Array.from(packageSelect.options).find((item) => item.value === normalizedPackageFromUrl);
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

  const contactForm = document.querySelector("#contactForm");
  const successPanel = document.querySelector("#successPanel");
  const contactSummary = document.querySelector("#contactSummary");
  const formAlert = document.querySelector("#formAlert");
  const submitWarning = document.querySelector("#submitWarning");
  const copySummaryBtn = document.querySelector("#copySummaryBtn");
  const copyWechatBtn = document.querySelector("#copyWechatBtn");
  const contactSubmit = document.querySelector("#contactSubmit");
  const serviceWechat = document.querySelector("#serviceWechat");
  let latestSummaryText = "";

  if (serviceWechat) {
    serviceWechat.textContent = SERVICE_WECHAT_ID;
  }

  if (contactForm) {
    contactForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formPayload = collectContactForm(contactForm);
      const isValid = validateContactForm(contactForm, formPayload);
      if (!isValid) {
        return;
      }

      setSubmitState(true);

      try {
        const submitResult = await submitContactForm(formPayload);
        latestSummaryText = buildContactSummary(formPayload);
        renderContactSummary(latestSummaryText, !submitResult.ok);

        localStorage.setItem("yunmengLatestContact", JSON.stringify(formPayload));
        localStorage.setItem("yunmengSelectedPackage", formPayload.package);
      } finally {
        setSubmitState(false);
      }
    });
  }

  if (copySummaryBtn) {
    copySummaryBtn.addEventListener("click", () => {
      if (latestSummaryText) {
        copyText(latestSummaryText, copySummaryBtn, "已复制");
      }
    });
  }

  if (copyWechatBtn) {
    copyWechatBtn.addEventListener("click", () => {
      copyText(SERVICE_WECHAT_ID, copyWechatBtn, "已复制微信号");
    });
  }

  function collectContactForm(form) {
    const formData = new FormData(form);
    const submittedAt = new Date();

    return {
      name: normalizeValue(formData.get("name")),
      wechat: normalizeValue(formData.get("wechat")),
      phone: normalizeValue(formData.get("phone")),
      package: normalizeValue(formData.get("package")),
      style: normalizeValue(formData.get("style")),
      usage: formData.getAll("usage").map(normalizeValue).filter(Boolean),
      urgent: normalizeValue(formData.get("urgent")) || "不加急，正常制作",
      message: normalizeValue(formData.get("message")),
      submittedAt: submittedAt.toISOString(),
      submittedAtText: formatSubmittedAt(submittedAt)
    };
  }

  function normalizeValue(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function validateContactForm(form, data) {
    let isValid = true;
    const requiredFields = [
      { name: "name", message: "请填写称呼" },
      { name: "package", message: "请选择套餐" },
      { name: "style", message: "请选择想要风格" }
    ];

    clearFormErrors(form);

    requiredFields.forEach((field) => {
      if (!data[field.name]) {
        isValid = false;
        setFieldError(form, field.name, field.message);
      }
    });

    if (!data.wechat && !data.phone) {
      isValid = false;
      setFieldError(form, "wechat", "微信号和手机号至少填写一个");
      setFieldError(form, "phone", "微信号和手机号至少填写一个");
    }

    if (!isValid) {
      showFormAlert("请先完善标红的咨询信息，再生成咨询摘要。");
    }

    return isValid;
  }

  function clearFormErrors(form) {
    form.querySelectorAll(".error-message").forEach((item) => {
      item.textContent = "";
    });
    form.querySelectorAll("[aria-invalid='true']").forEach((item) => {
      item.removeAttribute("aria-invalid");
    });
    hideFormAlert();
  }

  function setFieldError(form, fieldName, message) {
    const input = form.elements[fieldName];
    if (!input) {
      return;
    }

    const field = input.nodeType === 1 ? input : input[0];
    const label = field.closest("label");
    const error = label ? label.querySelector(".error-message") : null;

    if (error) {
      error.textContent = message;
    }
    field.setAttribute("aria-invalid", "true");
  }

  function showFormAlert(message) {
    if (!formAlert) {
      return;
    }
    formAlert.textContent = message;
    formAlert.hidden = false;
  }

  function hideFormAlert() {
    if (!formAlert) {
      return;
    }
    formAlert.textContent = "";
    formAlert.hidden = true;
  }

  function buildContactSummary(data) {
    return [
      "【AI婚纱照咨询】",
      `称呼：${data.name}`,
      `微信号：${data.wechat || "未填写"}`,
      `手机号：${data.phone || "未填写"}`,
      `选择套餐：${data.package}`,
      `想要风格：${data.style}`,
      `使用用途：${data.usage.length ? data.usage.join("、") : "未填写"}`,
      `是否加急：${data.urgent}`,
      `备注需求：${data.message || "未填写"}`,
      `提交时间：${data.submittedAtText}`
    ].join("\n");
  }

  function renderContactSummary(summaryText, shouldShowWarning) {
    if (!successPanel || !contactSummary) {
      return;
    }

    contactSummary.textContent = summaryText;
    if (submitWarning) {
      submitWarning.hidden = !shouldShowWarning;
    }
    successPanel.hidden = false;
    successPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function formatSubmittedAt(date) {
    const pad = (number) => String(number).padStart(2, "0");
    return [
      `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(date.getDate())}日`,
      `${pad(date.getHours())}:${pad(date.getMinutes())}`
    ].join(" ");
  }

  function setSubmitState(isLoading) {
    if (!contactSubmit) {
      return;
    }

    contactSubmit.disabled = isLoading;
    contactSubmit.textContent = isLoading ? "生成中..." : "生成咨询摘要";
  }

  async function copyText(text, button, copiedText) {
    const originalText = button.textContent;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }

      button.textContent = copiedText;
      window.setTimeout(() => {
        button.textContent = originalText;
      }, 1600);
    } catch (error) {
      button.textContent = "复制失败，请手动复制";
      window.setTimeout(() => {
        button.textContent = originalText;
      }, 1800);
    }
  }

  async function submitContactForm(formData) {
    if (!CONTACT_FORM_ENDPOINT) {
      return { ok: true, skipped: true };
    }

    try {
      const response = await fetch(CONTACT_FORM_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: formData.name,
          wechat: formData.wechat,
          phone: formData.phone,
          package: formData.package,
          style: formData.style,
          usage: formData.usage,
          urgent: formData.urgent,
          message: formData.message,
          submittedAt: formData.submittedAt
        })
      });

      return { ok: response.ok, status: response.status };
    } catch (error) {
      return { ok: false, error };
    }
  }

  window.submitContactForm = submitContactForm;
})();
