require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ភ្ជាប់ទៅកាន់ Supabase Client
// យកតម្លៃពី process.env ឬប្រើប្រាស់ Fallback URL បណ្តោះអាសន្ន
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'placeholder-key';

const supabase = createClient(supabaseUrl, supabaseKey);


// Setup Views និង Static Files
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware ពិនិត្យ Owner Access
const checkOwnerAccess = (req, res, next) => {
    const ownerEmail = req.query.email || req.body.email;
    const allowedEmail = process.env.ALLOWED_EMAIL || "krouch06121997@gmail.com";
    if (req.path.startsWith('/admin') && ownerEmail !== allowedEmail) {
        return res.status(403).send("អ្នកគ្មានសិទ្ធិចូលកាន់ប្រព័ន្ធនេះទេ!");
    }
    next();
};

app.use(checkOwnerAccess);

// --- ROUTES ---

// UptimeRobot Health-Check Route (ការពារ Server Sleep)
app.get('/ping', (req, res) => {
    res.status(200).send('OK - Server is live!');
});

// 1. Root Route
app.get('/', async (req, res) => {
    // ឆែកមើល Session User
    const { data: { user } } = await supabase.auth.getUser();

    // បើគ្មាន User ទេ ឱ្យលោតទៅ Sign In ភ្លាម
    if (!user) {
        return res.redirect('/signin');
    }

    // បើ Sign In រួចហើយ ឱ្យបង្ហាញទំព័រ Admin Dashboard POS
    res.render('index', { user });
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

    res.redirect(`/`);
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

// 1. ទំព័រវាយ Email ដើម្បិសុំ Reset Password
app.get('/forgot-password', (req, res) => {
    res.render('forgot_password', { message: null, error: null });
});

app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    
    // បង្កើត Redirect URL ឱ្យទៅកាន់ Render ដោយស្វ័យប្រវត្តិ
    const domain = process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`;
    const redirectTo = `${domain}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo
    });

    if (error) {
        return res.render('forgot_password', { message: null, error: error.message });
    }

    res.render('forgot_password', { 
        message: 'តំណភ្ជាប់សម្រាប់ប្តូរលេខសម្ងាត់ ត្រូវបានផ្ញើទៅកាន់ Email របស់អ្នកហើយ! សូមពិនិត្យ Inbox/Spam។', 
        error: null 
    });
});

// Route សម្រាប់បង្ហាញទំព័រកំណត់លេខសម្ងាត់ថ្មី
app.get('/reset-password', (req, res) => {
    res.render('reset_password', {
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_ANON_KEY
    });
});


// 3. Store Route (ទាញទិន្នន័យពី Supabase DB)
app.get('/store', (req, res) => {
    res.redirect('/store/SHOP123');
});

app.get('/store/:id', async (req, res) => {
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw error;

        res.render('store', {
            shop: { name: "PACH KROUCH STORE", id: req.params.id },
            products: products || []
        });
    } catch (err) {
        console.error("Supabase Error:", err.message);
        res.status(500).send("មិនអាចទាញយកទិន្នន័យទំនិញបានទេ");
    }
});

// 4. API Verification & Order (កាត់ស្តុក និងរក្សាទុកក្នុង Supabase)
app.post('/api/verify-and-order', async (req, res) => {
    const { expectedAmount, cart, customer } = req.body;

    try {
        const orderId = "ORD-" + Date.now().toString().slice(-6);

        // ១. រក្សាទុក Order
        const { error: orderError } = await supabase.from('orders').insert([{
            id: orderId,
            customer_name: customer?.name || "អតិថិជន",
            customer_phone: customer?.phone || "012345678",
            total_amount: expectedAmount
        }]);

        if (orderError) throw orderError;

        // ២. កាត់ស្តុកទំនិញក្នុង Supabase
        if (cart && cart.length > 0) {
            for (const item of cart) {
                const { data: prod } = await supabase
                    .from('products')
                    .select('stock')
                    .eq('id', item.id)
                    .single();
                
                if (prod) {
                    const newStock = Math.max(0, prod.stock - item.qty);
                    await supabase
                        .from('products')
                        .update({ stock: newStock })
                        .eq('id', item.id);
                }
            }
        }

        return res.json({
            success: true,
            message: 'ការបង់ប្រាក់ និងបង្កើត Order ជោគជ័យ!',
            orderId: orderId,
            totalAmount: expectedAmount
        });

    } catch (error) {
        console.error("Order Error:", error.message);
        res.status(500).json({ success: false, message: 'មិនអាចរក្សាទុកទិន្នន័យបានទេ' });
    }
});

// 5. Order Success Route
app.get('/order-success', async (req, res) => {
    try {
        const orderId = req.query.id;
        const { data: order, error } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (error || !order) {
            return res.render('order_success', {
                order: {
                    id: orderId || "N/A",
                    customer_name: "អតិថិជន",
                    customer_phone: "012345678",
                    total_amount: parseFloat(req.query.amount || 0)
                }
            });
        }

        res.render('order_success', { order });
    } catch (err) {
        console.error("Order Page Error:", err.message);
        res.status(500).send("មិនអាចបង្ហាញទំព័រ Order Success បានទេ");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

