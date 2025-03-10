from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import os
import json
from supabase import create_client, Client

# Cấu hình Supabase (nên chuyển key sang biến môi trường trong production)
SUPABASE_URL = "https://airtydgbvjdcapynxhli.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpcnR5ZGdidmpkY2FweW54aGxpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTUxMjAxOSwiZXhwIjoyMDU3MDg4MDE5fQ.Oui3E16On7tzh0a8lk50O--dBI-7js9mKjUxs43TTEE"

# Kết nối đến Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = Flask(__name__)
CORS(app)

@app.route("/")
def home():
    return render_template("test.html")

@app.route("/api/get-unlabeled-image", methods=["GET"])
def get_unlabeled_image():
    try:
        # Lấy danh sách ảnh từ bucket "images"
        image_bucket = supabase.storage.from_("images")
        images = image_bucket.list("")
        print("Images:", images)  # In ra danh sách ảnh

        # Lấy danh sách label từ bucket "labels"
        label_bucket = supabase.storage.from_("labels")
        labels = label_bucket.list("")
        print("Labels:", labels)  # In ra danh sách labels

        # Tạo set tên file (không phần mở rộng) của các label đã có
        labeled_set = set()
        for label in labels:
            # Loại trừ file placeholder nếu có
            if label["name"].startswith("."):
                continue
            labeled_set.add(os.path.splitext(label["name"])[0])

        # Tìm ảnh mà chưa có label (dựa theo tên file), bỏ qua file bắt đầu bằng dấu chấm
        for image in images:
            if image["name"].startswith("."):
                continue
            image_basename = os.path.splitext(image["name"])[0]
            if image_basename not in labeled_set:
                image_url = f"{SUPABASE_URL}/storage/v1/object/public/images/{image['name']}"
                return jsonify({
                    "image_url": image_url,
                    "filename": image["name"]
                })
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
