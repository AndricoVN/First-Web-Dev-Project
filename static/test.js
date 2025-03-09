document.addEventListener("DOMContentLoaded", function () {
    const imageInput = document.getElementById("imageInput");
    const imageElement = document.getElementById("uploadedImage");
    const canvas = document.getElementById("drawingCanvas");
    const uploadBtn = document.getElementById("uploadBtn");
    const clearBtn = document.getElementById("clearBtn");
    const message = document.getElementById("message");

    let boxes = [];
    let isDrawing = false;
    let startX = 0, startY = 0;
    let currentBox = null;
    let imageFile = null;
    let imageLoaded = false;
    const ctx = canvas.getContext("2d");

    // Hiển thị thông báo
    function showMessage(text, color) {
        message.innerText = text;
        message.style.color = color;
    }

    // Xử lý khi chọn ảnh
    imageInput.addEventListener("change", function () {
        const file = imageInput.files[0];
        if (!file) return;
        imageFile = file;

        const reader = new FileReader();
        reader.onload = function (event) {
            imageElement.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    // Khi ảnh đã load, cập nhật kích thước canvas
    imageElement.addEventListener("load", function () {
        const width = imageElement.clientWidth;  // Sử dụng kích thước đầy đủ của ảnh
        const height = imageElement.clientHeight;
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
    
        // Đặt canvas đúng vị trí
        canvas.style.left = `${imageElement.offsetLeft}px`;
        canvas.style.top = `${imageElement.offsetTop}px`;
    
        boxes = [];  // Reset box khi đổi ảnh
        redraw();
        imageLoaded = true;
    });
    

    // Bắt đầu vẽ box
    canvas.addEventListener("mousedown", function (e) {
        if (!imageLoaded) return;
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        currentBox = { x: startX, y: startY, width: 0, height: 0 };
    });

    // Vẽ box khi di chuyển chuột
    canvas.addEventListener("mousemove", function (e) {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        currentBox.width = mouseX - startX;
        currentBox.height = mouseY - startY;
        redraw();
        drawBox(currentBox, "red", true);
    });

    // Kết thúc vẽ box
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

    // Upload ảnh và label
    uploadBtn.addEventListener("click", function () {
        if (!imageFile) {
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
        formData.append("image", imageFile);
        formData.append("labels", labelText);
    
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
});
