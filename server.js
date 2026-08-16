require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const axios = require('axios');

// View Engine & Static Assets Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ទិន្នន័យស្តុកទំនិញ (Mock Database)
let products = [
    { id: 1, name: "ទំនិញ A", price: 10.00, stock: 5 },
    { id: 2, name: "ទំនិញ B", price: 25.50, stock: 2 },
    { id: 3, name: "ទំនិញ C", price: 15.00, stock: 10 }
];

// Authentication Middleware ផ្ទៀងផ្ទាត់ Email ម្ចាស់ហាង
const checkOwnerAccess = (req, res, next) => {
    const ownerEmail = req.query.email || req.body.email;
    const allowedEmail = process.env.ALLOWED_EMAIL || "krouch06121997@gmail.com";

    // ប្រសិនបើជាការចូលមើល Store ធម្មតាហាមឃាត់ការបិទ ប៉ុន្តែបើចូល Admin ត្រូវឆែក Email
    if (req.path.startsWith('/admin') && ownerEmail !== allowedEmail) {
        return res.status(403).send("អ្នកគ្មានសិទ្ធិចូលកាន់ប្រព័ន្ធនេះទេ!");
    }
    next();
};

app.use(checkOwnerAccess);

// --- ROUTES ---

// 1. Root Route -> Redirect ទៅកាន់ Store ផ្លូវការ
app.get('/', (req, res) => {
    res.redirect('/store/SHOP123');
});

app.get('/store', (req, res) => {
    res.redirect('/store/SHOP123');
});

// 2. ទំព័រ Store បង្ហាញមុខទំនិញ
app.get('/store/:id', (req, res) => {
    try {
        res.render('store', {
            shop: { name: "PACH KROUCH STORE", id: req.params.id },
            products: products
        });
    } catch (err) {
        console.error("Error rendering store:", err);
        res.status(500).send("មិនអាចបើកទំព័រ Store បានទេ");
    }
});

// 3. API ផ្ទៀងផ្ទាត់ការបង់ប្រាក់ស្វ័យប្រវត្តិ & កាត់ស្តុក
app.post('/api/verify-and-order', async (req, res) => {
    const { md5, expectedAmount, cart, customer } = req.body;

    try {
        // --- Mock Verification System (សាកល្បងប្រព័ន្ធ 100% Success) ---
        let isPaidSuccess = true;

        // បើសិនមាន Bakong Token ផ្លូវការ អាចបើកកូដ Real API ខាងក្រោម៖
        /*
        if (process.env.BAKONG_TOKEN && md5) {
            const response = await axios.post(
                'https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5',
                { md5: md5 },
                { headers: { 'Authorization': `Bearer ${process.env.BAKONG_TOKEN}` } }
            );
            isPaidSuccess = (response.data && response.data.responseCode === 0);
        }
        */

        if (isPaidSuccess) {
            // ដំណើរការកាត់ស្តុកទំនិញ
            if (cart && cart.length > 0) {
                cart.forEach(cartItem => {
                    const product = products.find(p => p.id === cartItem.id);
                    if (product && product.stock >= cartItem.qty) {
                        product.stock -= cartItem.qty;
                    }
                });
            }

            const orderId = "ORD-" + Date.now().toString().slice(-6);

            return res.json({ 
                success: true, 
                message: 'ការបង់ប្រាក់ត្រូវបានផ្ទៀងផ្ទាត់ជោគជ័យ!',
                orderId: orderId,
                totalAmount: expectedAmount
            });
        } else {
            return res.json({ success: false, message: 'មិនទាន់មានទិន្នន័យបង់ប្រាក់ពីធនាគារទេ!' });
        }
    } catch (error) {
        console.error("Payment Verification Error:", error.message);
        res.status(500).json({ success: false, message: 'Server Verification Error' });
    }
});

// 4. ទំព័របង្ហាញការបញ្ជាទិញជោគជ័យ
app.get('/order-success', (req, res) => {
    try {
        const orderId = req.query.id || ("ORD-" + Date.now().toString().slice(-6));
        const amount = req.query.amount || "0.00";

        const sampleOrder = {
            id: orderId,
            customer_name: "អតិថិជន",
            customer_phone: "012345678",
            total_amount: parseFloat(amount)
        };

        res.render('order_success', { order: sampleOrder });
    } catch (err) {
        console.error("Error rendering order_success.ejs:", err);
        res.status(500).send("មិនអាចបង្ហាញទំព័រ Order Success បានទេ");
    }
});

// Server Listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running for krouch06121997@gmail.com on port ${PORT}`);
});

