js
// index.js (UI optimized version – no structural/backend changes)

const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcryptjs");

const app = express();
const DATA_FILE = path.join(__dirname, "users.json");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || "assignment12_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 }
}));

app.use((req, res, next) => {
    res.locals.message = req.session?.message || null;
    if (req.session) delete req.session.message;
    next();
});

function setMessage(req, type, text) {
    if (req.session) req.session.message = { type, text };
}

async function getUsers() {
    try {
        return JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
    } catch {
        return [];
    }
}

async function saveUsers(users) {
    await fs.writeFile(DATA_FILE, JSON.stringify(users, null, 2));
}

function requireLogin(req, res, next) {
    if (!req.session?.user) {
        setMessage(req, 'error', 'Please login first.');
        return res.redirect("/");
    }
    next();
}

// ================= ROUTES =================

app.post("/register", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        setMessage(req, 'error', 'Email & password required');
        return res.redirect("/");
    }

    const users = await getUsers();
    if (users.some(u => u.email === email)) {
        setMessage(req, 'error', 'Email exists');
        return res.redirect("/");
    }

    const newUser = {
        id: Date.now().toString(),
        ...req.body,
        password: await bcrypt.hash(password, 10),
        created_at: new Date().toISOString()
    };

    users.push(newUser);
    await saveUsers(users);
    setMessage(req, 'success', 'Registered!');
    res.redirect("/");
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const users = await getUsers();
    const user = users.find(u => u.email === email);

    if (user && await bcrypt.compare(password, user.password)) {
        req.session.user = user;
        setMessage(req, 'success', `Welcome ${user.first_name}`);
    } else {
        setMessage(req, 'error', 'Invalid login');
    }
    res.redirect("/");
});

app.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
});

// ================= UI =================

function renderHTML(req, res, title, content) {
    const user = req.session?.user;
    const message = res.locals.message;

    const toast = message ? `
    <div id="toast" class="fixed top-20 right-5 px-6 py-4 rounded shadow-lg text-white font-semibold ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'} animate-slideIn">
        ${message.text}
    </div>
    <script>
        setTimeout(()=>document.getElementById('toast')?.remove(),3000)
    </script>` : '';

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>

<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

<style>
@keyframes slideIn {
 from { opacity:0; transform:translateX(40px); }
 to { opacity:1; transform:translateX(0); }
}
.animate-slideIn { animation: slideIn .3s ease; }
</style>
</head>

<body class="bg-gray-100 text-gray-800">

${toast}

<nav class="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
    <span class="font-bold text-lg">Portal</span>

    ${user ? `
        <div class="flex items-center gap-4">
            <span>${user.first_name}</span>
            <a href="/logout" class="text-red-400 hover:text-red-300">Logout</a>
        </div>
    ` : `
        <div class="flex gap-3">
            <button onclick="openModal('loginModal')" class="hover:underline">Login</button>
            <button onclick="openModal('registerModal')" class="bg-blue-600 px-4 py-1 rounded hover:bg-blue-500">Register</button>
        </div>
    `}
</nav>

<main class="p-10 text-center">
    <h1 class="text-4xl font-bold mb-6">Student Portal</h1>

    ${user ? `<p class="text-lg">Welcome back 👋</p>` :
    `<button onclick="openModal('registerModal')" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition">Get Started</button>`}
</main>

${!user ? modalHTML() : ''}

<script>
function openModal(id){
    document.getElementById(id).classList.remove('hidden')
}
function closeModal(id){
    document.getElementById(id).classList.add('hidden')
}

document.addEventListener("keydown", e=>{
 if(e.key==="Escape"){
   document.querySelectorAll('.modal').forEach(m=>m.classList.add('hidden'))
 }
})

function togglePass(id, el){
 const i = document.getElementById(id)
 if(i.type==="password"){
  i.type="text"
  el.classList.replace("fa-eye","fa-eye-slash")
 } else {
  i.type="password"
  el.classList.replace("fa-eye-slash","fa-eye")
 }
}
</script>

</body>
</html>`;
}

function modalHTML() {
    return `

<div id="loginModal" class="modal hidden fixed inset-0 bg-black/60 flex items-center justify-center"
onclick="if(event.target===this) closeModal('loginModal')">
<div class="bg-white p-6 rounded-xl w-80 space-y-4">

<h2 class="text-xl font-bold">Login</h2>

<form method="POST" action="/login">
<div class="relative">
<input name="email" required placeholder="Email" class="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500">
</div>

<div class="relative">
<input id="loginPass" type="password" name="password" required placeholder="Password" class="w-full px-4 py-2 border rounded pr-10 focus:ring-2 focus:ring-blue-500">
<i onclick="togglePass('loginPass', this)" class="fa fa-eye absolute right-3 top-3 cursor-pointer"></i>
</div>

<button onclick="this.disabled=true; this.innerText='Logging in...'; this.form.submit()" class="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-500 transition">
Login
</button>
</form>

</div>
</div>

<div id="registerModal" class="modal hidden fixed inset-0 bg-black/60 flex items-center justify-center"
onclick="if(event.target===this) closeModal('registerModal')">
<div class="bg-white p-6 rounded-xl w-96 space-y-3 max-h-[90vh] overflow-y-auto">

<h2 class="text-xl font-bold">Register</h2>

<form method="POST" action="/register" class="space-y-3">

<input name="first_name" required placeholder="First name" class="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500">
<input name="email" required placeholder="Email" class="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500">

<div class="relative">
<input id="regPass" type="password" name="password" required placeholder="Password" class="w-full px-4 py-2 border rounded pr-10 focus:ring-2 focus:ring-blue-500">
<i onclick="togglePass('regPass', this)" class="fa fa-eye absolute right-3 top-3 cursor-pointer"></i>
</div>

<button onclick="this.disabled=true; this.innerText='Creating...'; this.form.submit()" class="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-500 transition">
Register
</button>

</form>
</div>
</div>
`;
}

app.get("/", (req, res) => {
    res.send(renderHTML(req, res, "Home", ""));
});

app.listen(3000, () => console.log("Running on 3000"));
