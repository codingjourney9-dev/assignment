const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcryptjs");

const app = express();
const DATA_FILE = path.join(__dirname, "users.json");

// ==========================================
// 1. MIDDLEWARE & SETUP
// ==========================================
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || "assignment12_fallback_secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } 
}));

// Toast Notification Middleware
app.use((req, res, next) => {
    res.locals.message = req.session?.message || null;
    if (req.session) delete req.session.message;
    next();
});

const setMsg = (req, type, text) => { if (req.session) req.session.message = { type, text }; };

// ==========================================
// 2. OPTIMIZED JSON DATABASE CONTROLLER
// ==========================================
const UserDB = {
    async getAll() {
        try { return JSON.parse(await fs.readFile(DATA_FILE, "utf8")); } 
        catch { return []; }
    },
    async save(users) {
        await fs.writeFile(DATA_FILE, JSON.stringify(users, null, 2), "utf8");
    },
    async findByEmail(email) {
        const users = await this.getAll();
        return users.find(u => u.email.toLowerCase() === email.toLowerCase());
    },
    async findById(id) {
        const users = await this.getAll();
        return users.find(u => u.id === id);
    },
    async update(id, newData) {
        const users = await this.getAll();
        const index = users.findIndex(u => u.id === id);
        if (index === -1) throw new Error("User not found");
        users[index] = { ...users[index], ...newData };
        await this.save(users);
        return users[index];
    }
};

const requireAuth = (req, res, next) => {
    if (!req.session?.user) {
        setMsg(req, 'error', 'Authentication required.');
        return res.redirect("/");
    }
    next();
};

// ==========================================
// 3. ROUTING LOGIC
// ==========================================

app.post("/register", async (req, res) => {
    try {
        const { first_name, last_name, email, password, contact, gender, qualification, role, state, city } = req.body;
        
        if (await UserDB.findByEmail(email)) {
            setMsg(req, 'error', 'Email is already registered.');
            return res.redirect("/");
        }

        const users = await UserDB.getAll();
        users.push({
            id: Date.now().toString(),
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            email: email.trim().toLowerCase(),
            password: await bcrypt.hash(password, 10),
            contact, gender, qualification, role, state, city,
            created_at: new Date().toISOString()
        });
        
        await UserDB.save(users);
        setMsg(req, 'success', 'Account created! Please login.');
        res.redirect("/");
    } catch (err) {
        setMsg(req, 'error', 'Registration failed due to a server error.');
        res.redirect("/");
    }
});

app.post("/login", async (req, res) => {
    try {
        const user = await UserDB.findByEmail(req.body.email);
        if (user && await bcrypt.compare(req.body.password, user.password)) {
            req.session.user = user;
            setMsg(req, 'success', `Welcome back, ${user.first_name}!`);
        } else {
            setMsg(req, 'error', 'Invalid credentials.');
        }
    } catch (err) {
        setMsg(req, 'error', 'Login encountered an error.');
    }
    res.redirect("/");
});

app.get("/logout", (req, res) => {
    req.session?.destroy(() => res.redirect("/"));
});

app.post("/account/update", requireAuth, async (req, res) => {
    try {
        const { first_name, last_name, contact, gender, qualification, role, state, city } = req.body;
        const updatedUser = await UserDB.update(req.session.user.id, {
            first_name, last_name, contact, gender, qualification, role, state, city
        });
        
        req.session.user = updatedUser;
        setMsg(req, 'success', 'Profile updated successfully.');
    } catch (err) {
        setMsg(req, 'error', 'Failed to update profile.');
    }
    res.redirect("/account");
});

app.post("/account/password", requireAuth, async (req, res) => {
    try {
        const { current_password, new_password, confirm_password } = req.body;
        const user = await UserDB.findById(req.session.user.id);

        if (!(await bcrypt.compare(current_password, user.password))) {
            setMsg(req, 'error', 'Current password is incorrect.');
        } else if (new_password.length < 4 || new_password !== confirm_password) {
            setMsg(req, 'error', 'New passwords do not match or are too short.');
        } else {
            const newHash = await bcrypt.hash(new_password, 10);
            const updatedUser = await UserDB.update(user.id, { password: newHash });
            req.session.user = updatedUser;
            setMsg(req, 'success', 'Security updated successfully.');
        }
    } catch (err) {
        setMsg(req, 'error', 'Failed to update security settings.');
    }
    res.redirect("/account");
});

