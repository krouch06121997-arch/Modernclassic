require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ភ្ជាប់ទៅកាន់ Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Setup Views និង Static Files
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware សម្រាប់ Logout (ចាកចេញ)
app.get('/logout', async (req, res) => {
    await supabase.auth.signOut();
    res.redirect('/signin');
});

// --- ROUTES ---

// Health-Check Route
app.get('/ping', (req, res) => {
    res.status(200).send('OK - Server is live!');
});

// 1. Root Route (Admin Dashboard - តម្រូវឱ្យ Sign In និងទាញទិន្នន័យតាម User)
app.get('/', async (req, res) => {
    const { data: { user } } = await supabase.auth.getUser();

    // បើគ្មាន User ទេ ឱ្យលោតទៅ Sign In ភ្លាម
    if (!user) {
        return res.redirect('/signin');
    }

    // ទាញយកទំនិញដាច់ដោយឡែករបស់ User ដែលកំពុង Login (ប្រើ user_id)
    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) console.error("Error fetching products:", error.message);

    res.render('index', { user, products: products || [] });
});

// 2. Authentication Routes
app.get('/signin', (req, res) => {
    res.render('signin', { error: null });
});

app.post('/signin', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        return res.render('signin', { error: error.message });
    }

    // Sign In រួច បង្វែរទៅ Admin Dashboard (index)
    res.redirect('/');
});

app.get('/signup', (req, res) => {
    res.render('signup', { error: null });
});

app.post('/signup', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
        return res.render('signup', { error: error.message });
    }

    res.redirect('/signin');
});

// Forgot & Reset Password Routes
app.get('/forgot-password', (req, res) => {
    res.render('forgot_password', { message: null, error: null });
});

app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    const domain = process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`;
    const redirectTo = `${domain}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
        return res.render('forgot_password', { message: null, error: error.message });
    }

    res.render('forgot_password', { 
        message: 'តំណភ្ជាប់សម្រាប់ប្តូរលេខសម្ងាត់ ត្រូវបានផ្ញើទៅកាន់ Email របស់អ្នកហើយ!', 
        error: null 
    });
});

app.get('/reset-password', (req, res) => {
    res.render('reset_password', {
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_ANON_KEY
    });
});

// 3. API បន្ថែមទំនិញថ្មី (ភ្ជាប់ជាមួយ user_id)
app.post('/add-product', async (req, res) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return res.redirect('/signin');

    const { name, barcode, price, current_stock, unit } = req.body;

    const { error } = await supabase.from('products').insert([
        { 
            user_id: user.id,
            name: name,
            barcode: barcode,
            price: parseFloat(price) || 0,
            current_stock: parseFloat(current_stock) || 0,
            unit: unit || 'កញ្ចប់'
        }
    ]);

    if (error) console.error("Insert Error:", error.message);
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Dynamic Storefront Route តាម User ID ម្ចាស់ហាង
app.get('/store/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        // ១. ទាញយកទំនិញរបស់ម្ចាស់ហាងតាម user_id
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // ២. Render ទៅ store.ejs ដោយផ្ញើទាំង shop និង products
        res.render('store', {
            shop: { 
                id: userId, 
                name: "PACH KROUCH STORE" 
            },
            products: products || []
        });
    } catch (err) {
        console.error("Store Error:", err.message);
        res.status(500).send("មិនអាចបើកទំព័រហាងនេះបានទេ៖ " + err.message);
    }
});

const crypto = require('crypto');

app.post('/api/create-payway-checkout', (req, res) => {
    try {
        const { amount } = req.body;
        const totalAmount = parseFloat(amount || 1.00).toFixed(2);

        // ព័ត៌មាន ABA Credentials
        const merchant_id = process.env.ABA_PAYWAY_MERCHANT_ID || 'ec477173';
        const api_key = process.env.ABA_PAYWAY_API_KEY || '5672a2121b8c678c654c7724537b0aa28c1d76f2';
        const api_url = process.env.ABA_PAYWAY_API_URL || 'https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/purchase';

        // ១. បង្កើត req_time ទម្រង់ YYYYMMDDHHmmss
        const req_time = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
        const tran_id = "TRAN" + Date.now();
        const req_type = "purchase";
        const payment_option = "abapay_khqr";

        // ២. Encode items ជា Base64 (ត្រូវប្រាកដថាមិនមាន Space)
        const itemsArr = [{ name: "Order Payment", quantity: "1", price: totalAmount }];
        const items = Buffer.from(JSON.stringify(itemsArr)).toString('base64');

        // ៣. រៀបចំ String សម្រាប់បង្កើត Hash តាម Standard ABA Checkout V1
        // រូបមន្ត៖ req_time + merchant_id + tran_id + amount + items + req_type + payment_option
        const rawHash = req_time + merchant_id + tran_id + totalAmount + items + req_type + payment_option;
        
        // បង្កើត HMAC-SHA256 Hash
        const hash = crypto.createHmac('sha256', api_key).update(rawHash).digest('base64');

        // ៤. ផ្ញើ Data ត្រឡប់ទៅ Frontend ដើម្បី Submit Form
        res.json({
            success: true,
            api_url: api_url,
            params: {
                req_time,
                merchant_id,
                tran_id,
                amount: totalAmount,
                items,
                req_type,
                payment_option,
                hash
            }
        });
    } catch (err) {
        console.error("Hash Error:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});
