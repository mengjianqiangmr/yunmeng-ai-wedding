(function () {
  const CONTACT_FORM_ENDPOINT = "https://formspree.io/f/xqevoron";
  const SERVICE_WECHAT_ID = "mengjianqiang0918";

  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");

  if (navToggle && navLinks) {
    const setNavigationState = (isOpen) => {
      navLinks.classList.toggle("open", isOpen);
      navToggle.setAttribute("aria-expanded", String(isOpen));
      navToggle.setAttribute("aria-label", isOpen ? "关闭导航" : "展开导航");
    };

    navToggle.addEventListener("click", () => {
      setNavigationState(!navLinks.classList.contains("open"));
    });

    navLinks.addEventListener("click", (event) => {
      if (event.target.matches("a")) {
        setNavigationState(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && navLinks.classList.contains("open")) {
        setNavigationState(false);
        navToggle.focus();
      }
    });
  }

  const packageSelect = document.querySelector("#packageSelect");
  const params = new URLSearchParams(window.location.search);
  const packageFromUrl = params.get("package");
  const packageValueMap = {
    "体验试拍版": "29.9元体验试拍版",
    "效果确认版": "199元效果确认版",
    "婚礼实用版": "599元婚礼实用版",
    "婚礼全流程版": "999元婚礼全流程版",
    "29.9元体验试拍版": "29.9元体验试拍版",
    "199元效果确认版": "199元效果确认版",
    "599元婚礼实用版": "599元婚礼实用版",
    "999元全流程定制版": "999元婚礼全流程版",
    "999元婚礼全流程版": "999元婚礼全流程版",
    "还不确定，想先咨询": "还不确定，想先咨询"
  };
  const normalizedPackageFromUrl = packageValueMap[packageFromUrl] || packageFromUrl;

  function applySelectedPackage() {
    if (!packageSelect) return;
    const targetPackage = normalizedPackageFromUrl || localStorage.getItem("yunmengSelectedPackage");
    if (targetPackage) {
      const option = Array.from(packageSelect.options).find((item) => item.value === targetPackage);
      if (option) {
        packageSelect.value = option.value;
        if (normalizedPackageFromUrl) localStorage.setItem("yunmengSelectedPackage", option.value);
      }
    }
  }

  applySelectedPackage();
  document.addEventListener("yunmeng:catalog-ready", applySelectedPackage);

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
  const submitTitle = document.querySelector("#submitTitle");
  const resultIcon = document.querySelector("#resultIcon");
  const formAlert = document.querySelector("#formAlert");
  const submitStatus = document.querySelector("#submitStatus");
  const submitNote = document.querySelector("#submitNote");
  const submitMeta = document.querySelector("#submitMeta");
  const contactDetailsList = document.querySelector("#contactDetailsList");
  const copyWechatBtn = document.querySelector("#copyWechatBtn");
  const retryContactBtn = document.querySelector("#retryContactBtn");
  const contactSubmit = document.querySelector("#contactSubmit");
  const serviceWechat = document.querySelector("#serviceWechat");

  if (serviceWechat) {
    serviceWechat.textContent = SERVICE_WECHAT_ID;
  }

  if (contactForm) {
    if (successPanel) {
      successPanel.hidden = true;
    }

    contactForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (successPanel) {
        successPanel.hidden = true;
      }

      const formPayload = collectContactForm(contactForm);
      const isValid = validateContactForm(contactForm, formPayload);
      if (!isValid) {
        return;
      }

      setSubmitState(true);

      try {
        const submitResult = await submitContactForm(formPayload);
        if (!submitResult.ok) {
          renderContactFailure(formPayload);
          showToast("在线提交暂时失败，请添加客服微信联系");
          return;
        }

        renderContactResult(formPayload);
        showToast("咨询信息已接收，我们会尽快联系你");

        localStorage.setItem("yunmengSelectedPackage", formPayload.package);
      } finally {
        setSubmitState(false);
      }
    });
  }

  if (copyWechatBtn) {
    copyWechatBtn.addEventListener("click", () => {
      const wechatText = serviceWechat ? serviceWechat.textContent.trim() : SERVICE_WECHAT_ID;
      copyText(wechatText, copyWechatBtn, "已复制微信号");
    });
  }

  if (retryContactBtn) {
    retryContactBtn.addEventListener("click", () => {
      if (successPanel) successPanel.hidden = true;
      if (contactForm) {
        contactForm.hidden = false;
        contactForm.scrollIntoView({ behavior: "smooth", block: "start" });
      }
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
      privacyConsent: normalizeValue(formData.get("privacyConsent")),
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
      { name: "style", message: "请选择想要风格" },
      { name: "privacyConsent", message: "请阅读并同意隐私说明" }
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
      showFormAlert("请先完善标红的咨询信息，再提交咨询。");
      const firstInvalid = form.querySelector("[aria-invalid='true']");
      if (firstInvalid) firstInvalid.focus();
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

  function renderContactResult(data) {
    if (!successPanel) {
      return;
    }

    if (submitTitle) {
      submitTitle.textContent = "咨询信息已接收";
    }
    if (resultIcon) {
      resultIcon.textContent = "✓";
      resultIcon.classList.remove("is-error");
    }
    if (submitStatus) {
      submitStatus.textContent = "你的 AI 婚纱照定制需求已成功提交，系统已同步发送到客服邮箱。我们会尽快通过你填写的微信号或手机号与你联系。";
    }
    if (submitNote) {
      submitNote.textContent = "为了更快确认制作方案，你也可以主动添加客服微信，发送人物照片和参考风格图。";
    }
    if (submitMeta) {
      submitMeta.textContent = `提交时间：${data.submittedAtText}`;
    }
    if (retryContactBtn) retryContactBtn.hidden = true;
    renderContactDetails(data);
    contactForm.hidden = true;
    successPanel.hidden = false;
    successPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderContactFailure(data) {
    if (!successPanel) return;
    if (resultIcon) {
      resultIcon.textContent = "!";
      resultIcon.classList.add("is-error");
    }
    if (submitTitle) submitTitle.textContent = "提交暂时失败";
    if (submitStatus) {
      submitStatus.textContent = "在线提交暂时失败，你填写的内容没有丢失。请复制客服微信，添加后直接发送婚纱照需求，我们会尽快为你对接。";
    }
    if (submitNote) {
      submitNote.textContent = `客服微信：${SERVICE_WECHAT_ID}`;
    }
    if (submitMeta) submitMeta.textContent = `尝试提交时间：${data.submittedAtText}`;
    if (retryContactBtn) retryContactBtn.hidden = false;
    renderContactDetails(data);
    contactForm.hidden = true;
    successPanel.hidden = false;
    successPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderContactDetails(data) {
    if (!contactDetailsList) {
      return;
    }

    const detailItems = [
      ["称呼", data.name],
      ["微信号", data.wechat || "未填写"],
      ["手机号", data.phone || "未填写"],
      ["选择套餐", data.package],
      ["想要风格", data.style],
      ["使用用途", data.usage.length ? data.usage.join("、") : "未填写"],
      ["是否加急", data.urgent],
      ["备注需求", data.message || "未填写"],
      ["隐私说明", data.privacyConsent || "未确认"],
      ["提交时间", data.submittedAtText]
    ];

    contactDetailsList.innerHTML = "";
    detailItems.forEach(([label, value]) => {
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = label;
      description.textContent = value;
      contactDetailsList.append(term, description);
    });
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
    contactSubmit.textContent = isLoading ? "提交中..." : "提交咨询信息";
  }

  async function copyText(text, button, copiedText) {
    const originalText = button.textContent;

    try {
      let isCopied = false;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          isCopied = true;
        } catch (error) {
          isCopied = false;
        }
      }

      if (!isCopied) {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        isCopied = document.execCommand("copy");
        textarea.remove();
      }

      if (!isCopied) {
        throw new Error("Copy failed");
      }

      button.textContent = copiedText;
      showToast(copiedText === "已复制微信号" ? "客服微信号已复制" : copiedText);
      window.setTimeout(() => {
        button.textContent = originalText;
      }, 1800);
    } catch (error) {
      button.textContent = "复制失败，请手动复制微信号";
      showToast("复制失败，请手动复制微信号");
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
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          name: formData.name,
          wechat: formData.wechat,
          phone: formData.phone,
          package: formData.package,
          style: formData.style,
          usage: formData.usage.join("、"),
          urgent: formData.urgent,
          message: formData.message,
          privacyConsent: formData.privacyConsent,
          submittedAt: formData.submittedAt,
          _subject: "新的AI婚纱照客户咨询"
        })
      });

      return { ok: response.ok, status: response.status };
    } catch (error) {
      return { ok: false, error };
    }
  }

  window.submitContactForm = submitContactForm;

  function showToast(message) {
    let toast = document.querySelector(".site-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "site-toast";
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.classList.remove("show");
    }, 2400);
  }
})();