// ==========================================
// 4. PREMIUM UI GENERATOR (Tailwind + Inter Font)
// ==========================================
function renderLayout(req, res, title, content) {
    const user = req.session?.user || null;
    const msg = res.locals.message;
    
    let toast = '';
    if (msg) {
        const isOk = msg.type === 'success';
        toast = `
        <div id="toast" class="fixed top-24 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl text-white font-medium transform transition-all duration-500 translate-y-0 opacity-100 ${isOk ? 'bg-emerald-600' : 'bg-rose-600'}">
            <i class="fa-solid ${isOk ? 'fa-circle-check' : 'fa-circle-exclamation'} text-xl"></i>
            <span>${msg.text}</span>
        </div>
        <script>setTimeout(() => { const t = document.getElementById('toast'); if(t){ t.style.opacity='0'; t.style.transform='translateY(-10px)'; setTimeout(()=>t.remove(),500); }}, 3500);</script>`;
    }

    return `<!DOCTYPE html>
    <html lang="en" class="scroll-smooth bg-slate-50">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            body { font-family: 'Inter', sans-serif; display: flex; flex-direction: column; min-height: 100vh; }
            .glass { background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(226, 232, 240, 0.8); }
            .tab-panel { display: none; animation: fadeIn 0.4s ease; }
            .tab-panel.active { display: block; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            input, select { transition: all 0.2s ease; }
            input:focus, select:focus { border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1); outline: none; }
        </style>
    </head>
    <body class="text-slate-800 selection:bg-indigo-100 selection:text-indigo-900">
        ${toast}
        
        <!-- MODERN NAVBAR -->
        <nav class="glass fixed top-0 w-full z-40 transition-all">
            <div class="max-w-7xl mx-auto px-6 lg:px-8">
                <div class="flex justify-between h-20 items-center">
                    <a href="/" class="flex items-center gap-3 text-xl font-bold tracking-tight text-indigo-900">
                        <div class="w-10 h-10 bg-indigo-600 text-white flex items-center justify-center rounded-xl shadow-lg shadow-indigo-200">
                            <i class="fa-solid fa-layer-group"></i>
                        </div>
                        Project
                    </a>
                    
                    <div class="flex items-center gap-4">
                        ${user ? `
                            <div class="hidden sm:flex items-center gap-3 mr-4 text-sm font-medium text-slate-600 border-r border-slate-200 pr-6">
                                <img src="https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=e0e7ff&color=4f46e5" class="w-8 h-8 rounded-full border border-indigo-100">
                                ${user.first_name}
                            </div>
                            <a href="/account" class="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${req.path === '/account' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-600 hover:bg-slate-100'}">Dashboard</a>
                            <a href="/logout" class="px-4 py-2.5 rounded-lg text-sm font-medium text-rose-500 hover:bg-rose-50 transition-colors">Logout</a>
                        ` : `
                            <button onclick="document.getElementById('modal-login').classList.remove('hidden')" class="text-slate-600 hover:text-indigo-600 px-4 py-2 text-sm font-semibold transition">Log in</button>
                            <button onclick="document.getElementById('modal-register').classList.remove('hidden')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5">Get Started</button>
                        `}
                    </div>
                </div>
            </div>
        </nav>

        <main class="flex-grow flex flex-col pt-20">
            ${content}
        </main>

        <footer class="bg-white border-t border-slate-200 py-8 text-center text-sm text-slate-500 mt-auto">
            <div class="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <p>&copy; 2026 Project Assignment 12.</p>
                <p class="font-medium">Crafted by <span class="text-indigo-600">Nikhil Kumar</span> (24U022005)</p>
            </div>
        </footer>

        <!-- OPTIMIZED MODALS -->
        ${!user ? `
        <div id="modal-login" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm hidden flex justify-center items-center z-50 p-4 transition-opacity">
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
                <button onclick="document.getElementById('modal-login').classList.add('hidden')" class="absolute top-5 right-5 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full w-8 h-8 flex items-center justify-center transition"><i class="fa-solid fa-xmark"></i></button>
                <div class="p-8">
                    <h2 class="text-2xl font-bold text-slate-900 mb-2">Welcome back</h2>
                    <p class="text-slate-500 text-sm mb-8">Enter your details to access your account.</p>
                    <form action="/login" method="POST" class="space-y-5">
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
                            <input type="email" name="email" required class="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-slate-900 bg-slate-50 placeholder-slate-400">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                            <input type="password" name="password" required class="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-slate-900 bg-slate-50 placeholder-slate-400">
                        </div>
                        <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl shadow-md shadow-indigo-200 transition">Sign in to account</button>
                    </form>
                </div>
            </div>
        </div>

        <div id="modal-register" class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm hidden flex justify-center items-center z-50 p-4">
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
                <div class="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <div>
                        <h2 class="text-xl font-bold text-slate-900">Create your account</h2>
                        <p class="text-slate-500 text-sm mt-1">Join us today to manage your profile seamlessly.</p>
                    </div>
                    <button onclick="document.getElementById('modal-register').classList.add('hidden')" class="text-slate-400 hover:text-slate-700 bg-white shadow-sm border border-slate-200 rounded-full w-8 h-8 flex items-center justify-center transition"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="p-8 overflow-y-auto">
                    <form action="/register" method="POST" class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                        <div><label class="block text-sm font-medium text-slate-700 mb-1">First Name</label><input type="text" name="first_name" required class="w-full px-4 py-2 border border-slate-300 rounded-lg"></div>
                        <div><label class="block text-sm font-medium text-slate-700 mb-1">Last Name</label><input type="text" name="last_name" required class="w-full px-4 py-2 border border-slate-300 rounded-lg"></div>
                        <div class="md:col-span-2"><label class="block text-sm font-medium text-slate-700 mb-1">Email Address</label><input type="email" name="email" required class="w-full px-4 py-2 border border-slate-300 rounded-lg"></div>
                        <div class="md:col-span-2"><label class="block text-sm font-medium text-slate-700 mb-1">Password</label><input type="password" name="password" required class="w-full px-4 py-2 border border-slate-300 rounded-lg"></div>
                        <div><label class="block text-sm font-medium text-slate-700 mb-1">Contact Number</label><input type="text" name="contact" class="w-full px-4 py-2 border border-slate-300 rounded-lg"></div>
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                            <select name="gender" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white"><option value="">Select...</option><option>Male</option><option>Female</option></select>
                        </div>
                        <div><label class="block text-sm font-medium text-slate-700 mb-1">Qualification</label><input type="text" name="qualification" class="w-full px-4 py-2 border border-slate-300 rounded-lg"></div>
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1">Role</label>
                            <select name="role" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white"><option value="">Select...</option><option>Student</option><option>Faculty</option></select>
                        </div>
                        <div><label class="block text-sm font-medium text-slate-700 mb-1">State</label><input type="text" name="state" class="w-full px-4 py-2 border border-slate-300 rounded-lg"></div>
                        <div><label class="block text-sm font-medium text-slate-700 mb-1">City</label><input type="text" name="city" class="w-full px-4 py-2 border border-slate-300 rounded-lg"></div>
                        <div class="md:col-span-2 pt-4">
                            <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl shadow-md transition">Create Account</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
        ` : ''}
    </body></html>`;
}

