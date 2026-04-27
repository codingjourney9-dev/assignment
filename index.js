const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcryptjs");

const app = express();
const DATA_FILE = path.join(__dirname, "users.json");

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || "assignment12_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 }
}));

// Flash message middleware (Toast notifications)
app.use((req, res, next) => {
    if (req.session) {
        res.locals.message = req.session.message || null;
        delete req.session.message;
    } else {
        res.locals.message = null;
    }
    next();
});

function setMessage(req, type, text) {
    if (req.session) req.session.message = { type, text };
}

// ==========================================
// 1. JSON DATABASE HELPERS
// ==========================================

// Read users from users.json
async function getUsers() {
    try {
        const data = await fs.readFile(DATA_FILE, "utf8");
        return JSON.parse(data);
    } catch (err) {
        // If file doesn't exist yet, return empty array
        return [];
    }
}

// Save users to users.json
async function saveUsers(users) {
    await fs.writeFile(DATA_FILE, JSON.stringify(users, null, 2), "utf8");
}

// Require Login Middleware
function requireLogin(req, res, next) {
    if (!req.session || !req.session.user) {
        setMessage(req, 'error', 'Please login to access your account.');
        return res.redirect("/");
    }
    next();
}

// ==========================================
// 2. ROUTING & LOGIC
// ==========================================

// --- REGISTER ---
app.post("/register", async (req, res) => {
    try {
        const { first_name, last_name, email, password, contact, gender, qualification, role, state, city } = req.body;
        
        if (!email || !password) {
            setMessage(req, 'error', 'Email and password are required.');
            return res.redirect("/");
        }

        const users = await getUsers();
        
        // Check if email exists
        if (users.some(u => u.email === email)) {
            setMessage(req, 'error', 'Email is already registered.');
            return res.redirect("/");
        }

        // Create new user object
        const newUser = {
            id: Date.now().toString(), // Generate unique ID
            first_name, last_name, email,
            password: await bcrypt.hash(password, 10),
            contact, gender, qualification, role, state, city,
            created_at: new Date().toISOString()
        };

        users.push(newUser);
        await saveUsers(users);
        
        setMessage(req, 'success', 'Registration successful! Please login.');
        res.redirect("/");
    } catch (err) {
        console.error("Registration Error:", err);
        setMessage(req, 'error', 'An error occurred during registration.');
        res.redirect("/");
    }
});

// --- LOGIN ---
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = await getUsers();
        
        const user = users.find(u => u.email === email);
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = user;
            setMessage(req, 'success', `Welcome back, ${user.first_name}!`);
            return res.redirect("/");
        }
        
        setMessage(req, 'error', 'Invalid email or password.');
        res.redirect("/");
    } catch (err) {
        console.error("Login Error:", err);
        setMessage(req, 'error', 'An error occurred during login.');
        res.redirect("/");
    }
});

// --- LOGOUT ---
app.get("/logout", (req, res) => {
    if (req.session) {
        req.session.destroy(() => res.redirect("/"));
    } else {
        res.redirect("/");
    }
});

// --- UPDATE PROFILE ---
app.post("/account/update", requireLogin, async (req, res) => {
    try {
        const { first_name, last_name, contact, gender, qualification, role, state, city } = req.body;
        const userId = req.session.user.id;

        const users = await getUsers();
        const index = users.findIndex(u => u.id === userId);

        if (index !== -1) {
            // Update fields while keeping ID, Email, Password, and created_at safe
            users[index] = { 
                ...users[index], 
                first_name, last_name, contact, gender, qualification, role, state, city 
            };
            await saveUsers(users);
            
            // Update Session
            req.session.user = users[index];
            setMessage(req, 'success', 'Profile updated successfully!');
        } else {
            setMessage(req, 'error', 'User not found.');
        }
        res.redirect("/account");
    } catch (err) {
        console.error("Update Error:", err);
        setMessage(req, 'error', 'Profile update failed.');
        res.redirect("/account");
    }
});

