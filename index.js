const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcryptjs");

const app = express();
const DATA_FILE = path.join(__dirname, "data.json");

// ==========================================
// Middleware Setup
// ==========================================
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || "assignment_super_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 } // 24-hour session
}));

// Toast Notifications Middleware
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
// JSON DATABASE ENGINE (replaces MySQL)
// ==========================================
async function getData() {
    try {
        const data = await fs.readFile(DATA_FILE, "utf8");
        return JSON.parse(data);
    } catch (err) {
        // If file doesn't exist, create it and seed the dynamic content!
        const defaultData = {
            users: [],
            // Dynamic Content required for Assignment 11
            speakers: [
                { id: 1, name: "Dr. Alan Turing", topic: "Foundations of Computing", role: "Keynote Speaker" },
                { id: 2, name: "Grace Hopper", topic: "The Future of Compilers", role: "Guest Speaker" },
                { id: 3, name: "Tim Berners-Lee", topic: "Web Technologies 2030", role: "Lead Researcher" }
            ]
        };
        await fs.writeFile(DATA_FILE, JSON.stringify(defaultData, null, 2), "utf8");
        return defaultData;
    }
}

async function saveData(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function requireLogin(req, res, next) {
    if (!req.session || !req.session.user) {
        setMessage(req, 'error', 'Please login to access your account.');
        return res.redirect("/");
    }
    next();
}

// ==========================================
// ROUTING & AUTHENTICATION (Assignments 10 & 12)
// ==========================================

// REGISTER
app.post("/register", async (req, res) => {
    try {
        const { first_name, last_name, email, password, contact, gender, qualification, role, state, city } = req.body;
        const data = await getData();
        
        if (data.users.some(u => u.email === email)) {
            setMessage(req, 'error', 'Email is already registered.');
            return res.redirect("/");
        }

        const newUser = {
            id: Date.now().toString(),
            first_name, last_name, email,
            password: await bcrypt.hash(password, 10),
            contact, gender, qualification, role, state, city,
            created_at: new Date().toISOString()
        };

        data.users.push(newUser);
        await saveData(data);
        
        setMessage(req, 'success', 'Registration successful! Please login.');
        res.redirect("/");
    } catch (err) {
        setMessage(req, 'error', 'Registration failed.');
        res.redirect("/");
    }
});

// LOGIN
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const data = await getData();
        
        const user = data.users.find(u => u.email === email);
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = user;
            setMessage(req, 'success', `Welcome back, ${user.first_name}!`);
            return res.redirect("/");
        }
        
        setMessage(req, 'error', 'Invalid email or password.');
        res.redirect("/");
    } catch (err) {
        setMessage(req, 'error', 'Login error.');
        res.redirect("/");
    }
});

// LOGOUT
app.get("/logout", (req, res) => {
    if (req.session) req.session.destroy(() => res.redirect("/"));
    else res.redirect("/");
});

// UPDATE PROFILE
app.post("/account/update", requireLogin, async (req, res) => {
    try {
        const { first_name, last_name, contact, gender, qualification, role, state, city } = req.body;
        const userId = req.session.user.id;
        const data = await getData();
        const index = data.users.findIndex(u => u.id === userId);

        if (index !== -1) {
            data.users[index] = { ...data.users[index], first_name, last_name, contact, gender, qualification, role, state, city };
            await saveData(data);
            req.session.user = data.users[index]; // Update session
            setMessage(req, 'success', 'Profile updated successfully!');
        }
        res.redirect("/account");
    } catch (err) {
        setMessage(req, 'error', 'Update failed.');
        res.redirect("/account");
    }
});

