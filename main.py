import requests
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

app = FastAPI()

# បើក CORS ដើម្បីឱ្យ Frontend អាចទាក់ទងមកកាន់ Backend បាន
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # អាចកែសម្រួលឱ្យមកតែ Domain ហាងរបស់អ្នកក៏បាន
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ImgBB API Key របស់អ្នក (ត្រូវបានរក្សាទុកដោយសុវត្ថិភាពក្នុង Backend)
IMGBB_API_KEY = "Dd57bfee06bad5d8d582fe79d7b54649"


# Mock Database សម្រាប់រក្សាទុកទំនិញ (អាចប្តូរទៅ Database ពិតតាមក្រោយ)
products_db = []


class Product(BaseModel):
  id: str
  name: str
  category: str
  price: float
  stock: int
  imageUrl: str


class StockUpdate(BaseModel):
  stock: int


# ၁. Endpoint សម្រាប់ Upload រូបភាពទៅ ImgBB
@app.post("/api/upload-images")
async def upload_images(files: List[UploadFile] = File(...)):
  uploaded_urls = []

  for file in files:
    try:
      file_content = await file.read()

      # ផ្ញើរូបភាពទៅ ImgBB API
      response = requests.post(
          "https://api.imgbb.com/1/upload",
          data={"key": IMGBB_API_KEY},
          files={"image": file_content},
      )

      result = response.json()
      if result.get("success"):
        image_url = result["data"]["url"]
        uploaded_urls.append(image_url)
      else:
        raise HTTPException(
            status_code=400, detail="Failed to upload image to ImgBB"
        )
    except Exception as e:
      raise HTTPException(status_code=500, detail=str(e))

  return {"urls": uploaded_urls}


# ២. Endpoint យកបញ្ជីទំនិញទាំងអស់
@app.get("/api/products")
async def get_products():
  return products_db


# ៣. Endpoint បន្ថែមទំនិញថ្មី
@app.post("/api/products")
async def add_product(product: Product):
  products_db.append(product.dict())
  return {"message": "Product added successfully", "product": product}


# ៤. Endpoint កែប្រែស្តុក
@app.put("/api/products/{product_id}/stock")
async def update_stock(product_id: str, stock_data: StockUpdate):
  for p in products_db:
    if p["id"] == product_id:
      p["stock"] = stock_data.stock
      return {"message": "Stock updated successfully"}
  raise HTTPException(status_code=404, detail="Product not found")


# ៥. Endpoint លុបទំនិញ
@app.delete("/api/products/{product_id}")
async def delete_product(product_id: str):
  global products_db
  initial_length = len(products_db)
  products_db = [p for p in products_db if p["id"] != product_id]
  if len(products_db) == initial_length:
    raise HTTPException(status_code=404, detail="Product not found")
  return {"message": "Product deleted successfully"}


# ៦. Health Check Endpoint (សម្រាប់ UptimeRobot ដាស់ Server)
@app.get("/api/health")
async def health_check():
  return {"status": "healthy"}