// ==========================================
// 5. VIEWS (Home & Dashboard)
// ==========================================

app.get("/", (req, res) => {
    const user = req.session?.user;
    const content = `
        <div class="flex-grow flex items-center justify-center relative overflow-hidden bg-slate-900">
            <!-- Decorative abstract background -->
            <div class="absolute inset-0 z-0 opacity-40">
                <div class="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
                <div class="absolute top-[20%] right-[-10%] w-96 h-96 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
                <div class="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-rose-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
            </div>
            
            <div class="max-w-4xl mx-auto text-center px-6 relative z-10 py-32">
                <span class="inline-block py-1 px-3 rounded-full bg-indigo-500/20 text-indigo-200 text-sm font-semibold mb-6 border border-indigo-500/30">Assignment 12 Implementation</span>
                <h1 class="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-8 leading-tight">
                    Manage your identity <br/><span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">with absolute ease.</span>
                </h1>
                <p class="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-12 font-light">A beautifully engineered user dashboard. Register an account to explore profile management, security settings, and dynamic state handling.</p>
                
                ${user ? `
                    <a href="/account" class="inline-flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 px-10 rounded-full shadow-xl shadow-indigo-900/20 transition transform hover:scale-105">
                        Access Dashboard <i class="fa-solid fa-arrow-right"></i>
                    </a>
                ` : `
                    <div class="flex flex-col sm:flex-row justify-center gap-4">
                        <button onclick="document.getElementById('modal-register').classList.remove('hidden')" class="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 px-10 rounded-full shadow-lg shadow-indigo-600/30 transition transform hover:scale-105">Create free account</button>
                        <button onclick="document.getElementById('modal-login').classList.remove('hidden')" class="bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-white font-semibold py-4 px-10 rounded-full transition">Sign In</button>
                    </div>
                `}
            </div>
        </div>
    `;
    res.send(renderLayout(req, res, "Project | Welcome", content));
});

