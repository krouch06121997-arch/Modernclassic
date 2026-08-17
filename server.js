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

        const merchant_id = process.env.ABA_PAYWAY_MERCHANT_ID || 'ec477173';
        const api_url = process.env.ABA_PAYWAY_API_URL || 'https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/purchase';

        // 1. RSA Private Key ដែល ABA បានផ្ដល់ជូន
        const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIICWwIBAAKBgQCUcWjsSam2X45TfesLBJnmWKRhLGYd1IUS17FaZ15ZgvGsNwfK
Ckb2JvdwnIungQz6zuAStibBw8Iy8BNAkdL9DogOZnfq1mMSLGQOsdtDUtZtBcrw
zWh2gOhGabD2nQPrX5NfRBRNUnl5dPH5GUjTHgZSotFMsdsv+wVDnDoPtwIDAQAB
AoGAMQYzbLX3Qq/URWa0lXLzkMt9nkoXf4qMWGi7veudkVpZjlKuU9+JCApedeZ9
iNhp/PsNraBStHN+U2xOL2j5kPBA0pNje7VUScYD2guub44WE+LlAg7DJIz7xUSG
JO+BeVC6Q4/zFtDutXOjqDuU9hDEfrYlV5hfusiqjeZE/IECQQCxVXjNDBif+022
zqZDycpLQg0DZqMzVPTcKHQUAuVM4RxfaBydy1edgK9yPhtrvkAfsQrWGYtCaSkT
nyoA9xsRAkEA1ksCvkynYuzREGnVcKonjcgcJ2DiroAX5uLmWAFRWkeDIpGvcFGt
+68M4W4JTsNgEP2eiXDc8zbyCPlNNoyuRwJAT73dimbsE9SPh6q5PTZaTykubN8U
eBq12OIgAHek4MNBXO2WIKa1iU+6lSa0ceilMRsNgmUOKBjdrcMewjxb4QJANb++
wmiLm352ub0x8f5byW4l0aK1eLtcQ2cqC2zZMOG6/JK6BFwYXYZ8npZw8zaCBAD5
INQUN1TSxHlzanlCxQJANquw9P8yCxgAS2vBdGLZBjYo5CoN/9GQeRpMbB7PXQMk
vOF4H5CVn6avoUyYZEDzhXBTNSBbshX5+nwxfaoShQ==
-----END RSA PRIVATE KEY-----`;

        const req_time = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
        const tran_id = "TRAN" + Date.now();
        const req_type = "purchase";
        const payment_option = "abapay_khqr";

        // 2. Base64 encode ទំនិញ
        const itemsArr = [{ name: "Order Payment", quantity: "1", price: totalAmount }];
        const items = Buffer.from(JSON.stringify(itemsArr)).toString('base64');

        // 3. តម្រៀប Raw Data តាម Standard ABA
        const rawHash = req_time + merchant_id + tran_id + totalAmount + items + req_type + payment_option;

        // 4. បង្កើត Digital Signature ដោយប្រើ RSA Private Key (SHA512)
        const signer = crypto.createSign('SHA512');
        signer.update(rawHash);
        signer.end();
        const hash = signer.sign(privateKey, 'base64');

        // 5. បញ្ជូន Parameters ទៅកាន់ Frontend Form
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
        console.error("RSA Hash Error:", err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});
