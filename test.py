from flask import Flask, render_template, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  #Cho phép frontend truy cập API từ domain khác

@app.route("/")
def home():
    return render_template("test.html")

@app.route("/api/data", methods=["GET"])
def get_data():
    return jsonify({"message": "Biết ông liêm không?"})

if __name__ == "__main__":
    app.run(host="192.168.1.8", port=5000, debug=True)
