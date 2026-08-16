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

