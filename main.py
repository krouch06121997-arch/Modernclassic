from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="Modern Lux Store API", version="1.0")

# បើក CORS ដើម្បីឱ្យ Frontend អាចទាក់ទងមក Backend បាន
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# គំរូទិន្នន័យសម្រាប់ទំនិញ (Product Schema)
class Product(BaseModel):
    id: str
    category: str
    name: str
    price: float
    stock: int
    imageUrl: str

class StockUpdate(BaseModel):
    stock: int

# ទិន្នន័យគំរូក្នុងអង្គចងចាំ (អាចប្តូរទៅប្រើ Database ដូចជា SQLite / PostgreSQL ពេលយកឡើង Render)
products_db = [
    { "id": "p1", "category": "watch", "name": "Classic Luxury Watch", "price": 120.00, "stock": 15, "imageUrl": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60" },
    { "id": "p2", "category": "watch", "name": "Sport Chronograph Watch", "price": 150.00, "stock": 10, "imageUrl": "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=500&auto=format&fit=crop&q=60" },
    { "id": "p3", "category": "cap", "name": "Minimalist Streetwear Cap", "price": 25.00, "stock": 30, "imageUrl": "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=500&auto=format&fit=crop&q=60" },
    { "id": "p4", "category": "cap", "name": "Classic Cotton Baseball Hat", "price": 20.00, "stock": 25, "imageUrl": "https://images.unsplash.com/photo-1534030347209-467a5b0ad3e6?w=500&auto=format&fit=crop&q=60" },
    { "id": "p5", "category": "perfume", "name": "Royal Wood Eau de Parfum", "price": 85.00, "stock": 12, "imageUrl": "https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=500&auto=format&fit=crop&q=60" },
    { "id": "p6", "category": "perfume", "name": "Ocean Breeze Fragrance", "price": 95.00, "stock": 8, "imageUrl": "https://images.unsplash.com/photo-1594035910387-fea47794261f?w=500&auto=format&fit=crop&q=60" }
]

@app.get("/api/products", response_model=List[Product])
def get_products():
    return products_db

@app.post("/api/products", response_model=Product)
def add_product(product: Product):
    products_db.append(product.dict())
    return product

@app.put("/api/products/{product_id}/stock")
def update_stock(product_id: str, data: StockUpdate):
    for p in products_db:
        if p["id"] == product_id:
            p["stock"] = data.stock
            return {"message": "Stock updated successfully", "product": p}
    raise HTTPException(status_code=404, detail="Product not found")

@app.delete("/api/products/{product_id}")
def delete_product(product_id: str):
    global products_db
    initial_length = len(products_db)
    products_db = [p for p in products_db if p["id"] != product_id]
    if len(products_db) == initial_length:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted successfully"}