app.get("/account", requireAuth, (req, res) => {
    const u = req.session.user;
    const fb = val => val || '<span class="text-slate-400 font-normal italic">Not set</span>';
    const sel = (v, t) => v === t ? 'selected' : '';

    const content = `
        <div class="max-w-7xl mx-auto px-6 py-12 w-full flex-grow flex flex-col md:flex-row gap-8">
            
            <!-- MODERN SIDEBAR -->
            <aside class="w-full md:w-72 shrink-0">
                <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-28">
                    <div class="bg-gradient-to-r from-indigo-500 to-indigo-600 h-24 relative"></div>
                    <div class="px-6 pb-6 text-center -mt-12 relative z-10">
                        <img src="https://ui-avatars.com/api/?name=${u.first_name}+${u.last_name}&background=ffffff&color=4f46e5&size=128" class="w-24 h-24 rounded-full border-4 border-white shadow-md mx-auto mb-3 bg-white">
                        <h2 class="text-lg font-bold text-slate-900">${u.first_name} ${u.last_name}</h2>
                        <p class="text-sm text-slate-500 mb-2">${u.email}</p>
                        <span class="inline-block bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-md font-semibold border border-indigo-100">${u.role || 'User'}</span>
                    </div>
                    
                    <div class="p-3 border-t border-slate-100 flex flex-col gap-1">
                        <button onclick="switchTab('overview', this)" class="tab-btn w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm text-indigo-700 bg-indigo-50 transition flex items-center gap-3">
                            <i class="fa-solid fa-address-card w-5 text-center"></i> Overview
                        </button>
                        <button onclick="switchTab('edit', this)" class="tab-btn w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm text-slate-600 hover:bg-slate-50 transition flex items-center gap-3">
                            <i class="fa-solid fa-user-pen w-5 text-center"></i> Edit Profile
                        </button>
                        <button onclick="switchTab('security', this)" class="tab-btn w-full text-left px-4 py-2.5 rounded-lg font-medium text-sm text-slate-600 hover:bg-slate-50 transition flex items-center gap-3">
                            <i class="fa-solid fa-shield-halved w-5 text-center"></i> Security
                        </button>
                    </div>
                </div>
            </aside>

            <!-- MAIN CONTENT PANELS -->
            <div class="w-full flex-grow">
                
                <!-- Overview Panel -->
                <div id="tab-overview" class="tab-panel active bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                    <div class="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                        <div>
                            <h3 class="text-xl font-bold text-slate-900">Profile Overview</h3>
                            <p class="text-sm text-slate-500 mt-1">Your personal information and details.</p>
                        </div>
                    </div>
                    
                    <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-8">
                        <div><dt class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Full Name</dt><dd class="text-slate-900 font-medium">${fb(u.first_name)} ${fb(u.last_name)}</dd></div>
                        <div><dt class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Email Address</dt><dd class="text-slate-900 font-medium">${fb(u.email)}</dd></div>
                        <div><dt class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Contact Number</dt><dd class="text-slate-900 font-medium">${fb(u.contact)}</dd></div>
                        <div><dt class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Gender</dt><dd class="text-slate-900 font-medium">${fb(u.gender)}</dd></div>
                        <div><dt class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Qualification</dt><dd class="text-slate-900 font-medium">${fb(u.qualification)}</dd></div>
                        <div><dt class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Primary Role</dt><dd class="text-slate-900 font-medium">${fb(u.role)}</dd></div>
                        <div><dt class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Location</dt><dd class="text-slate-900 font-medium">${fb(u.city)}${u.city && u.state ? ', ' : ''}${fb(u.state)}</dd></div>
                        <div><dt class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Member Since</dt><dd class="text-slate-900 font-medium">${new Date(u.created_at).toLocaleDateString()}</dd></div>
                    </dl>
                </div>

                <!-- Edit Profile Panel -->
                <div id="tab-edit" class="tab-panel bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                    <div class="mb-8 pb-4 border-b border-slate-100">
                        <h3 class="text-xl font-bold text-slate-900">Edit Profile</h3>
                        <p class="text-sm text-slate-500 mt-1">Update your personal details below.</p>
                    </div>
                    
                    <form action="/account/update" method="POST" class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div><label class="block text-sm font-medium text-slate-700 mb-1.5">First Name</label><input type="text" name="first_name" value="${u.first_name || ''}" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50"></div>
                        <div><label class="block text-sm font-medium text-slate-700 mb-1.5">Last Name</label><input type="text" name="last_name" value="${u.last_name || ''}" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50"></div>
                        
                        <div class="sm:col-span-2">
                            <label class="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                            <input type="email" value="${u.email}" disabled class="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-400 cursor-not-allowed">
                            <p class="text-xs text-slate-400 mt-1.5"><i class="fa-solid fa-lock text-slate-300 mr-1"></i> Email cannot be changed.</p>
                        </div>
                        
                        <div><label class="block text-sm font-medium text-slate-700 mb-1.5">Contact Number</label><input type="text" name="contact" value="${u.contact || ''}" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50"></div>
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1.5">Gender</label>
                            <select name="gender" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50">
                                <option value="">Not specified</option>
                                <option ${sel(u.gender, 'Male')}>Male</option><option ${sel(u.gender, 'Female')}>Female</option>
                            </select>
                        </div>
                        
                        <div><label class="block text-sm font-medium text-slate-700 mb-1.5">Qualification</label><input type="text" name="qualification" value="${u.qualification || ''}" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50"></div>
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
                            <select name="role" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50">
                                <option value="">Not specified</option>
                                <option ${sel(u.role, 'Student')}>Student</option><option ${sel(u.role, 'Faculty')}>Faculty</option>
                            </select>
                        </div>
                        
                        <div><label class="block text-sm font-medium text-slate-700 mb-1.5">State</label><input type="text" name="state" value="${u.state || ''}" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50"></div>
                        <div><label class="block text-sm font-medium text-slate-700 mb-1.5">City</label><input type="text" name="city" value="${u.city || ''}" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50"></div>
                        
                        <div class="sm:col-span-2 pt-4 flex justify-end">
                            <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-lg shadow-md shadow-indigo-200 transition">Save Changes</button>
                        </div>
                    </form>
                </div>

                <!-- Security Panel -->
                <div id="tab-security" class="tab-panel bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                    <div class="mb-8 pb-4 border-b border-slate-100">
                        <h3 class="text-xl font-bold text-slate-900">Security</h3>
                        <p class="text-sm text-slate-500 mt-1">Manage your password and security settings.</p>
                    </div>
                    
                    <form action="/account/password" method="POST" class="max-w-md space-y-5">
                        <div><label class="block text-sm font-medium text-slate-700 mb-1.5">Current Password</label><input type="password" name="current_password" required class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50"></div>
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
                            <input type="password" id="new_pwd" name="new_password" required class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50">
                            <p class="text-xs text-slate-400 mt-1">Minimum 4 characters required.</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1.5">Confirm New Password</label>
                            <input type="password" id="conf_pwd" name="confirm_password" required oninput="checkMatch()" class="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50">
                            <p id="match_msg" class="text-xs font-semibold mt-1.5"></p>
                        </div>
                        <div class="pt-2">
                            <button type="submit" class="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold px-6 py-2.5 rounded-lg shadow-md transition">Update Password</button>
                        </div>
                    </form>
                </div>

            </div>
        </div>

        <script>
            function switchTab(name, btn) {
                document.querySelectorAll('.tab-panel').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-btn').forEach(b => { 
                    b.classList.remove('text-indigo-700', 'bg-indigo-50'); 
                    b.classList.add('text-slate-600'); 
                });
                document.getElementById('tab-' + name).classList.add('active');
                btn.classList.remove('text-slate-600'); 
                btn.classList.add('text-indigo-700', 'bg-indigo-50');
            }

            function checkMatch() {
                const p1 = document.getElementById('new_pwd').value;
                const p2 = document.getElementById('conf_pwd').value;
                const msg = document.getElementById('match_msg');
                if(!p2) { msg.innerText = ''; return; }
                if(p1 === p2) { msg.innerHTML = '<i class="fa-solid fa-check mr-1"></i> Passwords match'; msg.className = 'text-xs font-semibold mt-1.5 text-emerald-600'; } 
                else { msg.innerHTML = '<i class="fa-solid fa-xmark mr-1"></i> Passwords do not match'; msg.className = 'text-xs font-semibold mt-1.5 text-rose-600'; }
            }
        </script>
    `;
    res.send(renderLayout(req, res, "Project | Dashboard", content));
});

// Error Fallbacks
app.use((req, res) => res.status(404).send(renderLayout(req, res, "404 Not Found", "<div class='text-center py-32'><h1 class='text-5xl font-bold text-slate-300 mb-4'>404</h1><p class='text-slate-500'>The page you requested could not be found.</p></div>")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Modern Dashboard running on port ${PORT}`));