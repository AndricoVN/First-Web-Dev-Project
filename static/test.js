function fetchData() {
    let responseText = document.getElementById("response");
    responseText.innerText = "Đang tải...";
    responseText.style.color = "blue";

    fetch('/api/data')
        .then(response => response.json())
        .then(data => {
            responseText.innerText = data.message;
            responseText.classList.add("highlight_text");

            // Xóa nút cũ nếu có
            let buttonContainer = document.getElementById("button-container");
            if (buttonContainer) buttonContainer.remove();

            // Tạo container mới chứa nút
            buttonContainer = document.createElement("div");
            buttonContainer.id = "button-container";
            buttonContainer.classList.add("mt-3");

            // Tạo nút "Có"
            let yesButton = document.createElement("button");
            yesButton.innerText = "Có";
            yesButton.classList.add("btn", "btn-primary", "mx-2");
            yesButton.onclick = function () {
                alert("Who cares? Nah, just liemhaihondaitao");
            };

            // Tạo nút "Không"
            let noButton = document.createElement("button");
            noButton.innerText = "Liêm nào?";
            noButton.classList.add("btn", "btn-danger", "mx-2");
            noButton.onclick = function () {
                alert("Liemhaihondaitao");
            };

            // Thêm nút vào container
            buttonContainer.appendChild(yesButton);
            buttonContainer.appendChild(noButton);

            // Thêm container vào trang
            responseText.after(buttonContainer);
        })
        .catch(error => {
            responseText.innerText = "Lỗi tải dữ liệu!";
            responseText.style.color = "red";
            console.error("Lỗi:", error);
        });
}