// UPDATE PASSWORD
app.post("/account/password", requireLogin, async (req, res) => {
    try {
        const { current_password, new_password, confirm_password } = req.body;
        const userId = req.session.user.id;
        const data = await getData();
        const index = data.users.findIndex(u => u.id === userId);

        if (index === -1) return res.redirect("/account");

        if (!(await bcrypt.compare(current_password, data.users[index].password))) {
            setMessage(req, 'error', 'Current password is incorrect.');
        } else if (new_password.length < 4 || new_password !== confirm_password) {
            setMessage(req, 'error', 'Passwords do not match or are too short.');
        } else {
            data.users[index].password = await bcrypt.hash(new_password, 10);
            await saveData(data);
            req.session.user.password = data.users[index].password;
            setMessage(req, 'success', 'Password changed successfully!');
        }
        res.redirect("/account");
    } catch (err) {
        setMessage(req, 'error', 'Password update failed.');
        res.redirect("/account");
    }
});

// ==========================================
// FRONTEND UI GENERATOR (HTML + Tailwind)
// ==========================================

function renderHTML(req, res, title, content) {
    const user = req.session ? req.session.user : null;
    const message = res.locals.message;
    
    let toastHTML = '';
    if (message) {
        const color = message.type === 'success' ? 'bg-green-500' : 'bg-red-500';
        toastHTML = `<div id="toast" class="fixed top-20 right-5 z-50 px-6 py-4 rounded shadow-lg text-white font-semibold transition-opacity duration-500 ${color}">
            ${message.text}</div>
        <script>setTimeout(() => { let t = document.getElementById('toast'); if(t){ t.style.opacity='0'; setTimeout(()=>t.remove(),500); }}, 3000);</script>`;
    }

    return `<!DOCTYPE html>
    <html lang="en" class="scroll-smooth">
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
        
        <!-- FIXED NAVIGATION MENU (Assn 11 Requirement) -->
        <nav class="bg-gray-900 text-white shadow-lg fixed top-0 w-full z-50">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16 flex-wrap">
                    <div class="flex items-center">
                        <a href="/#home" class="text-xl font-bold tracking-wider flex items-center gap-2">
                            <i class="fa-solid fa-graduation-cap text-blue-400"></i> TechConf 2026
                        </a>
                    </div>
                    
                    <div class="hidden md:flex items-center space-x-6 text-sm font-semibold text-gray-300">
                        <a href="/#home" class="hover:text-white transition">Home</a>
                        <a href="/#speakers" class="hover:text-white transition">Speakers</a>
                        <a href="/#about" class="hover:text-white transition">About</a>
                    </div>

                    <div class="flex items-center space-x-4">
                        ${user ? `
                            <span class="hidden sm:block text-gray-300">Hi, <span class="text-white">${user.first_name}</span></span>
                            <a href="/account" class="px-3 py-2 rounded-md text-sm font-medium ${req.path === '/account' ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700'}">My Account</a>
                            <a href="/logout" class="px-3 py-2 rounded-md text-sm font-medium text-red-400 hover:bg-gray-700">Logout</a>
                        ` : `
                            <button onclick="document.getElementById('loginModal').classList.remove('hidden')" class="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Login</button>
                            <button onclick="document.getElementById('registerModal').classList.remove('hidden')" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium shadow">Register</button>
                        `}
                    </div>
                </div>
            </div>
        </nav>

        <!-- Padding to offset fixed navbar -->
        <main class="flex-grow flex flex-col pt-16">
            ${content}
        </main>

        <!-- FOOTER (Assn 11 Requirement) -->
        <footer class="bg-gray-900 text-gray-400 py-6 text-center text-sm mt-auto border-t border-gray-800">
            <p>Made by <span class="text-white font-semibold">Nikhil Kumar</span>, <span class="text-white">24U022005</span></p>
        </footer>

        <!-- MODALS (Assn 10 Requirement) -->
        ${!user ? `
        <!-- Login Modal -->
        <div id="loginModal" class="fixed inset-0 bg-black bg-opacity-60 hidden flex justify-center items-center z-50 px-4">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden relative">
                <button onclick="document.getElementById('loginModal').classList.add('hidden')" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800"><i class="fa-solid fa-xmark text-xl"></i></button>
                <div class="bg-gray-50 border-b p-6 text-center"><h2 class="text-2xl font-bold">Login</h2></div>
                <form action="/login" method="POST" class="p-6 space-y-4">
                    <input type="email" name="email" placeholder="Email" required class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    <input type="password" name="password" placeholder="Password" required class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg">Login</button>
                </form>
            </div>
        </div>

        <!-- Register Modal -->
        <div id="registerModal" class="fixed inset-0 bg-black bg-opacity-60 hidden flex justify-center items-center z-50 px-4">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden relative max-h-[90vh] overflow-y-auto">
                <button onclick="document.getElementById('registerModal').classList.add('hidden')" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800"><i class="fa-solid fa-xmark text-xl"></i></button>
                <div class="bg-gray-50 border-b p-6 text-center"><h2 class="text-2xl font-bold">Register</h2></div>
                <form action="/register" method="POST" class="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" name="first_name" placeholder="First Name *" required class="border px-4 py-2 rounded-lg">
                    <input type="text" name="last_name" placeholder="Last Name *" required class="border px-4 py-2 rounded-lg">
                    <input type="email" name="email" placeholder="Email *" required class="border px-4 py-2 rounded-lg md:col-span-2">
                    <input type="password" name="password" placeholder="Password *" required class="border px-4 py-2 rounded-lg md:col-span-2">
                    <input type="text" name="contact" placeholder="Contact Number" class="border px-4 py-2 rounded-lg">
                    <select name="gender" class="border px-4 py-2 rounded-lg"><option value="">Gender</option><option>Male</option><option>Female</option></select>
                    <input type="text" name="qualification" placeholder="Education" class="border px-4 py-2 rounded-lg">
                    <select name="role" class="border px-4 py-2 rounded-lg"><option value="">Role</option><option>Student</option><option>Faculty</option></select>
                    <input type="text" name="state" placeholder="State" class="border px-4 py-2 rounded-lg">
                    <input type="text" name="city" placeholder="City" class="border px-4 py-2 rounded-lg">
                    <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg md:col-span-2">Register</button>
                </form>
            </div>
        </div>
        ` : ''}
    </body></html>`;
}

