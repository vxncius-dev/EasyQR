const HISTORY_KEY = "easeqr_history";
const TMPFILES_API_URL = "https://tmpfiles.org/api/v1/upload";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

class EaseQR {
    constructor() {
        this.els = {
            text: document.getElementById("textInput"),
            file: document.getElementById("fileInput"),
            uploadTrigger: document.getElementById("uploadTrigger"),
            uploadStatus: document.getElementById("uploadStatus"),
            qrContainer: document.getElementById("qr-container"),
            qr: document.getElementById("qrcode"),
            checkbox: document.getElementById("showcontent"),
            label: document.querySelector('label[for="showcontent"]'),
            sheet: document.getElementById("history-bottom-sheet"),
            sheetHandle: document.getElementById("historySheetHandle"),
            sheetBackdrop: document.getElementById("historySheetBackdrop"),
            historyList: document.getElementById("historyList"),
        };

        this.els.icon = this.els.label.querySelector("i");
        this.defaultUrl = "https://github.com/vxncius-dev";
        this.placeholderImg = "src/upload.png";
        this.history = [];
        this.isUploading = false;
        this.sheetDrag = { startY: 0, startOpen: false, didDrag: false };
        this.activeModal = null;

        this.showWarning();
        this.init();
    }

    showWarning(){
        const uploadWarning = document.querySelector(".upload-warning");
        uploadWarning.style.transition = "transform .5s ease";
        uploadWarning.style.transform = "translateY(0)";
        setTimeout(() => {
            uploadWarning.style.transform = "translateY(1000%)";
        }, 5000);
    }

    init() {
        document.body.addEventListener("paste", (e) =>
            this.handleItems(e.clipboardData?.items || [])
        );

        document.getElementById("openTermsBtn")
            .setAttribute("data-modal-target", "termsModal");

        document.getElementById("openPrivacyBtn")
            .setAttribute("data-modal-target", "privacyModal");

        document.addEventListener("keydown", function (e) {
            if (e.key === "F12") e.preventDefault();
            if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J"))
                e.preventDefault();
            if (
                e.ctrlKey &&
                (e.key === "U" || e.key === "R" || e.key === "S" || e.key === "A")
            )
                e.preventDefault();
            if (e.ctrlKey && e.shiftKey && e.key === "R") e.preventDefault();
        });

        document.addEventListener("contextmenu", (e) => e.preventDefault());
        
        document
            .querySelectorAll("body *")
            .forEach((item) => item.setAttribute("draggable", false));

        document.querySelectorAll(".close-footer").forEach(item=>{
            item.addEventListener("click", ()=> document.getElementById("showcontent").checked = false)
        })

        document.addEventListener("click", (e) => {
            if (this.els.checkbox.checked) {
                const footer = document.querySelector("footer");
                if (footer && !footer.contains(e.target)) {
                    this.els.checkbox.checked = false;
                    this.els.icon.className = "fa-solid fa-chevron-right";
                }
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
            this.handleItems(e.dataTransfer?.items || []);
        });

        this.els.text.oninput = () =>
            this.generate(this.els.text.value || this.defaultUrl);

        this.els.text.onkeydown = (e) => {
            if (e.key === "Enter" && this.els.text.value && this.els.text.value.trim()) {
                const text = this.els.text.value.trim();
                this.addToHistory(text, {
                    label: text.slice(0, 50) + (text.length > 50 ? "..." : ""),
                    displayText: text
                });
            }
        };

        this.els.file.onchange = () =>
            this.process(this.els.file.files[0]);

        if (this.els.uploadTrigger) {
            this.els.uploadTrigger.addEventListener("click", (e) => {
                e.stopPropagation();
                this.openFilePicker();
            });
        }

        if (this.els.qrContainer) {
            this.els.qrContainer.addEventListener("click", (e) => {
                if (e.target.closest("a, button, input, textarea, label")) return;
                this.openFilePicker();
            });
        }

        this.generate(this.defaultUrl);

        this.els.checkbox.addEventListener("change", () => {
            this.els.icon.className = this.els.checkbox.checked
                ? "fa-solid fa-chevron-left"
                : "fa-solid fa-chevron-right";
        });

        this.els.label.addEventListener("click", (e) => {
            e.stopPropagation();
        });

        this.loadHistory();
        this.renderHistory();
        this.setupModals();

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

    openFilePicker() {
        if (this.isUploading) return;
        this.els.file.value = "";
        this.els.file.click();
    }

    setUploadStatus(message, isError = false) {
        if (!this.els.uploadStatus) return;
        this.els.uploadStatus.textContent = message || "";
        this.els.uploadStatus.classList.toggle("is-error", isError);
    }

    setUploadingState(isUploading, message) {
        this.isUploading = isUploading;
        if (this.els.uploadTrigger) this.els.uploadTrigger.disabled = isUploading;
        if (message) this.setUploadStatus(message, false);
    }

    setupModals() {
        const modalTriggers = document.querySelectorAll("[data-modal-target]");
        const modalCloses = document.querySelectorAll("[data-modal-close]");
        const modalBackdrop = document.getElementById("modalBackdrop");

        modalTriggers.forEach((trigger) => {
            trigger.addEventListener("click", (e) => {
                e.preventDefault();
                const targetId = trigger.getAttribute("data-modal-target");
                if (targetId) this.openModal(targetId);
            });
        });

        modalCloses.forEach((btn) => {
            btn.addEventListener("click", () => this.closeModal());
        });

        if (modalBackdrop) {
            modalBackdrop.addEventListener("click", () => this.closeModal());
        }

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") this.closeModal();
        });
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        const modalBackdrop = document.getElementById("modalBackdrop");
        if (!modal || !modalBackdrop) return;

        if (this.activeModal && this.activeModal !== modal) {
            this.activeModal.classList.remove("is-open");
        }

        modal.classList.add("is-open");
        modalBackdrop.classList.add("is-visible");
        this.activeModal = modal;
    }