// --- UPDATE PASSWORD ---
app.post("/account/password", requireLogin, async (req, res) => {
    try {
        const { current_password, new_password, confirm_password } = req.body;
        const userId = req.session.user.id;

        const users = await getUsers();
        const index = users.findIndex(u => u.id === userId);

        if (index === -1) {
            setMessage(req, 'error', 'User not found.');
            return res.redirect("/account");
        }

        const isMatch = await bcrypt.compare(current_password, users[index].password);

        if (!isMatch) {
            setMessage(req, 'error', 'Current password is incorrect.');
        } else if (new_password.length < 4) {
            setMessage(req, 'error', 'New password must be at least 4 characters.');
        } else if (new_password !== confirm_password) {
            setMessage(req, 'error', 'New passwords do not match.');
        } else {
            users[index].password = await bcrypt.hash(new_password, 10);
            await saveUsers(users);
            
            req.session.user.password = users[index].password; // Update session
            setMessage(req, 'success', 'Password changed successfully!');
        }
        res.redirect("/account");
    } catch (err) {
        console.error("Password Update Error:", err);
        setMessage(req, 'error', 'Password update failed.');
        res.redirect("/account");
    }
});


// ==========================================
// 3. UI GENERATION (HTML + Tailwind CSS)
// ==========================================

