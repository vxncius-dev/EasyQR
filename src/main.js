const HISTORY_KEY = "easeqr_history";

class EaseQR {
    constructor() {
        this.els = {
            text: document.getElementById("textInput"),
            file: document.getElementById("fileInput"),
            qr: document.getElementById("qrcode"),
            checkbox: document.getElementById("showcontent"),
            label: document.querySelector('label[for="showcontent"]'),
            sheet: document.getElementById("history-bottom-sheet"),
            sheetHandle: document.getElementById("historySheetHandle"),
            sheetBackdrop: document.getElementById("historySheetBackdrop"),
            historyList: document.getElementById("historyList")
        };

        this.els.icon = this.els.label.querySelector("i");
        this.defaultUrl = "https://github.com/vxncius-dev";
        this.placeholderImg = "src/upload.png";
        this.history = [];
        this.sheetDrag = { startY: 0, startOpen: false, didDrag: false };
        this.init();
    }

    init() {
        let ignoreNextClick = false;

        document.addEventListener("mousedown", (e) => {
            if (e.target.closest("input, textarea")) {
                ignoreNextClick = true;
            }
        });

        document.body.addEventListener("paste", (e) =>
            this.handleItems(e.clipboardData.items)
        );

        document.addEventListener("click", (e) => {
            if (ignoreNextClick) {
                ignoreNextClick = false;
                return;
            }

            const ignored = e.target.closest(
                "input, a, button, label, textarea, .bottom-sheet, .bottom-sheet-backdrop"
            );

            if (this.els.checkbox.checked) {
                const footer = document.querySelector("footer");
                if (!footer.contains(e.target)) {
                    this.els.checkbox.checked = false;
                    this.els.icon.className = "fa-solid fa-chevron-right";
                }
            }

            if (!ignored) {
                this.els.file.click();
            }
        });

        document.body.addEventListener("dragover", (e) => {
            e.preventDefault();
            document.body.classList.add("drag-active");
        });

        document.body.addEventListener("dragleave", (e) => {
            if (e.target === document.body) {
                document.body.classList.remove("drag-active");
            }
        });

        document.body.addEventListener("drop", (e) => {
            e.preventDefault();
            document.body.classList.remove("drag-active");
            this.handleItems(e.dataTransfer.items);
        });

        this.els.text.oninput = () =>
            this.generate(this.els.text.value || this.defaultUrl);
        this.els.text.onkeydown = (e) => {
            if (e.key === "Enter" && this.els.text.value && this.els.text.value.trim()) {
                const text = this.els.text.value.trim();
                this.addToHistory(text, {
                    label: text.slice(0, 50) + (text.length > 50 ? "…" : ""),
                    displayText: text
                });
            }
        };
        this.els.file.onchange = () =>
            this.process(this.els.file.files[0]);

        this.generate(this.defaultUrl);

        this.els.checkbox.addEventListener("change", () => {
            this.els.icon.className = this.els.checkbox.checked ?
                "fa-solid fa-chevron-left" :
                "fa-solid fa-chevron-right";
        });

        this.els.label.addEventListener("click", (e) => {
            e.stopPropagation();
        });

        this.loadHistory();
        this.renderHistory();
        this.els.sheetHandle.addEventListener("click", (e) => {
            if (e.target.closest(".history-item-remove")) return;
            if (this.sheetDrag.didDrag) {
                this.sheetDrag.didDrag = false;
                return;
            }
            this.toggleSheet();
        });
        this.els.sheetBackdrop.addEventListener("click", () => this.closeSheet());
        this.els.sheetHandle.addEventListener("mousedown", (e) => this.sheetDragStart(e));
        this.els.sheetHandle.addEventListener("touchstart", (e) => this.sheetDragStart(e), { passive: true });
        document.addEventListener("mousemove", (e) => this.sheetDragMove(e));
        document.addEventListener("touchmove", (e) => this.sheetDragMove(e), { passive: true });
        document.addEventListener("mouseup", () => this.sheetDragEnd());
        document.addEventListener("touchend", () => this.sheetDragEnd());
    }