// ==========================================
// PAGES (Home & Account)
// ==========================================

app.get("/", async (req, res) => {
    // Read Dynamic Content from JSON (Assignment 11 Requirement)
    const data = await getData();
    const speakersHTML = data.speakers.map(s => `
        <div class="bg-white p-6 rounded-xl shadow-md border-t-4 border-blue-500 text-center transform transition hover:-translate-y-1 hover:shadow-lg">
            <div class="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">${s.name.charAt(0)}</div>
            <h4 class="text-lg font-bold text-gray-800">${s.name}</h4>
            <p class="text-sm text-blue-600 font-semibold mb-2">${s.role}</p>
            <p class="text-gray-500 text-sm">Topic: ${s.topic}</p>
        </div>
    `).join('');

    const content = `
        <!-- HERO SECTION -->
        <section id="home" class="bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900 text-white py-32 text-center px-4">
            <h1 class="text-4xl md:text-6xl font-extrabold mb-6">Student Tech Conference</h1>
            <p class="text-lg text-gray-300 max-w-2xl mx-auto mb-8">Dynamic Content, Smooth Scrolling, Modals, and Profile Management combined into one seamless Node.js application.</p>
            <a href="#speakers" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transition">View Speakers <i class="fa-solid fa-arrow-down ml-2"></i></a>
        </section>

        <!-- DYNAMIC CONTENT SECTION (Assn 11 Requirement) -->
        <section id="speakers" class="py-20 bg-gray-50 px-4">
            <div class="max-w-6xl mx-auto">
                <div class="text-center mb-12">
                    <h2 class="text-3xl font-bold text-gray-800">Keynote Speakers</h2>
                    <p class="text-gray-500 mt-2">Data dynamically loaded from backend JSON.</p>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                    ${speakersHTML}
                </div>
            </div>
        </section>

        <!-- ABOUT SECTION -->
        <section id="about" class="py-20 bg-white px-4 text-center">
            <div class="max-w-3xl mx-auto">
                <h2 class="text-3xl font-bold text-gray-800 mb-6">About This Portal</h2>
                <p class="text-gray-600 text-lg leading-relaxed">This platform demonstrates a full implementation of Assignments 10, 11, and 12. It features a sticky navigation bar with section scrolling, dynamic content generation, robust JSON-based authentication, and a dedicated 'My Account' portal for users to manage their profiles securely.</p>
            </div>
        </section>
    `;
    res.send(renderHTML(req, res, "Home - Conference", content));
});

