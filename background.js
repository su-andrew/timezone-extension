importScripts("time-utils.js");

const MENU_PARENT = "convert-selected-time";
const MENU_IDS = Object.keys(TimeZoneConverter.CITIES).map((key) => `convert:${key}`);

chrome.runtime.onInstalled.addListener(createContextMenus);
chrome.runtime.onStartup.addListener(createContextMenus);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id || !String(info.menuItemId).startsWith("convert:")) {
    return;
  }

  const sourceKey = String(info.menuItemId).split(":")[1];
  const selectedText = info.selectionText || "";
  const parsed = TimeZoneConverter.parseSelection(selectedText);

  if (!parsed) {
    showOverlay(tab.id, info.frameId, {
      title: "Could not read that time",
      selectedText,
      error: "Highlight text like Monday 7pm, 7:30 PM, or Tue 11:45am."
    });
    return;
  }

  const conversions = TimeZoneConverter.convertFromParts(
    sourceKey,
    parsed.day,
    parsed.hour24,
    parsed.minute
  );

  showOverlay(tab.id, info.frameId, {
    title: `Converted from ${TimeZoneConverter.CITIES[sourceKey].label}`,
    selectedText,
    sourceKey,
    conversions
  });
});

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_PARENT,
      title: "Convert selected time",
      contexts: ["selection"]
    });

    for (const menuId of MENU_IDS) {
      const sourceKey = menuId.split(":")[1];
      chrome.contextMenus.create({
        id: menuId,
        parentId: MENU_PARENT,
        title: `Treat as ${TimeZoneConverter.CITIES[sourceKey].label} time`,
        contexts: ["selection"]
      });
    }
  });
}

function showOverlay(tabId, frameId, payload) {
  const target = Number.isInteger(frameId) ? { tabId, frameIds: [frameId] } : { tabId };

  chrome.scripting.executeScript({
    target,
    func: renderConversionOverlay,
    args: [payload]
  }).catch(() => {});
}

function renderConversionOverlay(payload) {
  const existing = document.getElementById("three-city-time-overlay");
  if (existing) {
    existing.remove();
  }

  const host = document.createElement("div");
  host.id = "three-city-time-overlay";
  const shadow = host.attachShadow({ mode: "open" });
  const position = getOverlayPosition();

  const rows = payload.conversions
    ? payload.conversions
        .map(
          (item) => `
            <div class="tz-row ${item.key === payload.sourceKey ? "source" : ""}">
              <span class="city">${escapeHtml(item.city)}</span>
              <span class="value">${escapeHtml(item.day)} ${escapeHtml(item.time)} ${escapeHtml(item.period)}</span>
            </div>
          `
        )
        .join("")
    : `<p class="error">${escapeHtml(payload.error)}</p>`;

  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        position: fixed;
        top: ${position.top}px;
        left: ${position.left}px;
        z-index: 2147483647;
        color: #17202a;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .panel {
        width: min(320px, calc(100vw - 24px));
        border: 1px solid #d9dee8;
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 16px 40px rgb(16 24 40 / 22%);
        overflow: hidden;
      }

      .top {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 12px 8px;
        border-bottom: 1px solid #eef1f5;
      }

      .title {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
        line-height: 1.25;
      }

      .selection {
        margin: 4px 0 0;
        color: #667085;
        font-size: 12px;
        line-height: 1.25;
      }

      button {
        width: 26px;
        height: 26px;
        flex: 0 0 auto;
        border: 1px solid #d9dee8;
        border-radius: 6px;
        color: #344054;
        background: #ffffff;
        cursor: pointer;
        font: inherit;
        line-height: 1;
      }

      button:hover {
        background: #f7f8fa;
      }

      .rows {
        display: grid;
        gap: 0;
        padding: 6px 0;
      }

      .tz-row {
        display: grid;
        grid-template-columns: 116px 1fr;
        gap: 10px;
        align-items: center;
        padding: 7px 12px;
        font-size: 13px;
      }

      .tz-row.source {
        background: #f1f8f9;
      }

      .city {
        font-weight: 700;
      }

      .value {
        text-align: right;
      }

      .error {
        margin: 0;
        padding: 12px;
        color: #b42318;
        font-size: 13px;
        line-height: 1.35;
      }
    </style>

    <section class="panel" role="dialog" aria-label="Time conversion result">
      <div class="top">
        <div>
          <p class="title">${escapeHtml(payload.title)}</p>
          <p class="selection">${escapeHtml(payload.selectedText || "")}</p>
        </div>
        <button type="button" aria-label="Close">x</button>
      </div>
      <div class="rows">${rows}</div>
    </section>
  `;

  shadow.querySelector("button").addEventListener("click", () => host.remove());
  document.documentElement.append(host);
  setTimeout(() => host.remove(), 30000);

  function getOverlayPosition() {
    const selection = window.getSelection();
    const fallback = { top: 16, left: Math.max(12, window.innerWidth - 340) };

    if (!selection || selection.rangeCount === 0) {
      return fallback;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      return fallback;
    }

    const maxTop = Math.max(12, window.innerHeight - 24);
    const maxLeft = Math.max(12, window.innerWidth - 332);

    return {
      top: Math.min(maxTop, Math.max(12, rect.bottom + 10)),
      left: Math.min(maxLeft, Math.max(12, rect.left))
    };
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
}