    loadHistory() {
        try {
            const raw = localStorage.getItem(HISTORY_KEY);
            this.history = raw ? JSON.parse(raw) : [];
            this.history = this.history.filter((it) => !String(it.content || "").startsWith("blob:"));
        } catch {
            this.history = [];
        }
    }

    saveHistory() {
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
        } catch (e) {
            console.warn("saveHistory", e);
        }
    }

    addToHistory(content, opts = {}) {
        if (!content || !String(content).trim()) return;
        const label = opts.label || String(content).slice(0, 50) + (String(content).length > 50 ? "…" : "");
        const existing = this.history.findIndex((it) => it.content === content);
        if (existing >= 0) this.history.splice(existing, 1);
        this.history.unshift({
            id: Date.now() + "_" + Math.random().toString(36).slice(2),
            content: String(content).trim(),
            label,
            typeSize: opts.typeSize || null,
            thumbnail: opts.thumbnail || null,
            displayText: opts.displayText || null
        });
        const max = 100;
        if (this.history.length > max) this.history = this.history.slice(0, max);
        this.saveHistory();
        this.renderHistory();
    }

    removeFromHistory(id) {
        const item = this.history.find((it) => it.id === id);
        if (item && String(item.content || "").startsWith("blob:")) {
            URL.revokeObjectURL(item.content);
        }
        this.history = this.history.filter((it) => it.id !== id);
        this.saveHistory();
        this.renderHistory();
    }

    renderHistory() {
        const ul = this.els.historyList;
        ul.innerHTML = "";
        if (!this.history.length) {
            ul.innerHTML = '<li class="history-empty">Nenhum item no histórico.</li>';
            return;
        }
        this.history.forEach((it) => {
            const li = document.createElement("li");
            li.className = "history-item";
            li.setAttribute("data-id", it.id);
            const img = document.createElement("img");
            img.src = it.thumbnail || this.placeholderImg;
            img.alt = "";
            const details = document.createElement("div");
            details.className = "history-item-details";
            const p1 = document.createElement("p");
            p1.textContent = it.label;
            const p2 = document.createElement("p");
            p2.textContent = it.typeSize || it.content.slice(0, 40) + (it.content.length > 40 ? "…" : "");
            details.append(p1, p2);
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "history-item-remove";
            btn.title = "Remover";
            btn.setAttribute("aria-label", "Remover item");
            btn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            btn.onclick = (e) => {
                e.stopPropagation();
                this.removeFromHistory(it.id);
            };
            li.append(img, details, btn);
            li.onclick = () => {
                this.els.text.value = it.displayText || it.label || it.content;
                this.generate(it.content);
                this.closeSheet();
            };
            ul.appendChild(li);
        });
    }

    openSheet() {
        this.els.sheet.classList.add("is-open");
        this.els.sheetBackdrop.classList.add("is-visible");
        this.els.sheetHandle.setAttribute("aria-expanded", "true");
    }

    closeSheet() {
        this.els.sheet.classList.remove("is-open");
        this.els.sheetBackdrop.classList.remove("is-visible");
        this.els.sheetHandle.setAttribute("aria-expanded", "false");
    }

    toggleSheet() {
        if (this.els.sheet.classList.contains("is-open")) this.closeSheet();
        else this.openSheet();
    }

    sheetDragStart(e) {
        this.sheetDrag.startY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;
        this.sheetDrag.startOpen = this.els.sheet.classList.contains("is-open");
        this.sheetDrag.didDrag = false;
    }

    sheetDragMove(e) {
        if (this.sheetDrag.startY === undefined) return;
        const y = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;
        const delta = y - this.sheetDrag.startY;
        if (delta < -25 && !this.sheetDrag.startOpen) {
            this.openSheet();
            this.sheetDrag.startY = undefined;
            this.sheetDrag.didDrag = true;
        } else if (delta > 25 && this.sheetDrag.startOpen) {
            this.closeSheet();
            this.sheetDrag.startY = undefined;
            this.sheetDrag.didDrag = true;
        }
    }

    sheetDragEnd() {
        this.sheetDrag.startY = undefined;
    }

    handleItems(items) {
        const files = [];
        const strings = [];

        for (const item of items) {
            if (item.kind === "file") files.push(item);
            else if (item.kind === "string") strings.push(item);
        }

        if (files.length) {
            files.forEach((item) => this.process(item.getAsFile()));
            return;
        }

        if (!strings.length) return;

        const stringReads = strings.map(
            (item) =>
                new Promise((resolve) => {
                    item.getAsString((text) => resolve({ type: item.type || "", text: text || "" }));
                })
        );

        Promise.all(stringReads).then((entries) => {
            const cleaned = entries
                .map((entry) => ({
                    type: entry.type,
                    text: String(entry.text || "").trim()
                }))
                .filter((entry) => entry.text)
                .filter((entry) => !this.isNoiseString(entry.text, entry.type));

            if (!cleaned.length) return;

            const pick = this.pickBestString(cleaned);
            if (!pick) return;

            this.generate(pick);
            this.addToHistory(pick, {
                label: pick.slice(0, 50) + (pick.length > 50 ? "…" : ""),
                displayText: pick
            });
        });
    }

    isNoiseString(text, type) {
        const lowerType = String(type || "").toLowerCase();
        if (lowerType === "text/html" || lowerType === "application/json") return true;

        const value = String(text || "").trim();
        if (!value) return true;

        const lower = value.toLowerCase();
        if (lower.includes("<html") || lower.includes("<body") || lower.includes("<!--startfragment")) return true;
        if (value.startsWith("<") && value.includes(">")) return true;

        if (
            (value.startsWith("{") && value.endsWith("}")) ||
            (value.startsWith("[") && value.endsWith("]"))
        ) {
            return true;
        }

        return false;
    }

    pickBestString(entries) {
        const uriEntry = entries.find((entry) => entry.type === "text/uri-list");
        if (uriEntry) {
            const url = this.extractUrlFromUriList(uriEntry.text);
            if (url) return url;
        }

        const plainEntry = entries.find((entry) => entry.type === "text/plain") || entries[0];
        if (!plainEntry) return null;

        const urlInPlain = this.findFirstUrl(plainEntry.text);
        return urlInPlain || plainEntry.text;
    }

    extractUrlFromUriList(text) {
        const lines = String(text || "")
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith("#"));

        for (const line of lines) {
            if (this.isHttpUrl(line)) return line;
        }
        return null;
    }

    findFirstUrl(text) {
        const match = String(text || "").match(/https?:\/\/[^\s"'<>]+/i);
        return match ? match[0] : null;
    }

    isHttpUrl(value) {
        try {
            const url = new URL(value);
            return url.protocol === "http:" || url.protocol === "https:";
        } catch {
            return false;
        }
    }

    process(file) {
        if (!file) return;
        if (file.size > 100 * 1024 * 1024)
            return alert("Arquivo muito grande (>100MB)");

        const typeSize = `${(file.type.split("/")[1] || "FILE").toUpperCase()}, ${(file.size / 1024).toFixed(1)} KB`;
        const isImage = file.type.startsWith("image/");
        const createEntry = (thumbnail) => {
            const blobUrl = URL.createObjectURL(file);
            this.generate(blobUrl);
            this.els.text.value = file.name;
            this.addToHistory(blobUrl, {
                label: file.name,
                typeSize,
                thumbnail,
                displayText: file.name
            });
        };

        if (isImage) {
            const reader = new FileReader();
            reader.onload = (e) => createEntry(e.target.result);
            reader.readAsDataURL(file);
            return;
        }

        createEntry(this.placeholderImg);
    }

    generate(val) {
        this.els.qr.innerHTML = "";

        if (!val || !val.trim()) return;

        try {
            const writer = new ZXing.BrowserQRCodeSvgWriter();

            const svg = writer.write(
                val,
                200,
                200
            );

            this.els.qr.appendChild(svg);
        } catch (err) {
            console.error("QR generation failed:", err);
            this.els.qr.textContent = "Content too large for QR code";
        }
    }

}

new EaseQR();



