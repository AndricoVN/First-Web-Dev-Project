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

@app.route("/api/upload", methods=["POST"])
def upload():
    try:
        # Lấy file ảnh và dữ liệu label (YOLOv8 format text) từ request
        image_file = request.files.get("image")
        labels_txt = request.form.get("labels")  # Dữ liệu label dưới dạng txt

        if not image_file:
            return jsonify({"error": "No image file provided"}), 400
        if not labels_txt:
            return jsonify({"error": "No label data provided"}), 400

        # Đọc dữ liệu ảnh
        image_data = image_file.read()
        image_filename = image_file.filename

        # Upload ảnh lên Supabase Storage (bucket "images")
        image_bucket = supabase.storage.from_("images")
        try:
            image_bucket.remove([image_filename])
        except Exception:
            # Nếu file không tồn tại, bỏ qua
            pass

        image_upload_response = image_bucket.upload(image_filename, image_data, {
            "content-type": image_file.content_type
        })
        if hasattr(image_upload_response, "error") and image_upload_response.error is not None:
            return jsonify({"error": image_upload_response.error.message}), 400

        image_url = f"{SUPABASE_URL}/storage/v1/object/public/images/{image_filename}"

        # Tạo tên file label (dạng txt) dựa trên tên file ảnh
        label_filename = os.path.splitext(image_filename)[0] + ".txt"
        label_content = labels_txt

        # Upload file label lên Supabase Storage (bucket "labels")
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
