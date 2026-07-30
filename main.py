import os
import firebase_admin
from firebase_admin import credentials, db
from fastapi import FastAPI, File, HTTPException, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import requests

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# តភ្ជាប់ Firebase ដោយប្រើប្រាស់ Environment Variables (ការពារកំហុស FileNotFoundError នៅលើ Render)
firebase_config = {
    "type": os.environ.get("FIREBASE_TYPE", "service_account"),
    "project_id": os.environ.get("FIREBASE_PROJECT_ID", "saleflower-ef0db"),
    "private_key_id": os.environ.get("FIREBASE_PRIVATE_KEY_ID", ""),
    "private_key": os.environ.get("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n"),
    "client_email": os.environ.get("FIREBASE_CLIENT_EMAIL", ""),
    "client_id": os.environ.get("FIREBASE_CLIENT_ID", ""),
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": os.environ.get("FIREBASE_CLIENT_X509_CERT_URL", ""),
}

cred = credentials.Certificate(firebase_config)
firebase_admin.initialize_app(
    cred,
    {
        "databaseURL": "https://saleflower-ef0db-default-rtdb.asia-southeast1.firebasedatabase.app"
    },
)

IMGBB_API_KEY = "YOUR_IMGBB_API_KEY_HERE"  # ដាក់ ImgBB API Key របស់អ្នក


# ១. បង្កើត API សម្រាប់ទាញយកទំនិញទាំងអស់
@app.get("/api/products")
async def get_products():
  try:
    ref = db.reference("products")
    products_data = ref.get()
    if not products_data:
      return []

    # แปลงข้อมูลจาก Firebase Dictionary เป็น List
    products_list = []
    for key, value in products_data.items():
      value["id"] = key
      products_list.append(value)
    return products_list
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))


# ២. បង្កើត API សម្រាប់ Upload រូបភាពច្រើនសន្លឹក
@app.post("/api/upload-images")
async def upload_images(files: list[UploadFile] = File(...)):
  urls = []
  try:
    for file in files:
      image_bytes = await file.read()
      response = requests.post(
          "https://api.imgbb.com/1/upload",
          data={"key": IMGBB_API_KEY},
          files={"image": image_bytes},
      )
      result = response.json()
      if result.get("success"):
        urls.append(result["data"]["url"])
    return {"urls": urls}
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))


# ៣. បង្កើត API សម្រាប់បន្ថែមទំនិញថ្មី
@app.post("/api/products")
async def create_product(product: dict):
  try:
    ref = db.reference("products")
    new_product_ref = ref.push(product)
    return {"status": "success", "id": new_product_ref.key}
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))


# ៤. កែប្រែ Stock
@app.put("/api/products/{id}/stock")
async def update_stock(id: str, data: dict):
  try:
    ref = db.reference(f"products/{id}")
    ref.update({"stock": data["stock"]})
    return {"status": "success"}
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))


# ៥. លុបផលិតផល
@app.delete("/api/products/{id}")
async def delete_product(id: str):
  try:
    ref = db.reference(f"products/{id}")
    ref.delete()
    return {"status": "success"}
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
