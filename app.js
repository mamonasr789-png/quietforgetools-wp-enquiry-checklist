(function () {
  "use strict";

  var CHECKS = [
    {
      id: "form-submits",
      title: "Form submits successfully",
      hint: "Fill required fields and submit. Confirm the request completes without a blank page, hang, or silent failure.",
      category: "enquiry"
    },
    {
      id: "success-error",
      title: "Success or error response appears",
      hint: "After submit, a clear success message, thank-you state, or understandable error is shown on screen.",
      category: "enquiry"
    },
    {
      id: "notification-email",
      title: "Notification email arrives",
      hint: "Check the address that should receive new enquiries. Allow a few minutes; try a second test if needed.",
      category: "enquiry"
    },
    {
      id: "spam-junk",
      title: "Spam / junk folder checked",
      hint: "Look in spam, junk, promotions, and any filtered folders for the notification or autoresponder.",
      category: "enquiry"
    },
    {
      id: "admin-recipient",
      title: "Admin recipient address is correct",
      hint: "Confirm the form notification goes to the right mailbox (not an old staff address or typo).",
      category: "enquiry"
    },
    {
      id: "smtp-configured",
      title: "SMTP / mail delivery configured",
      hint: "WordPress mail often needs an SMTP plugin or host relay. Check whether transactional mail is set up at all.",
      category: "enquiry"
    },
    {
      id: "mobile-form",
      title: "Mobile form works",
      hint: "On a phone or narrow viewport: fields usable, submit reachable, keyboard does not hide the button.",
      category: "enquiry"
    },
    {
      id: "required-validation",
      title: "Required-field validation works",
      hint: "Submit empty/invalid fields. Required rules should block send and explain what is missing.",
      category: "enquiry"
    },
    {
      id: "thankyou-path",
      title: "Confirmation / thank-you path works",
      hint: "After a valid submit, redirect or on-page thank-you appears and is not a 404 or wrong page.",
      category: "enquiry"
    },
    {
      id: "crm-inbox",
      title: "Enquiry reaches CRM / inbox where applicable",
      hint: "If you use CRM, Slack, or a shared inbox integration, confirm the lead lands there — not only in email.",
      category: "enquiry"
    },
    {
      id: "recent-changes",
      title: "Recent plugin / theme / update changes considered",
      hint: "Note anything updated or changed recently (form plugin, theme, security, caching, CDN). Correlate with when breakage started.",
      category: "maintenance"
    },
    {
      id: "backup-exists",
      title: "Backup exists before modifications",
      hint: "Before changing plugins, theme, or mail settings, confirm a recent backup (files + database) is available.",
      category: "maintenance"
    }
  ];

  var STATES = [
    { value: "pass", label: "Pass" },
    { value: "fail", label: "Fail" },
    { value: "unsure", label: "Not sure" },
    { value: "na", label: "N/A" }
  ];

  var answers = {};
  var lastReport = "";

  var listEl = document.getElementById("checks-list");
  var resultsEl = document.getElementById("results");
  var failedList = document.getElementById("failed-list");
  var unsureList = document.getElementById("unsure-list");
  var failedEmpty = document.getElementById("failed-empty");
  var unsureEmpty = document.getElementById("unsure-empty");
  var recommendationEl = document.getElementById("recommendation");
  var reportText = document.getElementById("report-text");
  var copyStatus = document.getElementById("copy-status");
  var serviceHint = document.getElementById("service-hint");
  var btnGenerate = document.getElementById("btn-generate");
  var btnCopy = document.getElementById("btn-copy");
  var btnReset = document.getElementById("btn-reset");

  function buildChecklist() {
    var html = "";
    for (var i = 0; i < CHECKS.length; i++) {
      var c = CHECKS[i];
      var groupName = "check-" + c.id;
      html += '<li class="check-item" data-id="' + c.id + '">';
      html += '<div class="check-title" id="label-' + c.id + '">' + escapeHtml(c.title) + "</div>";
      html += '<p class="check-hint">' + escapeHtml(c.hint) + "</p>";
      html += '<div class="states" role="radiogroup" aria-labelledby="label-' + c.id + '">';
      for (var s = 0; s < STATES.length; s++) {
        var st = STATES[s];
        var inputId = groupName + "-" + st.value;
        html +=
          '<label class="state-opt" data-state="' +
          st.value +
          '" for="' +
          inputId +
          '">' +
          '<input type="radio" name="' +
          groupName +
          '" id="' +
          inputId +
          '" value="' +
          st.value +
          '" />' +
          '<span>' +
          escapeHtml(st.label) +
          "</span></label>";
      }
      html += "</div></li>";
    }
    listEl.innerHTML = html;

    listEl.addEventListener("change", function (e) {
      var t = e.target;
      if (!t || t.type !== "radio") return;
      var id = t.name.replace(/^check-/, "");
      answers[id] = t.value;
      updateSelectedStyles(t.closest(".check-item"));
      copyStatus.textContent = "";
    });
  }

  function updateSelectedStyles(item) {
    if (!item) return;
    var opts = item.querySelectorAll(".state-opt");
    for (var i = 0; i < opts.length; i++) {
      var inp = opts[i].querySelector("input");
      if (inp && inp.checked) opts[i].classList.add("selected");
      else opts[i].classList.remove("selected");
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getAnswer(id) {
    return answers[id] || "";
  }

  function collectByState(state) {
    var out = [];
    for (var i = 0; i < CHECKS.length; i++) {
      if (getAnswer(CHECKS[i].id) === state) out.push(CHECKS[i]);
    }
    return out;
  }

  function unansweredCount() {
    var n = 0;
    for (var i = 0; i < CHECKS.length; i++) {
      if (!getAnswer(CHECKS[i].id)) n++;
    }
    return n;
  }

  function recommendCategory(failed, unsure) {
    var enquiryFail = 0;
    var maintFail = 0;
    var enquiryUnsure = 0;
    var maintUnsure = 0;
    var all = failed.concat(unsure);
    for (var i = 0; i < failed.length; i++) {
      if (failed[i].category === "maintenance") maintFail++;
      else enquiryFail++;
    }
    for (var j = 0; j < unsure.length; j++) {
      if (unsure[j].category === "maintenance") maintUnsure++;
      else enquiryUnsure++;
    }

    if (failed.length === 0 && unsure.length === 0) {
      return {
        text: "No Fail or Not-sure items. If the form still misbehaves in production, re-test from another device/network and note exact steps — the checklist alone cannot prove server-side delivery.",
        highlight: null
      };
    }

    // Backup missing alone → maintenance / safety
    var backupFail = getAnswer("backup-exists") === "fail";
    var recentFail = getAnswer("recent-changes") === "fail";

    if (enquiryFail >= 2 || (enquiryFail >= 1 && enquiryUnsure >= 1)) {
      return {
        text: "Several enquiry-path items failed or are uncertain (submit, response, email, SMTP, validation, thank-you, or CRM). Investigate the form → mail → inbox chain. A bounded Enquiry Path Repair may fit if one clear defect can be agreed.",
        highlight: "149"
      };
    }

    if (maintFail >= 1 && enquiryFail === 0) {
      return {
        text: "Issues centre on recent changes and/or backup readiness rather than a confirmed form defect. Prefer a careful Update & Safety Check (or restore from backup) before changing live mail/form settings.",
        highlight: "59"
      };
    }

    if (backupFail || recentFail) {
      return {
        text: "Recent changes or missing backup are flagged. Stabilise backups and review what changed before deeper form surgery. Update & Safety Check is the restrained next step if you want help with that pass.",
        highlight: "59"
      };
    }

    if (enquiryFail === 1 && failed.length === 1) {
      return {
        text: "One clear Fail on the enquiry path. Narrow that single issue (reproduce, note plugin/theme, capture any error). A WordPress Quick Fix may fit a small defined problem; use Enquiry Path Repair if the defect spans form + mail delivery.",
        highlight: "49"
      };
    }

    if (unsure.length > 0 && failed.length === 0) {
      return {
        text: "Nothing marked Fail yet — several items are Not sure. Re-test those steps (especially email, spam, SMTP, and mobile) before changing production settings.",
        highlight: null
      };
    }

    return {
      text: "Mixed signals across the enquiry path. Reproduce the failure once more, list Fail items in priority order, then decide whether the defect is a single small fix or a full form→mail path repair.",
      highlight: enquiryFail > 0 ? "149" : null
    };
  }

  function setServiceHighlight(key) {
    var ids = ["svc-149", "svc-59", "svc-49"];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) el.classList.remove("highlight");
    }
    if (key === "149") {
      document.getElementById("svc-149").classList.add("highlight");
      serviceHint.textContent =
        "Based on your Fail items, £149 Enquiry Path Repair is the most relevant option if you want paid help — still optional.";
    } else if (key === "59") {
      document.getElementById("svc-59").classList.add("highlight");
      serviceHint.textContent =
        "Based on your marks, £59 Update & Safety Check is the most relevant option if you want paid help — still optional.";
    } else if (key === "49") {
      document.getElementById("svc-49").classList.add("highlight");
      serviceHint.textContent =
        "Based on a single defined Fail, £49 WordPress Quick Fix may fit — still optional. All three services remain available.";
    } else {
      serviceHint.textContent =
        "No hard sales recommendation. All three fixed-price options remain available if you want help later.";
    }
  }

  function stateLabel(v) {
    if (v === "pass") return "PASS";
    if (v === "fail") return "FAIL";
    if (v === "unsure") return "NOT SURE";
    if (v === "na") return "NOT APPLICABLE";
    return "UNANSWERED";
  }

  function buildReport(failed, unsure, rec) {
    var lines = [];
    lines.push("QuietForgeTools — WordPress Enquiry Path Checklist");
    lines.push("Diagnostic report (manual checklist — not an automatic scan)");
    lines.push("Generated: " + new Date().toISOString());
    lines.push("");
    lines.push("=== RESULTS BY ITEM ===");
    for (var i = 0; i < CHECKS.length; i++) {
      var c = CHECKS[i];
      lines.push((i + 1) + ". [" + stateLabel(getAnswer(c.id)) + "] " + c.title);
    }
    lines.push("");
    lines.push("=== FAILED ===");
    if (failed.length === 0) lines.push("(none)");
    else {
      for (var f = 0; f < failed.length; f++) lines.push("- " + failed[f].title);
    }
    lines.push("");
    lines.push("=== NOT SURE ===");
    if (unsure.length === 0) lines.push("(none)");
    else {
      for (var u = 0; u < unsure.length; u++) lines.push("- " + unsure[u].title);
    }
    lines.push("");
    lines.push("=== RECOMMENDED NEXT INVESTIGATION ===");
    lines.push(rec.text);
    lines.push("");
    lines.push("Privacy note: this report was generated locally in the browser.");
    lines.push("QuietForgeTools does not receive your answers.");
    return lines.join("\n");
  }

  function fillList(ul, emptyEl, items) {
    ul.innerHTML = "";
    if (items.length === 0) {
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    for (var i = 0; i < items.length; i++) {
      var li = document.createElement("li");
      li.textContent = items[i].title;
      ul.appendChild(li);
    }
  }

  function generate() {
    var open = unansweredCount();
    if (open > 0) {
      copyStatus.textContent =
        open +
        " item" +
        (open === 1 ? "" : "s") +
        " still unmarked. Mark every item (use N/A if it does not apply), then generate again.";
      copyStatus.style.color = "var(--warn)";
      resultsEl.hidden = true;
      btnCopy.disabled = true;
      lastReport = "";
      return;
    }
    copyStatus.style.color = "var(--ok)";
    copyStatus.textContent = "";

    var failed = collectByState("fail");
    var unsure = collectByState("unsure");
    var rec = recommendCategory(failed, unsure);

    fillList(failedList, failedEmpty, failed);
    fillList(unsureList, unsureEmpty, unsure);
    recommendationEl.textContent = rec.text;
    lastReport = buildReport(failed, unsure, rec);
    reportText.textContent = lastReport;
    resultsEl.hidden = false;
    btnCopy.disabled = false;
    setServiceHighlight(rec.highlight);

    resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function copyReport() {
    if (!lastReport) return;
    function ok() {
      copyStatus.style.color = "var(--ok)";
      copyStatus.textContent = "Report copied to clipboard.";
    }
    function failFallback() {
      try {
        var range = document.createRange();
        range.selectNodeContents(reportText);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        copyStatus.style.color = "var(--warn)";
        copyStatus.textContent = "Clipboard blocked — report text selected; press Ctrl/Cmd+C.";
      } catch (e) {
        copyStatus.style.color = "var(--bad)";
        copyStatus.textContent = "Could not copy. Select the report text manually.";
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lastReport).then(ok).catch(failFallback);
    } else {
      failFallback();
    }
  }

  function resetAll() {
    answers = {};
    lastReport = "";
    var radios = listEl.querySelectorAll('input[type="radio"]');
    for (var i = 0; i < radios.length; i++) radios[i].checked = false;
    var opts = listEl.querySelectorAll(".state-opt");
    for (var j = 0; j < opts.length; j++) opts[j].classList.remove("selected");
    resultsEl.hidden = true;
    btnCopy.disabled = true;
    reportText.textContent = "";
    failedList.innerHTML = "";
    unsureList.innerHTML = "";
    recommendationEl.textContent = "";
    copyStatus.textContent = "";
    serviceHint.textContent = "";
    setServiceHighlight(null);
  }

  // Expose for node/jsdom tests
  window.WPEnquiryChecklist = {
    CHECKS: CHECKS,
    getAnswers: function () {
      return Object.assign({}, answers);
    },
    setAnswer: function (id, value) {
      answers[id] = value;
    },
    collectByState: collectByState,
    recommendCategory: recommendCategory,
    buildReport: buildReport,
    generate: generate,
    resetAll: resetAll,
    unansweredCount: unansweredCount,
    getLastReport: function () {
      return lastReport;
    }
  };

  btnGenerate.addEventListener("click", generate);
  btnCopy.addEventListener("click", copyReport);
  btnReset.addEventListener("click", resetAll);

  buildChecklist();
})();