app.get("/account", requireLogin, (req, res) => {
    const user = req.session.user;
    const fallback = (val) => val ? val : '<span class="text-gray-400 italic">Not provided</span>';
    const sel = (v, t) => v === t ? 'selected' : '';

    const content = `
        <div class="max-w-6xl mx-auto px-4 py-12 w-full flex-grow">
            <h2 class="text-3xl font-bold text-gray-800 mb-8">My Account Portal</h2>
            <div class="flex flex-col md:flex-row gap-8">
                
                <!-- Sidebar -->
                <div class="w-full md:w-1/4">
                    <div class="bg-white rounded-xl shadow-md p-6 text-center border-t-4 border-blue-500">
                        <div class="w-20 h-20 mx-auto bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl font-bold mb-4">${(user.first_name || 'U').charAt(0).toUpperCase()}</div>
                        <h2 class="text-lg font-bold">${user.first_name} ${user.last_name}</h2>
                        <p class="text-gray-500 text-sm mb-4">${user.email}</p>
                        
                        <div class="flex flex-col gap-2 mt-6">
                            <button onclick="switchTab('details')" id="btn-details" class="tab-btn w-full text-left px-4 py-2 rounded font-medium text-blue-700 bg-blue-50">My Details</button>
                            <button onclick="switchTab('edit')" id="btn-edit" class="tab-btn w-full text-left px-4 py-2 rounded font-medium text-gray-600 hover:bg-gray-50">Edit Profile</button>
                            <button onclick="switchTab('password')" id="btn-password" class="tab-btn w-full text-left px-4 py-2 rounded font-medium text-gray-600 hover:bg-gray-50">Change Password</button>
                        </div>
                    </div>
                </div>

                <!-- Content Area -->
                <div class="w-full md:w-3/4">
                    
                    <!-- View Details -->
                    <div id="tab-details" class="tab-content active bg-white rounded-xl shadow-md p-8">
                        <h3 class="text-xl font-bold border-b pb-4 mb-6">Account Information</h3>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div class="bg-gray-50 p-4 rounded"><p class="text-xs text-gray-500 font-bold uppercase mb-1">Name</p><p>${fallback(user.first_name)} ${fallback(user.last_name)}</p></div>
                            <div class="bg-gray-50 p-4 rounded"><p class="text-xs text-gray-500 font-bold uppercase mb-1">Email</p><p>${fallback(user.email)}</p></div>
                            <div class="bg-gray-50 p-4 rounded"><p class="text-xs text-gray-500 font-bold uppercase mb-1">Contact</p><p>${fallback(user.contact)}</p></div>
                            <div class="bg-gray-50 p-4 rounded"><p class="text-xs text-gray-500 font-bold uppercase mb-1">Gender</p><p>${fallback(user.gender)}</p></div>
                            <div class="bg-gray-50 p-4 rounded"><p class="text-xs text-gray-500 font-bold uppercase mb-1">Qualification</p><p>${fallback(user.qualification)}</p></div>
                            <div class="bg-gray-50 p-4 rounded"><p class="text-xs text-gray-500 font-bold uppercase mb-1">Role</p><p>${fallback(user.role)}</p></div>
                            <div class="bg-gray-50 p-4 rounded"><p class="text-xs text-gray-500 font-bold uppercase mb-1">State</p><p>${fallback(user.state)}</p></div>
                            <div class="bg-gray-50 p-4 rounded"><p class="text-xs text-gray-500 font-bold uppercase mb-1">City</p><p>${fallback(user.city)}</p></div>
                        </div>
                    </div>

                    <!-- Edit Profile -->
                    <div id="tab-edit" class="tab-content bg-white rounded-xl shadow-md p-8">
                        <h3 class="text-xl font-bold border-b pb-4 mb-6">Edit Profile</h3>
                        <form action="/account/update" method="POST" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div><label class="block text-sm text-gray-600 mb-1">First Name</label><input type="text" name="first_name" value="${user.first_name || ''}" class="border w-full p-2 rounded outline-none focus:border-blue-500"></div>
                            <div><label class="block text-sm text-gray-600 mb-1">Last Name</label><input type="text" name="last_name" value="${user.last_name || ''}" class="border w-full p-2 rounded outline-none focus:border-blue-500"></div>
                            <div><label class="block text-sm text-gray-600 mb-1">Contact</label><input type="text" name="contact" value="${user.contact || ''}" class="border w-full p-2 rounded outline-none focus:border-blue-500"></div>
                            <div>
                                <label class="block text-sm text-gray-600 mb-1">Gender</label>
                                <select name="gender" class="border w-full p-2 rounded outline-none focus:border-blue-500">
                                    <option ${sel(user.gender, 'Male')}>Male</option>
                                    <option ${sel(user.gender, 'Female')}>Female</option>
                                </select>
                            </div>
                            <div><label class="block text-sm text-gray-600 mb-1">Qualification</label><input type="text" name="qualification" value="${user.qualification || ''}" class="border w-full p-2 rounded outline-none focus:border-blue-500"></div>
                            <div>
                                <label class="block text-sm text-gray-600 mb-1">Role</label>
                                <select name="role" class="border w-full p-2 rounded outline-none focus:border-blue-500">
                                    <option ${sel(user.role, 'Student')}>Student</option>
                                    <option ${sel(user.role, 'Faculty')}>Faculty</option>
                                </select>
                            </div>
                            <div><label class="block text-sm text-gray-600 mb-1">State</label><input type="text" name="state" value="${user.state || ''}" class="border w-full p-2 rounded outline-none focus:border-blue-500"></div>
                            <div><label class="block text-sm text-gray-600 mb-1">City</label><input type="text" name="city" value="${user.city || ''}" class="border w-full p-2 rounded outline-none focus:border-blue-500"></div>
                            <div class="sm:col-span-2 mt-4"><button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-bold w-full sm:w-auto">Save Changes</button></div>
                        </form>
                    </div>

                    <!-- Change Password -->
                    <div id="tab-password" class="tab-content bg-white rounded-xl shadow-md p-8">
                        <h3 class="text-xl font-bold border-b pb-4 mb-6">Change Password</h3>
                        <form action="/account/password" method="POST" class="space-y-4 max-w-sm">
                            <input type="password" name="current_password" placeholder="Current Password" required class="border w-full p-2 rounded outline-none focus:border-blue-500">
                            <input type="password" name="new_password" placeholder="New Password" required class="border w-full p-2 rounded outline-none focus:border-blue-500">
                            <input type="password" name="confirm_password" placeholder="Confirm New Password" required class="border w-full p-2 rounded outline-none focus:border-blue-500">
                            <button type="submit" class="bg-gray-800 hover:bg-gray-900 text-white px-6 py-2 rounded font-bold w-full">Update Password</button>
                        </form>
                    </div>

                </div>
            </div>
        </div>
        <script>
            function switchTab(name) {
                document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('text-blue-700', 'bg-blue-50'); b.classList.add('text-gray-600'); });
                document.getElementById('tab-' + name).classList.add('active');
                let btn = document.getElementById('btn-' + name);
                btn.classList.remove('text-gray-600'); btn.classList.add('text-blue-700', 'bg-blue-50');
            }
        </script>
    `;
    res.send(renderHTML(req, res, "My Account", content));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Final App Running on Port ${PORT}`));