import firebase_admin
from firebase_admin import credentials, db
from fastapi import FastAPI, File, HTTPException, UploadFile
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

# យកទិន្នន័យពីក្នុងឯកសារ firebase_credentials.json មកបំពេញទីនេះផ្ទាល់
firebase_config = {
    "type": "service_account",
    "project_id": "saleflower-ef0db",
    "private_key_id": "YOUR_PRIVATE_KEY_ID_HERE",
    "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_ACTUAL_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n",
    "client_email": "YOUR_CLIENT_EMAIL_HERE",
    "client_id": "YOUR_CLIENT_ID_HERE",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "YOUR_CLIENT_X509_CERT_URL_HERE",
}

cred = credentials.Certificate(firebase_config)
firebase_admin.initialize_app(
    cred,
    {
        "databaseURL": "https://saleflower-ef0db-default-rtdb.asia-southeast1.firebasedatabase.app"
    },
)

IMGBB_API_KEY = "YOUR_IMGBB_API_KEY_HERE"  # ដាក់ ImgBB API Key របស់អ្នក


@app.get("/api/products")
async def get_products():
  try:
    ref = db.reference("products")
    products_data = ref.get()
    if not products_data:
      return []

    products_list = []
    for key, value in products_data.items():
      value["id"] = key
      products_list.append(value)
    return products_list
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))


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


@app.post("/api/products")
async def create_product(product: dict):
  try:
    ref = db.reference("products")
    new_product_ref = ref.push(product)
    return {"status": "success", "id": new_product_ref.key}
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/products/{id}/stock")
async def update_stock(id: str, data: dict):
  try:
    ref = db.reference(f"products/{id}")
    ref.update({"stock": data["stock"]})
    return {"status": "success"}
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/products/{id}")
async def delete_product(id: str):
  try:
    ref = db.reference(f"products/{id}")
    ref.delete()
    return {"status": "success"}
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
