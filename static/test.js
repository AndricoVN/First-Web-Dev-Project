document.addEventListener("DOMContentLoaded", function () {
    const loadImageBtn = document.getElementById("loadImageBtn");
    const imageElement = document.getElementById("uploadedImage");
    const canvas = document.getElementById("drawingCanvas");
    const uploadBtn = document.getElementById("uploadBtn");
    const clearBtn = document.getElementById("clearBtn");
    const message = document.getElementById("message");
    const imageContainer = document.getElementById("imageContainer");

    let boxes = [];
    let isDrawing = false;
    let startX = 0, startY = 0;
    let currentBox = null;
    let currentImageFilename = "";
    let imageLoaded = false;
    let currentScale = 1;
    let dragOffsetX = 0, dragOffsetY = 0;
    let isDraggingImage = false;
    let dragStartX = 0, dragStartY = 0;

    const ctx = canvas.getContext("2d");

    function showMessage(text, color) {
        message.innerText = text;
        message.style.color = color;
    }

    function updateTransform() {
        imageContainer.style.transform = `translate(${dragOffsetX}px, ${dragOffsetY}px) scale(${currentScale})`;
    }

    function loadNewImage() {
        showMessage("Đang tải ảnh...", "gray");
        fetch("/api/get-unlabeled-image")
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    showMessage("Lỗi: " + data.error, "red");
                } else {
                    imageElement.src = data.image_url;
                    currentImageFilename = data.filename;
                }
            })
            .catch(error => {
                console.error("Lỗi:", error);
                showMessage("Có lỗi khi tải ảnh", "red");
            });
    }

    loadImageBtn.addEventListener("click", loadNewImage);

    imageElement.addEventListener("load", function () {
        canvas.width = imageElement.clientWidth;
        canvas.height = imageElement.clientHeight;
        boxes = [];
        redraw();
        imageLoaded = true;
        currentScale = 1;
        dragOffsetX = 0;
        dragOffsetY = 0;
        updateTransform();
    });

    function getAdjustedCoordinates(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / currentScale,
            y: (e.clientY - rect.top) / currentScale
        };
    }

    canvas.addEventListener("mousedown", function (e) {
        if (!imageLoaded || e.button !== 0) return;
        isDrawing = true;
        const coords = getAdjustedCoordinates(e);
        startX = coords.x;
        startY = coords.y;
        currentBox = { x: startX, y: startY, width: 0, height: 0 };
    });

    canvas.addEventListener("mousemove", function (e) {
        if (!isDrawing) return;
        const coords = getAdjustedCoordinates(e);
        currentBox.width = coords.x - startX;
        currentBox.height = coords.y - startY;
        redraw();
        drawBox(currentBox, "red", true);
    });

    canvas.addEventListener("mouseup", function () {
        if (!isDrawing) return;
        isDrawing = false;
        if (currentBox.width < 0) {
            currentBox.x += currentBox.width;
            currentBox.width = Math.abs(currentBox.width);
        }
        if (currentBox.height < 0) {
            currentBox.y += currentBox.height;
            currentBox.height = Math.abs(currentBox.height);
        }
        boxes = [currentBox];
        redraw();
    });

    function redraw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        boxes.forEach(box => drawBox(box, "lime"));
    }

    function drawBox(box, color, dashed = false) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash(dashed ? [6] : []);
        ctx.strokeRect(box.x, box.y, box.width, box.height);
    }

    clearBtn.addEventListener("click", function () {
        boxes = [];
        redraw();
        showMessage("Đã xóa box, vẽ lại đi!", "yellow");
    });

    uploadBtn.addEventListener("click", function () {
        if (!imageElement.src) {
            showMessage("Chưa chọn ảnh!", "red");
            return;
        }
        if (boxes.length === 0) {
            showMessage("Vẽ box trước khi upload!", "red");
            return;
        }

        showMessage("Đang tải...", "gray");

        const box = boxes[0];
        const x_center = (box.x + box.width / 2) / canvas.width;
        const y_center = (box.y + box.height / 2) / canvas.height;
        const width_norm = box.width / canvas.width;
        const height_norm = box.height / canvas.height;
        const labelText = `0 ${x_center.toFixed(6)} ${y_center.toFixed(6)} ${width_norm.toFixed(6)} ${height_norm.toFixed(6)}`;

        const formData = new FormData();
        formData.append("labels", labelText);
        formData.append("filename", currentImageFilename);

        fetch("/api/upload", {
            method: "POST",
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showMessage("Lỗi: " + data.error, "red");
            } else {
                showMessage("Đã Upload, tải ảnh mới...", "green");
                loadNewImage();
            }
        })
        .catch(error => {
            console.error("Lỗi:", error);
            showMessage("Có lỗi rồi, báo thằng Huy đi!", "red");
        });
    });

    imageContainer.addEventListener("wheel", function(e) {
        if (!imageLoaded || !e.ctrlKey) return;
        e.preventDefault();
        let zoomAmount = -e.deltaY * 0.001;
        currentScale = Math.min(Math.max(currentScale + zoomAmount, 0.1), 5);
        updateTransform();
    });

    imageContainer.addEventListener("mousedown", function(e) {
        if (e.button === 2 && !e.ctrlKey) {
            isDraggingImage = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            e.preventDefault();
        }
    });

    imageContainer.addEventListener("mousemove", function(e) {
        if (isDraggingImage) {
            dragOffsetX += e.clientX - dragStartX;
            dragOffsetY += e.clientY - dragStartY;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            updateTransform();
            e.preventDefault();
        }
    });

    imageContainer.addEventListener("mouseup", function(e) {
        if (e.button === 2) isDraggingImage = false;
    });

    imageContainer.addEventListener("mouseleave", function() {
        isDraggingImage = false;
    });
});
