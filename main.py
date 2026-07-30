from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
import firebase_admin
from firebase_admin import credentials, db

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# វិធីសាស្ត្រថ្មី៖ តភ្ជាប់ដោយមិនបាច់ប្រើ File JSON (កាត់បន្ថយបញ្ហា File Not Found)
# ប្រសិនបើ Project របស់អ្នកបើកสิทธิ์ Database Rules ជា public (read/write: true)
firebase_admin.initialize_app(options={
    'databaseURL': 'https://saleflower-ef0db-default-rtdb.asia-southeast1.firebasedatabase.app'
})

IMGBB_API_KEY = "YOUR_IMGBB_API_KEY_HERE"  # ដាក់ ImgBB API Key របស់អ្នក

@app.post("/api/products")
async def create_product(
    name: str = Form(...),
    category: str = Form(...),
    price: float = Form(...),
    stock: int = Form(...),
    image: UploadFile = File(...)
):
    try:
        # ១. អាប់ឡូតរូបភាពទៅ ImgBB
        image_bytes = await image.read()
        response = requests.post(
            "https://api.imgbb.com/1/upload",
            data={"key": IMGBB_API_KEY},
            files={"image": image_bytes}
        )
        result = response.json()
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail="ImgBB upload failed")
        
        image_url = result["data"]["url"]

        # ២. រក្សាទុកទិន្នន័យចូល Firebase Realtime Database
        ref = db.reference('products')
        new_product_ref = ref.push({
            "name": name,
            "category": category,
            "price": price,
            "stock": stock,
            "imageUrl": image_url
        })

        return {"status": "success", "message": "Product added successfully", "id": new_product_ref.key}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
