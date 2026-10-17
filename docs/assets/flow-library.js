(() => {
  "use strict";

  const elements = {
    headerStatus: document.querySelector("#header-status-text"),
    moduleNav: document.querySelector("#module-nav"),
    mobileNavToggle: document.querySelector(".mobile-nav-toggle"),
    moduleTitle: document.querySelector("#module-title"),
    moduleRoute: document.querySelector("#module-route"),
    moduleSummary: document.querySelector("#module-summary-text"),
    flowCount: document.querySelector("#flow-count"),
    documentVersion: document.querySelector("#document-version"),
    legend: document.querySelector("#flow-legend"),
    flowCanvas: document.querySelector("#flow-canvas"),
    flowNodes: document.querySelector("#flow-nodes"),
    flowEdges: document.querySelector("#flow-edges"),
    canvasLoading: document.querySelector("#canvas-loading"),
    flowPicker: document.querySelector("#flow-picker"),
    flowPickerMenu: document.querySelector("#flow-picker-menu"),
    loadError: document.querySelector("#load-error"),
    retryLoad: document.querySelector("#retry-load"),
    drawer: document.querySelector("#flow-drawer"),
    drawerBackdrop: document.querySelector("#drawer-backdrop"),
    drawerClose: document.querySelector("#drawer-close"),
    drawerFlowId: document.querySelector("#drawer-flow-id"),
    drawerStatus: document.querySelector("#drawer-status"),
    drawerTitle: document.querySelector("#drawer-title"),
    drawerSummary: document.querySelector("#drawer-summary"),
    drawerBody: document.querySelector("#drawer-body")
  };

  const state = {
    modules: [],
    userData: null,
    flows: new Map(),
    selectedFlowId: null,
    lastFocusedElement: null,
    copyPayloads: new Map()
  };

  const typeLabels = {
    user: "Operator action",
    system: "System/API operation",
    decision: "Decision",
    outcome: "Outcome",
    gap: "Risk / decision required"
  };

  const swatches = {
    user: "#2581c4",
    system: "#6d28d9",
    decision: "#d97706",
    outcome: "#16a34a",
    gap: "#dc2626"
  };

  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const titleCase = (value = "") => String(value)
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

  const fetchJson = async (path) => {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load ${path}: ${response.status}`);
    return response.json();
  };

  const closeAllMenus = () => {
    document.querySelectorAll(".module-menu.is-open").forEach((menu) => menu.classList.remove("is-open"));
    document.querySelectorAll(".module-trigger[aria-expanded='true']").forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
    elements.flowPicker.setAttribute("aria-expanded", "false");
    elements.flowPickerMenu.hidden = true;
  };

  const renderModuleNavigation = () => {
    const userFlows = state.userData.flows;

    elements.moduleNav.innerHTML = state.modules.map((module) => {
      const documented = module.id === "users";
      const dropdown = documented
        ? `
          <p class="dropdown-label">User Management flows</p>
          <button class="dropdown-item is-active" type="button" data-module-overview="users">Overview diagram</button>
          ${userFlows.map((flow) => `<button class="dropdown-item" type="button" data-flow-id="${escapeHtml(flow.id)}"><strong>${escapeHtml(flow.id)}</strong> · ${escapeHtml(flow.shortTitle)}</button>`).join("")}
        `
        : `
          <p class="dropdown-label">${escapeHtml(module.label)} flows</p>
          <p class="dropdown-empty"><strong>Documentation planned</strong><span>This module will be added after User Management is approved.</span></p>
        `;

      return `
        <div class="module-menu${documented ? " is-active" : ""}" data-module-id="${escapeHtml(module.id)}">
          <button class="module-trigger${documented ? " is-active" : ""}" type="button" aria-expanded="false">${escapeHtml(module.label)}</button>
          <div class="module-menu__dropdown">${dropdown}</div>
        </div>
      `;
    }).join("");

    elements.moduleNav.querySelectorAll(".module-menu").forEach((menu, index) => {
      const trigger = menu.querySelector(".module-trigger");
      const dropdown = menu.querySelector(".module-menu__dropdown");
      const menuId = `module-dropdown-${menu.dataset.moduleId}`;
      dropdown.id = menuId;
      trigger.setAttribute("aria-controls", menuId);
      trigger.setAttribute("aria-haspopup", "menu");

      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        const shouldOpen = !menu.classList.contains("is-open");
        closeAllMenus();
        if (shouldOpen) {
          menu.classList.add("is-open");
          trigger.setAttribute("aria-expanded", "true");
        }
      });

      trigger.addEventListener("keydown", (event) => {
        const triggers = Array.from(elements.moduleNav.querySelectorAll(".module-trigger"));
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          const offset = event.key === "ArrowRight" ? 1 : -1;
          triggers[(index + offset + triggers.length) % triggers.length].focus();
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          trigger.click();
          dropdown.querySelector("button")?.focus();
        }
      });
    });

    elements.moduleNav.addEventListener("click", (event) => {
      const flowButton = event.target.closest("[data-flow-id]");
      if (flowButton) {
        openFlow(flowButton.dataset.flowId);
        return;
      }

      if (event.target.closest("[data-module-overview='users']")) {
        closeDrawer(true);
        setSelectedFlow(null);
        closeAllMenus();
        history.replaceState(null, "", "#users");
        elements.flowCanvas.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  };

  const renderSummary = () => {
    const module = state.userData.module;
    elements.moduleTitle.textContent = module.title;
    elements.moduleRoute.textContent = module.route;
    elements.moduleSummary.textContent = module.summary;
    elements.flowCount.textContent = state.userData.flows.length;
    elements.documentVersion.textContent = `v${module.version}`;
    elements.headerStatus.textContent = `${state.userData.flows.length} User flows · ${module.documentId} v${module.version}`;
  };

  const renderLegend = () => {
    elements.legend.innerHTML = state.userData.legend.map((item) => `
      <span class="legend__item">
        <span class="legend__swatch" style="--swatch:${swatches[item.type] || "#64748b"}" aria-hidden="true"></span>
        ${escapeHtml(item.label)}
      </span>
    `).join("");
  };

  const renderFlowPicker = () => {
    elements.flowPickerMenu.innerHTML = state.userData.flows.map((flow) => `
      <button class="dropdown-item" type="button" data-flow-id="${escapeHtml(flow.id)}"><strong>${escapeHtml(flow.id)}</strong> · ${escapeHtml(flow.shortTitle)}</button>
    `).join("");

    elements.flowPickerMenu.addEventListener("click", (event) => {
      const button = event.target.closest("[data-flow-id]");
      if (button) openFlow(button.dataset.flowId);
    });
  };

  const renderMap = () => {
    const nodes = state.userData.map.nodes;

    elements.flowNodes.innerHTML = nodes.map((node) => {
      const flow = node.flowId ? state.flows.get(node.flowId) : null;
      const title = flow?.shortTitle || node.title;
      const identifier = flow?.id || typeLabels[node.type] || "Journey state";
      const meta = flow
        ? `${flow.steps.length} steps · ${flow.apis.length} API${flow.apis.length === 1 ? "" : "s"} · ${flow.gaps.length} gap${flow.gaps.length === 1 ? "" : "s"}`
        : node.subtitle;
      const tag = flow ? "button" : "div";
      const buttonAttributes = flow ? `type="button" data-flow-id="${escapeHtml(flow.id)}" aria-label="Open ${escapeHtml(flow.id)} ${escapeHtml(flow.title)}"` : "";

      return `
        <${tag} class="flow-node flow-node--${escapeHtml(node.type)}" data-node-key="${escapeHtml(node.key)}" ${buttonAttributes} style="--x:${node.x};--y:${node.y}">
          <span class="flow-node__id">${escapeHtml(identifier)}</span>
          <span class="flow-node__title">${escapeHtml(title)}</span>
          <span class="flow-node__meta">${escapeHtml(meta)}</span>
        </${tag}>
      `;
    }).join("");

    elements.flowNodes.addEventListener("click", (event) => {
      const node = event.target.closest("[data-flow-id]");
      if (node) openFlow(node.dataset.flowId);
    });

    elements.canvasLoading.hidden = true;
    requestAnimationFrame(drawEdges);
  };

  const drawEdges = () => {
    if (!state.userData || window.matchMedia("(max-width: 820px)").matches) {
      elements.flowEdges.innerHTML = "";
      return;
    }

    const canvasRect = elements.flowCanvas.getBoundingClientRect();
    const width = elements.flowCanvas.clientWidth;
    const height = elements.flowCanvas.clientHeight;
    elements.flowEdges.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const marker = `
      <defs>
        <marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#9fb6c9"></path>
        </marker>
      </defs>
    `;

    const edgeMarkup = state.userData.map.edges.map((edge) => {
      const fromElement = elements.flowNodes.querySelector(`[data-node-key="${edge.from}"]`);
      const toElement = elements.flowNodes.querySelector(`[data-node-key="${edge.to}"]`);
      if (!fromElement || !toElement) return "";

      const fromRect = fromElement.getBoundingClientRect();
      const toRect = toElement.getBoundingClientRect();
      const fromCenter = {
        x: fromRect.left + fromRect.width / 2 - canvasRect.left,
        y: fromRect.top + fromRect.height / 2 - canvasRect.top
      };
      const toCenter = {
        x: toRect.left + toRect.width / 2 - canvasRect.left,
        y: toRect.top + toRect.height / 2 - canvasRect.top
      };
      const dx = toCenter.x - fromCenter.x;
      const dy = toCenter.y - fromCenter.y;
      const length = Math.max(Math.hypot(dx, dy), 1);
      const ux = dx / length;
      const uy = dy / length;
      const startInset = Math.min(fromRect.width, fromRect.height) * 0.42;
      const endInset = Math.min(toRect.width, toRect.height) * 0.48;
      const start = { x: fromCenter.x + ux * startInset, y: fromCenter.y + uy * startInset };
      const end = { x: toCenter.x - ux * endInset, y: toCenter.y - uy * endInset };
      const horizontal = Math.abs(dx) > Math.abs(dy);
      const path = horizontal
        ? `M ${start.x} ${start.y} C ${(start.x + end.x) / 2} ${start.y}, ${(start.x + end.x) / 2} ${end.y}, ${end.x} ${end.y}`
        : `M ${start.x} ${start.y} C ${start.x} ${(start.y + end.y) / 2}, ${end.x} ${(start.y + end.y) / 2}, ${end.x} ${end.y}`;
      const labelX = (start.x + end.x) / 2;
      const labelY = (start.y + end.y) / 2 - 5;

      return `
        <path class="flow-edge" d="${path}"></path>
        <text class="flow-edge-label" x="${labelX}" y="${labelY}" text-anchor="middle">${escapeHtml(edge.label)}</text>
      `;
    }).join("");

    elements.flowEdges.innerHTML = marker + edgeMarkup;
  };

  const setSelectedFlow = (flowId) => {
    state.selectedFlowId = flowId;
    document.querySelectorAll("[data-flow-id]").forEach((element) => {
      const selected = element.dataset.flowId === flowId;
      element.classList.toggle("is-selected", selected && element.classList.contains("flow-node"));
      element.classList.toggle("is-active", selected && element.classList.contains("dropdown-item"));
      if (element.classList.contains("flow-node")) element.setAttribute("aria-pressed", String(selected));
    });
  };

  const quickFactsMarkup = (flow) => `
    <div class="quick-facts">
      <div class="quick-fact"><span class="quick-fact__label">Primary actor</span><span class="quick-fact__value">${escapeHtml(flow.actor)}</span></div>
      <div class="quick-fact"><span class="quick-fact__label">Trigger</span><span class="quick-fact__value">${escapeHtml(flow.trigger)}</span></div>
      <div class="quick-fact"><span class="quick-fact__label">Outcome</span><span class="quick-fact__value">${escapeHtml(flow.outcome)}</span></div>
      <div class="quick-fact"><span class="quick-fact__label">Evidence state</span><span class="quick-fact__value">${escapeHtml(flow.evidence)}</span></div>
    </div>
  `;

  const listMarkup = (items, renderer, emptyMessage = "No additional information recorded.") => {
    if (!items?.length) return `<p class="empty-detail">${escapeHtml(emptyMessage)}</p>`;
    return `<ul class="detail-list">${items.map(renderer).join("")}</ul>`;
  };

  const createAccordion = (flowId, key, title, content) => {
    const panelId = `${flowId}-${key}-panel`;
    return `
      <section class="detail-accordion">
        <button class="detail-accordion__trigger" type="button" aria-expanded="false" aria-controls="${panelId}">${escapeHtml(title)}</button>
        <div class="detail-accordion__panel" id="${panelId}" hidden>${content}</div>
      </section>
    `;
  };

  const jsonBlockMarkup = (label, payload, key) => {
    const formatted = JSON.stringify(payload, null, 2);
    state.copyPayloads.set(key, formatted);
    return `
      <div class="json-block">
        <div class="json-block__label"><span>${escapeHtml(label)}</span><button class="copy-json" type="button" data-copy-key="${escapeHtml(key)}">Copy JSON</button></div>
        <pre><code>${escapeHtml(formatted)}</code></pre>
      </div>
    `;
  };

  const apiMarkup = (flow) => {
    if (!flow.apis.length) return `<p class="empty-detail">This flow has no direct API call documented at this level.</p>`;

    return flow.apis.map((api, index) => `
      <article class="api-card">
        <div class="api-card__header"><span class="method-badge">${escapeHtml(api.method)}</span><span class="api-card__path">${escapeHtml(api.path)}</span></div>
        <p class="api-card__purpose"><strong>${escapeHtml(api.name)}:</strong> ${escapeHtml(api.purpose)}</p>
        ${jsonBlockMarkup("Request", api.request, `${flow.id}-api-${index}-request`)}
        ${jsonBlockMarkup("Success response", api.successResponse, `${flow.id}-api-${index}-success`)}
        ${jsonBlockMarkup("Error response", api.errorResponse, `${flow.id}-api-${index}-error`)}
      </article>
    `).join("");
  };

  const renderDrawerBody = (flow) => {
    state.copyPayloads.clear();
    const preconditions = listMarkup(flow.preconditions, (item) => `<li class="rule-card"><p>${escapeHtml(item)}</p></li>`);
    const walkthrough = listMarkup(flow.steps, (step, index) => `
      <li class="walkthrough-step">
        <span class="step-number">${index + 1}</span>
        <div><strong>${escapeHtml(step.title)}</strong><p>${escapeHtml(step.detail)}</p></div>
      </li>
    `);
    const branches = listMarkup(flow.branches, (branch) => `
      <li class="branch-card branch-card--${escapeHtml(branch.tone)}"><strong>${escapeHtml(branch.label)}</strong><p>${escapeHtml(branch.detail)}</p></li>
    `);
    const rules = listMarkup(flow.rules, (rule) => `<li class="rule-card"><strong>${escapeHtml(rule.id)}</strong><p>${escapeHtml(rule.text)}</p></li>`);
    const gaps = listMarkup(flow.gaps, (gap) => `<li class="gap-card gap-card--${escapeHtml(gap.severity)}"><strong>${escapeHtml(gap.id)} · ${escapeHtml(titleCase(gap.severity))}</strong><p>${escapeHtml(gap.text)}</p></li>`, "No flow-specific implementation gap is recorded.");
    const acceptance = listMarkup(flow.acceptance, (criterion) => `<li class="criterion-card"><strong>${escapeHtml(criterion.id)}</strong><p>${escapeHtml(criterion.text)}</p></li>`);
    const references = listMarkup(flow.codeReferences, (reference) => `<li>${escapeHtml(reference)}</li>`);

    elements.drawerBody.innerHTML = `
      ${quickFactsMarkup(flow)}
      ${createAccordion(flow.id, "preconditions", `Preconditions (${flow.preconditions.length})`, preconditions)}
      ${createAccordion(flow.id, "walkthrough", `Walkthrough (${flow.steps.length} steps)`, walkthrough)}
      ${createAccordion(flow.id, "branches", `Decisions & error paths (${flow.branches.length})`, branches)}
      ${createAccordion(flow.id, "apis", `APIs & JSON (${flow.apis.length})`, apiMarkup(flow))}
      ${createAccordion(flow.id, "rules", `Business rules (${flow.rules.length})`, rules)}
      ${createAccordion(flow.id, "gaps", `Known gaps (${flow.gaps.length})`, gaps)}
      ${createAccordion(flow.id, "acceptance", `Acceptance criteria (${flow.acceptance.length})`, acceptance)}
      ${createAccordion(flow.id, "references", `Code references (${flow.codeReferences.length})`, references)}
    `;

    elements.drawerBody.querySelectorAll(".detail-accordion__trigger").forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const panel = document.getElementById(trigger.getAttribute("aria-controls"));
        const expanded = trigger.getAttribute("aria-expanded") === "true";
        trigger.setAttribute("aria-expanded", String(!expanded));
        panel.hidden = expanded;
      });
    });

    elements.drawerBody.querySelectorAll(".copy-json").forEach((button) => {
      button.addEventListener("click", async () => {
        const payload = state.copyPayloads.get(button.dataset.copyKey);
        try {
          await navigator.clipboard.writeText(payload);
          const previousLabel = button.textContent;
          button.textContent = "Copied";
          window.setTimeout(() => { button.textContent = previousLabel; }, 1200);
        } catch {
          button.textContent = "Copy failed";
        }
      });
    });
  };

  const openFlow = (flowId, options = {}) => {
    const flow = state.flows.get(flowId);
    if (!flow) return;

    state.lastFocusedElement = options.preserveFocus ? state.lastFocusedElement : document.activeElement;
    setSelectedFlow(flowId);
    closeAllMenus();
    elements.moduleNav.classList.remove("is-expanded");
    elements.mobileNavToggle.setAttribute("aria-expanded", "false");

    elements.drawerFlowId.textContent = flow.id;
    elements.drawerStatus.textContent = titleCase(flow.status);
    elements.drawerTitle.textContent = flow.title;
    elements.drawerSummary.textContent = flow.summary;
    renderDrawerBody(flow);

    elements.drawer.hidden = false;
    elements.drawerBackdrop.hidden = false;
    elements.drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("drawer-open");
    requestAnimationFrame(() => elements.drawer.classList.add("is-open"));

    if (options.updateUrl !== false) history.replaceState(null, "", `#users/${flow.id}`);
    if (options.focus !== false) window.setTimeout(() => elements.drawerClose.focus(), 230);
  };

  const closeDrawer = (restoreFocus = true, updateUrl = false) => {
    if (elements.drawer.getAttribute("aria-hidden") === "true") return;
    elements.drawer.classList.remove("is-open");
    elements.drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("drawer-open");

    window.setTimeout(() => {
      elements.drawer.hidden = true;
      elements.drawerBackdrop.hidden = true;
    }, 220);

    if (updateUrl) history.replaceState(null, "", "#users");
    if (restoreFocus && state.lastFocusedElement instanceof HTMLElement) state.lastFocusedElement.focus();
  };

  const flowFromHash = () => {
    const parts = location.hash.slice(1).split("/").filter(Boolean);
    return parts[0] === "users" && parts[1] ? parts[1] : null;
  };

  const bindStaticEvents = () => {
    elements.mobileNavToggle.addEventListener("click", () => {
      const expanded = elements.moduleNav.classList.toggle("is-expanded");
      elements.mobileNavToggle.setAttribute("aria-expanded", String(expanded));
      if (!expanded) closeAllMenus();
    });

    elements.flowPicker.addEventListener("click", (event) => {
      event.stopPropagation();
      const expanded = elements.flowPicker.getAttribute("aria-expanded") === "true";
      closeAllMenus();
      elements.flowPicker.setAttribute("aria-expanded", String(!expanded));
      elements.flowPickerMenu.hidden = expanded;
    });

    elements.drawerClose.addEventListener("click", () => {
      closeDrawer(true, true);
      setSelectedFlow(null);
    });

    elements.drawerBackdrop.addEventListener("click", () => {
      closeDrawer(true, true);
      setSelectedFlow(null);
    });

    elements.retryLoad.addEventListener("click", loadLibrary);

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".module-menu") && !event.target.closest(".map-actions")) closeAllMenus();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (elements.drawer.getAttribute("aria-hidden") === "false") {
        closeDrawer(true, true);
        setSelectedFlow(null);
      } else {
        closeAllMenus();
        elements.moduleNav.classList.remove("is-expanded");
        elements.mobileNavToggle.setAttribute("aria-expanded", "false");
      }
    });

    window.addEventListener("hashchange", () => {
      const flowId = flowFromHash();
      if (flowId && state.flows.has(flowId)) openFlow(flowId, { updateUrl: false, focus: false, preserveFocus: true });
      else {
        closeDrawer(false, false);
        setSelectedFlow(null);
      }
    });

    let resizeFrame;
    window.addEventListener("resize", () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(drawEdges);
    });
  };

  const loadLibrary = async () => {
    elements.loadError.hidden = true;
    elements.canvasLoading.hidden = false;
    elements.headerStatus.textContent = "Loading flow library";

    try {
      const [moduleData, userData] = await Promise.all([
        fetchJson("./data/modules.json"),
        fetchJson("./data/users.json")
      ]);

      state.modules = moduleData.modules;
      state.userData = userData;
      state.flows = new Map(userData.flows.map((flow) => [flow.id, flow]));

      renderModuleNavigation();
      renderSummary();
      renderLegend();
      renderFlowPicker();
      renderMap();

      const requestedFlow = flowFromHash();
      if (requestedFlow && state.flows.has(requestedFlow)) openFlow(requestedFlow, { updateUrl: false, focus: false });
    } catch (error) {
      console.error("Flow library failed to load", error);
      elements.canvasLoading.hidden = true;
      elements.loadError.hidden = false;
      elements.headerStatus.textContent = "Flow data unavailable";
    }
  };

  bindStaticEvents();
  loadLibrary();
})();