    closeModal() {
        const modalBackdrop = document.getElementById("modalBackdrop");
        if (this.activeModal) {
            this.activeModal.classList.remove("is-open");
            this.activeModal = null;
        }
        if (modalBackdrop) modalBackdrop.classList.remove("is-visible");
    }

    async uploadToTmpfiles(file) {
        const form = new FormData();
        form.append("file", file, file.name);

        const response = await fetch(TMPFILES_API_URL, {
            method: "POST",
            body: form
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        let payload;
        try {
            payload = await response.json();
        } catch {
            throw new Error("Invalid API response");
        }

        const url = payload?.data?.url;
        if (payload?.status !== "success" || !url) {
            throw new Error(payload?.message || "Upload failed");
        }

        return String(url);
    }

    toTmpfilesDownloadUrl(url) {
        try {
            const parsed = new URL(url);
            if (!parsed.hostname.endsWith("tmpfiles.org")) return url;
            if (parsed.pathname.startsWith("/dl/")) return parsed.toString();
            const cleanPath = parsed.pathname.replace(/^\/+/, "");
            parsed.pathname = `/dl/${cleanPath}`;
            return parsed.toString();
        } catch {
            return url;
        }
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
        const label = opts.label || String(content).slice(0, 50) + (String(content).length > 50 ? "..." : "");
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
        this.history = this.history.filter((it) => it.id !== id);
        this.saveHistory();
        this.renderHistory();
    }

    renderHistory() {
        const ul = this.els.historyList;
        ul.innerHTML = "";
        if (!this.history.length) {
            ul.innerHTML = '<li class="history-empty">No items in history.</li>';
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
            p2.textContent = it.typeSize || it.content.slice(0, 40) + (it.content.length > 40 ? "..." : "");

            details.append(p1, p2);

            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "history-item-remove";
            btn.title = "Remove";
            btn.setAttribute("aria-label", "Remove item");
            btn.innerHTML = '<i class="fa-solid fa-xmark" style="color:#fff"></i>';

            btn.onclick = (e) => {
                e.stopPropagation();
                this.removeFromHistory(it.id);
            };

            li.append(img, details, btn);

            li.onclick = () => {
                this.els.text.value = it.displayText || it.content;
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

        for (const item of items) {
            if (item.kind === "file") {
                const file = item.getAsFile();
                if (file) files.push(file);
            }
        }

        if (!files.length) return;
        this.process(files[0]);
    }

    async process(file) {
        if (!file || this.isUploading) return;

        if (file.size > MAX_UPLOAD_BYTES) {
            alert("File is larger than 10MB. Please choose a file up to 10MB.");
            return;
        }

        this.setUploadingState(true, `Uploading ${file.name}...`);

        try {
            const uploadedUrl = await this.uploadToTmpfiles(file);
            const downloadUrl = this.toTmpfilesDownloadUrl(uploadedUrl);
            const created = this.generate(downloadUrl);
            if (!created) {
                throw new Error("Returned link does not fit in QR code");
            }

            this.els.text.value = downloadUrl;
            this.addToHistory(downloadUrl, {
                label: file.name,
                typeSize: `tmpfiles - ${this.formatBytes(file.size)}`,
                thumbnail: this.placeholderImg,
                displayText: downloadUrl
            });

            this.setUploadStatus("Upload completed. QR generated with the returned link.");
        } catch (error) {
            console.error("Upload error:", error);
            this.setUploadStatus("Upload failed. Check connection/CORS and try again.", true);
            alert("Failed to upload to tmpfiles. Run it via local server (http://localhost) and try again.");
        } finally {
            this.setUploadingState(false);
        }
    }

    formatBytes(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    generate(val) {
        this.els.qr.innerHTML = "";
        if (!val || !val.trim()) return false;

        try {
            const writer = new ZXing.BrowserQRCodeSvgWriter();
            const svg = writer.write(val, 200, 200);
            this.els.qr.appendChild(svg);
            return true;
        } catch (err) {
            console.error("QR generation failed:", err);
            this.els.qr.textContent = "Content too large for QR code";
            return false;
        }
    }
}

new EaseQR();
