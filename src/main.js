class EaseQR {
    constructor() {
        this.els = {
            text: document.getElementById("textInput"),
            file: document.getElementById("fileInput"),
            qr: document.getElementById("qrcode"),
            desc: document.getElementById("fileDescription"),
            preview: document.getElementById("filePreview"),
            name: document.getElementById("fileName"),
            type: document.getElementById("typeSize"),
            del: document.getElementById("delete"),
            checkbox: document.getElementById("showcontent"),
            label: document.querySelector('label[for="showcontent"]')
        };

        this.els.icon = this.els.label.querySelector("i");
        this.defaultUrl = "https://github.com/vxncius-dev";
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
                "input, a, button, label, textarea"
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

        this.els.del.onclick = () => this.clear();
        this.els.text.oninput = () =>
            this.generate(this.els.text.value || this.defaultUrl);
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
    }

    handleItems(items) {
        for (const item of items) {
            if (item.kind === "string")
                item.getAsString(t => this.generate(t));
            else if (item.kind === "file")
                this.process(item.getAsFile());
        }
    }

    async process(file) {
        if (!file) return;
        if (file.size > 100 * 1024 * 1024)
            return alert("Arquivo muito grande (>100MB)");

        const reader = new FileReader();
        reader.onload = (e) => this.updateUI(file, e.target.result);
        reader.readAsDataURL(file);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("https://tmpfiles.org/api/v1/upload", {
                method: "POST",
                body: formData
            });

            const {
                status,
                data
            } = await res.json();

            if (status === "success") {
                const url = data.url.replace("tmpfiles.org", "tmpfiles.org/dl");
                this.generate(url);
                this.els.text.value = url;
            }
        } catch (err) {
            console.error(err);
            alert("Erro no upload");
        }
    }

    updateUI(file, dataUrl) {
        this.els.preview.src = file.type.startsWith("image/") ?
            dataUrl :
            "https://www.geoinformatics.upol.cz/novy/wp-content/uploads/2024/02/istockphoto-1147544807-612x612-1.jpg";

        this.els.name.textContent = file.name;
        this.els.type.textContent =
            `${file.type.split("/")[1]?.toUpperCase() || "FILE"}, ${(file.size / 1024).toFixed(1)} KB`;

        this.els.desc.style.display = "block";
    }

    clear() {
        this.els.text.value = "";
        this.els.file.value = "";
        this.els.desc.style.display = "none";
        this.generate(this.defaultUrl);
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