function renderHTML(req, res, title, content) {
    const user = req.session ? req.session.user : null;
    const message = res.locals.message;
    
    let toastHTML = '';
    if (message) {
        const color = message.type === 'success' ? 'bg-green-500' : 'bg-red-500';
        const icon = message.type === 'success' ? 'fa-check-circle' : 'fa-triangle-exclamation';
        toastHTML = `
        <div id="toast" class="fixed top-20 right-5 z-50 px-6 py-4 rounded shadow-lg text-white font-semibold transition-opacity duration-500 ${color}">
            <i class="fa-solid ${icon} mr-2"></i> ${message.text}
        </div>
        <script>setTimeout(() => { let t = document.getElementById('toast'); if(t){ t.style.opacity = '0'; setTimeout(() => t.remove(), 500); } }, 3000);</script>`;
    }

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            body { background-color: #f3f4f6; display: flex; flex-direction: column; min-height: 100vh; }
            .tab-content { display: none; }
            .tab-content.active { display: block; animation: fadeIn 0.3s ease-in-out; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        </style>
    </head>
    <body class="text-gray-800 font-sans">
        ${toastHTML}
        
        <!-- NAVBAR -->
        <nav class="bg-gray-900 text-white shadow-lg sticky top-0 z-40">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16">
                    <div class="flex items-center">
                        <a href="/" class="text-xl font-bold tracking-wider flex items-center gap-2">
                            <i class="fa-solid fa-graduation-cap text-blue-400"></i> Assignment 12
                        </a>
                    </div>
                    <div class="flex items-center space-x-4">
                        ${user ? `
                            <span class="hidden sm:block text-gray-300">Welcome, <span class="font-bold text-white">${user.first_name}</span></span>
                            <a href="/account" class="px-3 py-2 rounded-md text-sm font-medium ${req.path === '/account' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}">
                                <i class="fa-solid fa-user-circle"></i> My Account
                            </a>
                            <a href="/logout" class="px-3 py-2 rounded-md text-sm font-medium text-red-400 hover:bg-gray-700 hover:text-red-300">
                                <i class="fa-solid fa-right-from-bracket"></i> Logout
                            </a>
                        ` : `
                            <button onclick="document.getElementById('loginModal').classList.remove('hidden')" class="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition">Login</button>
                            <button onclick="document.getElementById('registerModal').classList.remove('hidden')" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium transition shadow">Register</button>
                        `}
                    </div>
                </div>
            </div>
        </nav>

        <main class="flex-grow flex flex-col">
            ${content}
        </main>

        <!-- FOOTER -->
        <footer class="bg-gray-900 text-gray-400 py-6 text-center text-sm border-t border-gray-800 mt-auto">
            <p>&copy; 2026 Assignment 12 - Web App Portal</p>
            <p class="mt-1">Developed by <span class="text-white font-semibold">Nikhil Kumar</span> | Scholar No: 24U022005</p>
        </footer>

        <!-- MODALS -->
        ${!user ? `
        <div id="loginModal" class="fixed inset-0 bg-black bg-opacity-60 hidden flex justify-center items-center z-50 px-4">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all relative">
                <button onclick="document.getElementById('loginModal').classList.add('hidden')" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 text-xl"><i class="fa-solid fa-xmark"></i></button>
                <div class="bg-gray-50 border-b p-6 text-center">
                    <h2 class="text-2xl font-bold text-gray-800">Welcome Back</h2>
                    <p class="text-sm text-gray-500 mt-1">Please enter your credentials to login</p>
                </div>
                <form action="/login" method="POST" class="p-6 space-y-4">
                    <div><label class="block text-sm font-semibold text-gray-700 mb-1">Email</label><input type="email" name="email" required class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></div>
                    <div><label class="block text-sm font-semibold text-gray-700 mb-1">Password</label><input type="password" name="password" required class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></div>
                    <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition mt-2">Login</button>
                    <p class="text-center text-sm text-gray-600 mt-4">Don't have an account? <a href="#" onclick="document.getElementById('loginModal').classList.add('hidden'); document.getElementById('registerModal').classList.remove('hidden')" class="text-blue-600 hover:underline">Register</a></p>
                </form>
            </div>
        </div>

        <div id="registerModal" class="fixed inset-0 bg-black bg-opacity-60 hidden flex justify-center items-center z-50 px-4">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all relative max-h-[90vh] overflow-y-auto">
                <button onclick="document.getElementById('registerModal').classList.add('hidden')" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 text-xl"><i class="fa-solid fa-xmark"></i></button>
                <div class="bg-gray-50 border-b p-6 text-center">
                    <h2 class="text-2xl font-bold text-gray-800">Create an Account</h2>
                    <p class="text-sm text-gray-500 mt-1">Fill in your details to register</p>
                </div>
                <form action="/register" method="POST" class="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><input type="text" name="first_name" placeholder="First Name *" required class="w-full px-4 py-2 border rounded-lg outline-none focus:border-blue-500"></div>
                    <div><input type="text" name="last_name" placeholder="Last Name *" required class="w-full px-4 py-2 border rounded-lg outline-none focus:border-blue-500"></div>
                    <div class="md:col-span-2"><input type="email" name="email" placeholder="Email Address *" required class="w-full px-4 py-2 border rounded-lg outline-none focus:border-blue-500"></div>
                    <div class="md:col-span-2"><input type="password" name="password" placeholder="Password *" required class="w-full px-4 py-2 border rounded-lg outline-none focus:border-blue-500"></div>
                    <div><input type="text" name="contact" placeholder="Contact Number" class="w-full px-4 py-2 border rounded-lg outline-none focus:border-blue-500"></div>
                    <div>
                        <select name="gender" class="w-full px-4 py-2 border rounded-lg outline-none focus:border-blue-500 text-gray-500">
                            <option value="">Select Gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                        </select>
                    </div>
                    <div><input type="text" name="qualification" placeholder="Highest Qualification" class="w-full px-4 py-2 border rounded-lg outline-none focus:border-blue-500"></div>
                    <div>
                        <select name="role" class="w-full px-4 py-2 border rounded-lg outline-none focus:border-blue-500 text-gray-500">
                            <option value="">Select Role</option><option value="Student">Student</option><option value="Faculty">Faculty</option>
                        </select>
                    </div>
                    <div><input type="text" name="state" placeholder="State" class="w-full px-4 py-2 border rounded-lg outline-none focus:border-blue-500"></div>
                    <div><input type="text" name="city" placeholder="City" class="w-full px-4 py-2 border rounded-lg outline-none focus:border-blue-500"></div>
                    <div class="md:col-span-2 pt-2">
                        <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition">Register Now</button>
                    </div>
                    <p class="md:col-span-2 text-center text-sm text-gray-600 mt-2">Already have an account? <a href="#" onclick="document.getElementById('registerModal').classList.add('hidden'); document.getElementById('loginModal').classList.remove('hidden')" class="text-blue-600 hover:underline">Login here</a></p>
                </form>
            </div>
        </div>
        ` : ''}
    </body>
    </html>`;
}

// --- HOME PAGE ROUTE ---
app.get("/", (req, res) => {
    const user = req.session ? req.session.user : null;
    const content = `
        <div class="bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900 text-white py-20 flex-grow flex items-center">
            <div class="max-w-4xl mx-auto text-center px-4">
                <h1 class="text-4xl md:text-6xl font-extrabold mb-6">Student Information Portal</h1>
                <p class="text-lg md:text-xl text-gray-300 mb-10 max-w-2xl mx-auto">A fully functional Node.js Web Application storing data seamlessly in JSON, featuring user authentication and profile customization.</p>
                ${user ? 
                    `<a href="/account" class="inline-block bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition hover:scale-105">Go to My Account <i class="fa-solid fa-arrow-right ml-2"></i></a>` : 
                    `<button onclick="document.getElementById('registerModal').classList.remove('hidden')" class="inline-block bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition hover:scale-105">Get Started <i class="fa-solid fa-user-plus ml-2"></i></button>`
                }
            </div>
        </div>
    `;
    res.send(renderHTML(req, res, "Home - Assignment 12", content));
});

// --- MY ACCOUNT ROUTE ---
app.get("/account", requireLogin, (req, res) => {
    const user = req.session.user;
    
    const sel = (val, target) => (val === target ? 'selected' : '');
    const fallback = (val) => val ? val : '<span class="text-gray-400 italic">Not provided</span>';

    const content = `
        <div class="max-w-6xl mx-auto px-4 py-8 w-full flex-grow">
            <div class="flex flex-col md:flex-row gap-8">
                
                <!-- Sidebar -->
                <div class="w-full md:w-1/3 lg:w-1/4">
                    <div class="bg-white rounded-xl shadow-md p-6 text-center border-t-4 border-blue-500">
                        <div class="w-24 h-24 mx-auto bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-4xl font-bold mb-4 shadow-inner">
                            ${(user.first_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <h2 class="text-xl font-bold text-gray-800">${user.first_name} ${user.last_name}</h2>
                        <p class="text-gray-500 text-sm mb-4">${user.email}</p>
                        <span class="inline-block bg-gray-100 text-gray-800 text-xs px-3 py-1 rounded-full font-semibold uppercase tracking-wide border border-gray-200">
                            ${user.role || 'User'}
                        </span>
                        
                        <div class="mt-8 flex flex-col gap-2">
                            <button onclick="switchTab('details')" id="btn-details" class="tab-btn w-full text-left px-4 py-3 rounded-lg font-medium text-blue-700 bg-blue-50 transition"><i class="fa-solid fa-address-card w-6 text-center"></i> My Details</button>
                            <button onclick="switchTab('edit')" id="btn-edit" class="tab-btn w-full text-left px-4 py-3 rounded-lg font-medium text-gray-600 hover:bg-gray-50 transition"><i class="fa-solid fa-pen-to-square w-6 text-center"></i> Edit Profile</button>
                            <button onclick="switchTab('password')" id="btn-password" class="tab-btn w-full text-left px-4 py-3 rounded-lg font-medium text-gray-600 hover:bg-gray-50 transition"><i class="fa-solid fa-lock w-6 text-center"></i> Change Password</button>
                        </div>
                    </div>
                </div>

                <!-- Main Content Area -->
                <div class="w-full md:w-2/3 lg:w-3/4">
                    
                    <!-- View Details Tab -->
                    <div id="tab-details" class="tab-content active bg-white rounded-xl shadow-md p-6 lg:p-8">
                        <h3 class="text-2xl font-bold text-gray-800 border-b pb-4 mb-6"><i class="fa-solid fa-circle-info text-blue-500 mr-2"></i> Account Information</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="bg-gray-50 p-4 rounded-lg border border-gray-100"><p class="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">First Name</p><p class="text-gray-800 font-medium text-lg">${fallback(user.first_name)}</p></div>
                            <div class="bg-gray-50 p-4 rounded-lg border border-gray-100"><p class="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Last Name</p><p class="text-gray-800 font-medium text-lg">${fallback(user.last_name)}</p></div>
                            <div class="bg-gray-50 p-4 rounded-lg border border-gray-100"><p class="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Email Address</p><p class="text-gray-800 font-medium text-lg">${fallback(user.email)}</p></div>
                            <div class="bg-gray-50 p-4 rounded-lg border border-gray-100"><p class="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Contact Number</p><p class="text-gray-800 font-medium text-lg">${fallback(user.contact)}</p></div>
                            <div class="bg-gray-50 p-4 rounded-lg border border-gray-100"><p class="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Gender</p><p class="text-gray-800 font-medium text-lg">${fallback(user.gender)}</p></div>
                            <div class="bg-gray-50 p-4 rounded-lg border border-gray-100"><p class="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Education/Qualification</p><p class="text-gray-800 font-medium text-lg">${fallback(user.qualification)}</p></div>
                            <div class="bg-gray-50 p-4 rounded-lg border border-gray-100"><p class="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Role</p><p class="text-gray-800 font-medium text-lg">${fallback(user.role)}</p></div>
                            <div class="bg-gray-50 p-4 rounded-lg border border-gray-100"><p class="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">State</p><p class="text-gray-800 font-medium text-lg">${fallback(user.state)}</p></div>
                            <div class="bg-gray-50 p-4 rounded-lg border border-gray-100"><p class="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">City</p><p class="text-gray-800 font-medium text-lg">${fallback(user.city)}</p></div>
                        </div>
                    </div>

                    <!-- Edit Profile Tab -->
                    <div id="tab-edit" class="tab-content bg-white rounded-xl shadow-md p-6 lg:p-8">
                        <h3 class="text-2xl font-bold text-gray-800 border-b pb-4 mb-6"><i class="fa-solid fa-user-pen text-blue-500 mr-2"></i> Edit Profile</h3>
                        <div class="bg-blue-50 text-blue-700 p-4 rounded-lg mb-6 text-sm flex items-start gap-3">
                            <i class="fa-solid fa-circle-info mt-1"></i><p>Keep your profile updated. Note that your email address is used for login and cannot be changed.</p>
                        </div>
                        <form action="/account/update" method="POST" class="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div><label class="block text-sm font-semibold text-gray-700 mb-1">First Name</label><input type="text" name="first_name" value="${user.first_name || ''}" required class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></div>
                            <div><label class="block text-sm font-semibold text-gray-700 mb-1">Last Name</label><input type="text" name="last_name" value="${user.last_name || ''}" required class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></div>
                            <div class="md:col-span-2"><label class="block text-sm font-semibold text-gray-700 mb-1">Email Address (Read-only)</label><input type="email" value="${user.email}" readonly class="w-full px-4 py-2 border bg-gray-100 text-gray-500 rounded-lg cursor-not-allowed"></div>
                            <div><label class="block text-sm font-semibold text-gray-700 mb-1">Contact Number</label><input type="text" name="contact" value="${user.contact || ''}" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">Gender</label>
                                <select name="gender" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                    <option value="">Select Gender</option>
                                    <option value="Male" ${sel(user.gender, 'Male')}>Male</option>
                                    <option value="Female" ${sel(user.gender, 'Female')}>Female</option>
                                    <option value="Other" ${sel(user.gender, 'Other')}>Other</option>
                                </select>
                            </div>
                            <div><label class="block text-sm font-semibold text-gray-700 mb-1">Qualification</label><input type="text" name="qualification" value="${user.qualification || ''}" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                                <select name="role" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                    <option value="">Select Role</option>
                                    <option value="Student" ${sel(user.role, 'Student')}>Student</option>
                                    <option value="Faculty" ${sel(user.role, 'Faculty')}>Faculty</option>
                                </select>
                            </div>
                            <div><label class="block text-sm font-semibold text-gray-700 mb-1">State</label><input type="text" name="state" value="${user.state || ''}" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></div>
                            <div><label class="block text-sm font-semibold text-gray-700 mb-1">City</label><input type="text" name="city" value="${user.city || ''}" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></div>
                            
                            <div class="md:col-span-2 pt-4 border-t mt-2 flex justify-end">
                                <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow transition">Save Changes</button>
                            </div>
                        </form>
                    </div>

                    <!-- Change Password Tab -->
                    <div id="tab-password" class="tab-content bg-white rounded-xl shadow-md p-6 lg:p-8">
                        <h3 class="text-2xl font-bold text-gray-800 border-b pb-4 mb-6"><i class="fa-solid fa-shield-halved text-blue-500 mr-2"></i> Change Password</h3>
                        <form action="/account/password" method="POST" class="max-w-md space-y-5">
                            <div><label class="block text-sm font-semibold text-gray-700 mb-1">Current Password</label><input type="password" name="current_password" required class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">New Password</label>
                                <input type="password" id="new_password" name="new_password" required class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                <p class="text-xs text-gray-500 mt-1">Must be at least 4 characters long.</p>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">Confirm New Password</label>
                                <input type="password" id="confirm_password" name="confirm_password" required class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" oninput="checkPass()">
                                <p id="pass_match_msg" class="text-xs mt-1 font-semibold"></p>
                            </div>
                            <div class="pt-2">
                                <button type="submit" class="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-6 rounded-lg shadow transition w-full">Update Password</button>
                            </div>
                        </form>
                    </div>

                </div>
            </div>
        </div>

        <script>
            function switchTab(tabName) {
                document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-btn').forEach(b => {
                    b.classList.remove('text-blue-700', 'bg-blue-50');
                    b.classList.add('text-gray-600');
                });
                document.getElementById('tab-' + tabName).classList.add('active');
                let btn = document.getElementById('btn-' + tabName);
                btn.classList.remove('text-gray-600');
                btn.classList.add('text-blue-700', 'bg-blue-50');
            }

            function checkPass() {
                const p1 = document.getElementById('new_password').value;
                const p2 = document.getElementById('confirm_password').value;
                const msg = document.getElementById('pass_match_msg');
                if(p2 === '') { msg.innerText = ''; return; }
                if(p1 === p2) { msg.innerText = 'Passwords match ✓'; msg.className = 'text-xs mt-1 font-semibold text-green-600'; } 
                else { msg.innerText = 'Passwords do not match ✗'; msg.className = 'text-xs mt-1 font-semibold text-red-600'; }
            }
        </script>
    `;
    
    res.send(renderHTML(req, res, "My Account - Assignment 12", content));
});

// Error Handlers
app.use((req, res) => res.status(404).send(renderHTML(req, res, "404", "<div class='text-center p-20'><h1 class='text-4xl'>404 Not Found</h1></div>")));
app.use((err, req, res, next) => res.status(500).send(renderHTML(req, res, "Error", "<div class='text-center p-20'><h1 class='text-4xl'>500 Error</h1></div>")));

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT} with JSON Database`));