document.addEventListener("DOMContentLoaded", function () {
    const loadImageBtn = document.getElementById("loadImageBtn");
    const imageElement = document.getElementById("uploadedImage");
    const canvas = document.getElementById("drawingCanvas");
    const uploadBtn = document.getElementById("uploadBtn");
    const clearBtn = document.getElementById("clearBtn");
    const message = document.getElementById("message");
    const imageWrapper = document.getElementById("imageWrapper");
    const imageContainer = document.getElementById("imageContainer");

    let boxes = [];
    let isDrawing = false;
    let startX = 0, startY = 0;
    let currentBox = null;
    let currentImageFilename = ""; // Lưu tên file ảnh lấy từ Supabase
    let imageLoaded = false;
    let currentScale = 1;  // Tỉ lệ zoom hiện tại
    let dragOffsetX = 0, dragOffsetY = 0; // Dịch chuyển ảnh
    let isDraggingImage = false;
    let dragStartX = 0, dragStartY = 0;

    const ctx = canvas.getContext("2d");

    // Cập nhật transform cho imageContainer (kết hợp dịch chuyển và zoom)
    function updateTransform() {
        imageContainer.style.transform = `translate(${dragOffsetX}px, ${dragOffsetY}px) scale(${currentScale})`;
    }

    // Hiển thị thông báo
    function showMessage(text, color) {
        message.innerText = text;
        message.style.color = color;
    }

    // Xử lý khi nhấn nút tải ảnh từ Supabase
    loadImageBtn.addEventListener("click", function () {
        showMessage("Đang tải ảnh...", "gray");
        fetch("/api/get-unlabeled-image")
        .then(response => response.json())
        .then(data => {
            if(data.error) {
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
    });

    // Khi ảnh đã load, cập nhật kích thước canvas
    imageElement.addEventListener("load", function () {
        const width = imageElement.clientWidth;
        const height = imageElement.clientHeight;
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        // Đặt canvas đúng vị trí
        canvas.style.left = `${imageElement.offsetLeft}px`;
        canvas.style.top = `${imageElement.offsetTop}px`;

        // Reset dịch chuyển và zoom khi ảnh mới load
        currentScale = 1;
        dragOffsetX = 0;
        dragOffsetY = 0;
        updateTransform();

        boxes = [];  // Reset box khi đổi ảnh
        redraw();
        imageLoaded = true;
    });

    // Hàm hiệu chỉnh tọa độ dựa theo zoom và dịch chuyển hiện tại
    function getAdjustedCoordinates(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / currentScale,
            y: (e.clientY - rect.top) / currentScale
        };
    }

    // Vẽ Box trên canvas (sử dụng chuột trái)
    canvas.addEventListener("mousedown", function (e) {
        if (!imageLoaded) return;
        // Chỉ vẽ box với nút trái (button === 0)
        if (e.button !== 0) return;
        isDrawing = true;
        const coords = getAdjustedCoordinates(e);
        startX = coords.x;
        startY = coords.y;
        currentBox = { x: startX, y: startY, width: 0, height: 0 };
    });

    canvas.addEventListener("mousemove", function (e) {
        if (!isDrawing) return;
        const coords = getAdjustedCoordinates(e);
        const mouseX = coords.x;
        const mouseY = coords.y;
        currentBox.width = mouseX - startX;
        currentBox.height = mouseY - startY;
        redraw();
        drawBox(currentBox, "red", true);
    });

    canvas.addEventListener("mouseup", function () {
        if (!isDrawing) return;
        isDrawing = false;
        // Chuẩn hóa box để tránh width hoặc height âm
        let box = { ...currentBox };
        if (box.width < 0) {
            box.x += box.width;
            box.width = Math.abs(box.width);
        }
        if (box.height < 0) {
            box.y += box.height;
            box.height = Math.abs(box.height);
        }
        boxes = [box]; // Chỉ giữ 1 box (ghi đè)
        redraw();
    });

    // Vẽ lại toàn bộ boxes
    function redraw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        boxes.forEach(box => drawBox(box, "lime"));
    }

    // Vẽ box
    function drawBox(box, color, dashed = false) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash(dashed ? [6] : []);
        ctx.strokeRect(box.x, box.y, box.width, box.height);
    }

    // Xóa tất cả box
    clearBtn.addEventListener("click", function () {
        boxes = [];
        redraw();
        showMessage("Đã xóa box, vẽ lại đi!", "yellow");
    });

    // Upload label (và nếu cần, image thông qua filename)
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
                showMessage("Đã Upload", "green");
            }
        })
        .catch(error => {
            console.error("Lỗi:", error);
            showMessage("Có lỗi rồi, báo thằng Huy đi!", "red");
        });
    });

    // Zoom: Chỉ thực hiện khi giữ Ctrl + lăn chuột trên khung chứa ảnh
    imageWrapper.addEventListener("wheel", function(e) {
        if (!imageLoaded) return;
        if (!e.ctrlKey) return; // Chỉ zoom khi nhấn Ctrl
        e.preventDefault();
        let zoomAmount = -e.deltaY * 0.001;
        currentScale = Math.min(Math.max(currentScale + zoomAmount, 0.1), 5); // Giới hạn scale giữa 0.1 và 5
        updateTransform();
    });

    // Chức năng kéo ảnh bằng chuột phải (không có Ctrl)
    imageContainer.addEventListener("mousedown", function(e) {
        // Sử dụng chuột phải (button === 2) và không có Ctrl
        if (e.button === 2 && !e.ctrlKey) {
            isDraggingImage = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            e.preventDefault();
        }
    });

    imageContainer.addEventListener("mousemove", function(e) {
        if (isDraggingImage) {
            let deltaX = e.clientX - dragStartX;
            let deltaY = e.clientY - dragStartY;
            dragOffsetX += deltaX;
            dragOffsetY += deltaY;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            updateTransform();
            e.preventDefault();
        }
    });

    imageContainer.addEventListener("mouseup", function(e) {
        if (e.button === 2 && isDraggingImage) {
            isDraggingImage = false;
            e.preventDefault();
        }
    });

    // Khi chuột rời khỏi imageContainer, dừng kéo
    imageContainer.addEventListener("mouseleave", function(e) {
        if (isDraggingImage) {
            isDraggingImage = false;
        }
    });

    // Ngăn chặn menu mặc định khi nhấn chuột phải trên imageContainer
    imageContainer.addEventListener("contextmenu", function(e) {
        e.preventDefault();
    });
});
