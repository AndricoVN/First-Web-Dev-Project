from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import os
from supabase import create_client, Client

# Cấu hình Supabase (nên chuyển key sang biến môi trường trong production)
SUPABASE_URL = "https://airtydgbvjdcapynxhli.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpcnR5ZGdidmpkY2FweW54aGxpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTUxMjAxOSwiZXhwIjoyMDU3MDg4MDE5fQ.Oui3E16On7tzh0a8lk50O--dBI-7js9mKjUxs43TTEE"

# Kết nối đến Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = Flask(__name__)
CORS(app)

def list_all_files(bucket, path):
    """
    Hàm này load toàn bộ file từ bucket theo từng batch (mỗi batch 100 file).
    Dùng cho các bucket có số lượng file không quá lớn.
    """
    all_files = []
    offset = 0
    limit = 100
    while True:
        batch = bucket.list(path, {"limit": limit, "offset": offset})
        if not batch:
            break
        all_files.extend(batch)
        if len(batch) < limit:
            break
        offset += limit
    return all_files

@app.route("/")
def home():
    return render_template("test.html")

@app.route("/api/get-unlabeled-image", methods=["GET"])
def get_unlabeled_image():
    try:
        # Lấy danh sách label từ bucket "labels" (load toàn bộ vì số lượng label thường ít)
        label_bucket = supabase.storage.from_("labels")
        labels = list_all_files(label_bucket, "")
        labeled_set = set()
        for label in labels:
            if label["name"].startswith("."):
                continue
            labeled_set.add(os.path.splitext(label["name"])[0])

        # Duyệt các ảnh theo từng batch để trả về ngay khi tìm được ảnh chưa có label
        image_bucket = supabase.storage.from_("images")
        offset = 0
        limit = 100
        while True:
            batch = image_bucket.list("", {"limit": limit, "offset": offset})
            if not batch:
                break
            for image in batch:
                if image["name"].startswith("."):
                    continue
                image_basename = os.path.splitext(image["name"])[0]
                if image_basename not in labeled_set:
                    image_url = f"{SUPABASE_URL}/storage/v1/object/public/images/{image['name']}"
                    return jsonify({
                        "image_url": image_url,
                        "filename": image["name"]
                    })
            if len(batch) < limit:
                break
            offset += limit

        return jsonify({"error": "Hết ảnh rồi"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/upload", methods=["POST"])
def upload():
    try:
        # Lấy dữ liệu label dưới dạng txt
        labels_txt = request.form.get("labels")
        if not labels_txt:
            return jsonify({"error": "No label data provided"}), 400

        # Nếu có file ảnh được upload thì xử lý như cũ, nếu không lấy filename từ form
        image_file = request.files.get("image")
        if image_file:
            image_data = image_file.read()
            image_filename = image_file.filename

            image_bucket = supabase.storage.from_("images")
            try:
                image_bucket.remove([image_filename])
            except Exception:
                pass

            image_upload_response = image_bucket.upload(image_filename, image_data, {
                "content-type": image_file.content_type
            })
            if hasattr(image_upload_response, "error") and image_upload_response.error is not None:
                return jsonify({"error": image_upload_response.error.message}), 400

            image_url = f"{SUPABASE_URL}/storage/v1/object/public/images/{image_filename}"
        else:
            image_filename = request.form.get("filename")
            if not image_filename:
                return jsonify({"error": "No image file provided"}), 400
            image_url = f"{SUPABASE_URL}/storage/v1/object/public/images/{image_filename}"

        # Tạo file label dựa trên tên file ảnh
        label_filename = os.path.splitext(image_filename)[0] + ".txt"
        label_content = labels_txt

        label_bucket = supabase.storage.from_("labels")
        try:
            label_bucket.remove([label_filename])
        except Exception:
            pass

        label_upload_response = label_bucket.upload(label_filename, label_content.encode("utf-8"), {
            "content-type": "text/plain"
        })
        if hasattr(label_upload_response, "error") and label_upload_response.error is not None:
            return jsonify({"error": label_upload_response.error.message}), 400

        label_url = f"{SUPABASE_URL}/storage/v1/object/public/labels/{label_filename}"

        return jsonify({
            "message": "Upload thành công",
            "image_url": image_url,
            "label_url": label_url
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
