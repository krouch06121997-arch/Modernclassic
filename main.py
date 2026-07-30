from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
import firebase_admin
from firebase_admin import db

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# តភ្ជាប់ Firebase ដោយប្រើ Database URL និង Database Secret ផ្ទាល់
firebase_admin.initialize_app(options={
    'databaseURL': 'https://saleflower-ef0db-default-rtdb.asia-southeast1.firebasedatabase.app',
    'databaseAuthVariableOverride': {
        'uid': 'admin-service'
    },
    'credential': firebase_admin.credentials.AnonymousCredential() # ប្រើប្រាស់ជាមួយ Database Secret
})

IMGBB_API_KEY = "6fa695c8e1e1effde49e32d13b295125"

@app.get("/api/products")
async def get_products():
    try:
        ref = db.reference('products')
        products_data = ref.get()
        if not products_data:
            return []
        
        products_list = []
        for key, value in products_data.items():
            value['id'] = key
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
                files={"image": image_bytes}
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
        ref = db.reference('products')
        new_product_ref = ref.push(product)
        return {"status": "success", "id": new_product_ref.key}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/products/{id}/stock")
async def update_stock(id: str, data: dict):
    try:
        ref = db.reference(f'products/{id}')
        ref.update({"stock": data['stock']})
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/products/{id}")
async def delete_product(id: str):
    try:
        ref = db.reference(f'products/{id}')
        ref.delete()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
