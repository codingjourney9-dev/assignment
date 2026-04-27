const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const session = require("express-session");

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || "secretkey",
    resave: false,
    saveUninitialized: true
}));

// Database connection — uses Railway env variables automatically
const db = mysql.createConnection({
    host:     process.env.MYSQLHOST     || "localhost",
    user:     process.env.MYSQLUSER     || "root",
    password: process.env.MYSQLPASSWORD || "",
    database: process.env.MYSQLDATABASE || "assignment12",
    port:     process.env.MYSQLPORT     || 3306
});

db.connect(err => {
    if (err) {
        console.error("MySQL connection error:", err);
    } else {
        console.log("MySQL Connected");

        const createTable = `
            CREATE TABLE IF NOT EXISTS users (
                id int NOT NULL AUTO_INCREMENT,
                first_name varchar(50) DEFAULT NULL,
                last_name varchar(50) DEFAULT NULL,
                email varchar(100) DEFAULT NULL,
                password varchar(255) DEFAULT NULL,
                contact varchar(15) DEFAULT NULL,
                gender varchar(10) DEFAULT NULL,
                qualification varchar(100) DEFAULT NULL,
                role varchar(20) DEFAULT NULL,
                state varchar(50) DEFAULT NULL,
                city varchar(50) DEFAULT NULL,
                created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `;
        db.query(createTable, (err) => {
            if (err) console.error("Table creation error:", err);
            else {
                const seed = `INSERT IGNORE INTO users (id,first_name,last_name,email,password,contact,gender,qualification,role,state,city)
                              VALUES (1,'Nikhil','Kumar','codingjourney9@gmail.com','abcd','98760','Male','student','Student','GUJARAT','VADODARA')`;
                db.query(seed, (err) => {
                    if (err) console.error("Seed error:", err);
                    else console.log("Database ready");
                });
            }
        });
    }
});

// ─── Middleware: require login ────────────────────────────────────────────────
function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.send(`<script>alert("Please login first."); window.location="/";</script>`);
    }
    next();
}

// ─── REGISTER ─────────────────────────────────────────────────────────────────
app.post("/register", (req, res) => {
    const { first_name, last_name, email, password, contact, gender, qualification, role, state, city } = req.body;
    const sql = `INSERT INTO users (first_name,last_name,email,password,contact,gender,qualification,role,state,city)
                 VALUES (?,?,?,?,?,?,?,?,?,?)`;
    db.query(sql, [first_name, last_name, email, password, contact, gender, qualification, role, state, city], (err) => {
        if (err) {
            return res.send(`<script>alert("Email already registered or error occurred."); window.location="/";</script>`);
        }
        db.query("SELECT * FROM users WHERE email = ?", [email], (err, result) => {
            if (!err && result.length > 0) req.session.user = result[0];
            res.redirect("/");
        });
    });
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────
app.post("/login", (req, res) => {
    const { email, password } = req.body;
    db.query("SELECT * FROM users WHERE email = ?", [email], (err, result) => {
        if (err) throw err;
        if (result.length > 0 && result[0].password === password) {
            req.session.user = result[0];
            res.redirect("/");
        } else if (result.length === 0) {
            res.send(`<script>alert("User not found."); window.location="/";</script>`);
        } else {
            res.send(`<script>alert("Wrong password."); window.location="/";</script>`);
        }
    });
});

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
app.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
});

// ─── UPDATE PROFILE ───────────────────────────────────────────────────────────
app.post("/account/update", requireLogin, (req, res) => {
    const { first_name, last_name, contact, gender, qualification, role, state, city } = req.body;
    const id = req.session.user.id;

    const sql = `UPDATE users SET first_name=?, last_name=?, contact=?, gender=?, qualification=?, role=?, state=?, city=?
                 WHERE id=?`;
    db.query(sql, [first_name, last_name, contact, gender, qualification, role, state, city, id], (err) => {
        if (err) {
            return res.send(`<script>alert("Update failed: ${err.message}"); window.location="/account";</script>`);
        }
        // Refresh session
        db.query("SELECT * FROM users WHERE id = ?", [id], (err, result) => {
            if (!err && result.length > 0) req.session.user = result[0];
            res.send(`<script>alert("Profile updated successfully!"); window.location="/account";</script>`);
        });
    });
});

// ─── UPDATE PASSWORD ──────────────────────────────────────────────────────────
app.post("/account/password", requireLogin, (req, res) => {
    const { current_password, new_password, confirm_password } = req.body;
    const user = req.session.user;

    if (user.password !== current_password) {
        return res.send(`<script>alert("Current password is incorrect."); window.location="/account";</script>`);
    }
    if (new_password.length < 4) {
        return res.send(`<script>alert("New password must be at least 4 characters."); window.location="/account";</script>`);
    }
    if (new_password !== confirm_password) {
        return res.send(`<script>alert("New passwords do not match."); window.location="/account";</script>`);
    }

    db.query("UPDATE users SET password=? WHERE id=?", [new_password, user.id], (err) => {
        if (err) {
            return res.send(`<script>alert("Password update failed."); window.location="/account";</script>`);
        }
        req.session.user.password = new_password;
        res.send(`<script>alert("Password updated successfully!"); window.location="/account";</script>`);
    });
});

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
function sharedStyles() {
    return `
    <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f4f6f9; min-height: 100vh; display: flex; flex-direction: column; }

    nav {
        background: #333; color: white; padding: 15px 24px;
        display: flex; justify-content: space-between; align-items: center;
        flex-wrap: wrap; gap: 10px; position: sticky; top: 0; z-index: 100;
    }
    nav .brand { font-size: 18px; font-weight: bold; }
    nav .nav-btns { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    nav button {
        background: #007BFF; color: white; border: none;
        padding: 8px 18px; border-radius: 5px; cursor: pointer; font-size: 14px;
    }
    nav button:hover { background: #0056b3; }
    nav a { color: #ccc; text-decoration: none; font-size: 14px; }
    nav a:hover { color: white; }
    nav a.active { color: white; font-weight: bold; border-bottom: 2px solid #007BFF; padding-bottom: 2px; }

    footer {
        background: #222; color: rgba(255,255,255,0.5);
        text-align: center; padding: 20px; font-size: 13px; margin-top: auto;
    }
    footer strong { color: #f0c040; }

    /* MODAL */
    .modal {
        display: none; position: fixed; top: 0; left: 0;
        width: 100%; height: 100%; background: rgba(0,0,0,0.5);
        justify-content: center; align-items: center; z-index: 999;
    }
    .modal-content {
        background: white; padding: 32px 28px; width: 90%; max-width: 420px;
        border-radius: 12px; position: relative; max-height: 90vh; overflow-y: auto;
    }
    .modal-content h2 { margin-bottom: 20px; color: #333; }
    .close-btn {
        position: absolute; top: 14px; right: 18px;
        font-size: 22px; cursor: pointer; color: #999; background: none; border: none;
    }
    form { display: flex; flex-direction: column; gap: 12px; }
    input, select {
        padding: 11px 14px; font-size: 15px; border: 1px solid #ddd;
        border-radius: 7px; outline: none; transition: border 0.2s; width: 100%;
    }
    input:focus, select:focus { border-color: #007BFF; }
    .btn-primary {
        background: #007BFF; color: white; border: none;
        padding: 13px; border-radius: 7px; cursor: pointer;
        font-size: 15px; font-weight: bold;
    }
    .btn-primary:hover { background: #0056b3; }
    .btn-danger {
        background: #dc3545; color: white; border: none;
        padding: 11px 20px; border-radius: 7px; cursor: pointer; font-size: 14px;
    }
    .btn-danger:hover { background: #b02a37; }
    .switch-link { text-align: center; font-size: 13px; color: #666; margin-top: 8px; }
    .switch-link a { color: #007BFF; cursor: pointer; text-decoration: none; }

    @media(max-width: 600px) { .modal-content { padding: 24px 18px; } }
    </style>`;
}

function sharedNav(user, activePage) {
    return `
    <nav>
        <div class="brand">📘 Assignment 12</div>
        <div class="nav-btns">
        ${user ? `
            <span style="color:#ccc;font-size:14px;">👤 <strong style="color:white">${user.first_name}</strong></span>
            <a href="/account" ${activePage === 'account' ? 'class="active"' : ''}>My Account</a>
            <a href="/logout">Logout</a>
        ` : `
            <button onclick="showLogin()">Login</button>
            <button onclick="showRegister()">Register</button>
        `}
        </div>
    </nav>`;
}

function sharedModals() {
    return `
    <!-- LOGIN MODAL -->
    <div id="loginModal" class="modal">
        <div class="modal-content">
            <button class="close-btn" onclick="closeModals()">×</button>
            <h2>Login</h2>
            <form method="POST" action="/login">
                <input name="email" type="email" placeholder="Email" required>
                <input name="password" type="password" placeholder="Password" required>
                <button type="submit" class="btn-primary">Login</button>
            </form>
            <div class="switch-link">Don't have an account? <a onclick="showRegister()">Register</a></div>
        </div>
    </div>

    <!-- REGISTER MODAL -->
    <div id="registerModal" class="modal">
        <div class="modal-content">
            <button class="close-btn" onclick="closeModals()">×</button>
            <h2>Register</h2>
            <form method="POST" action="/register">
                <input name="first_name" placeholder="First Name" required>
                <input name="last_name" placeholder="Last Name" required>
                <input name="email" type="email" placeholder="Email" required>
                <input name="password" type="password" placeholder="Password" required>
                <input name="contact" placeholder="Contact Number">
                <select name="gender">
                    <option value="">Select Gender</option>
                    <option>Male</option><option>Female</option><option>Other</option>
                </select>
                <input name="qualification" placeholder="Qualification">
                <select name="role">
                    <option value="">Select Role</option>
                    <option>Student</option><option>Faculty</option><option>Researcher</option>
                </select>
                <input name="state" placeholder="State">
                <input name="city" placeholder="City">
                <button type="submit" class="btn-primary">Register</button>
            </form>
            <div class="switch-link">Already have an account? <a onclick="showLogin()">Login</a></div>
        </div>
    </div>

    <script>
    function showLogin() {
        document.getElementById("loginModal").style.display = "flex";
        document.getElementById("registerModal").style.display = "none";
    }
    function showRegister() {
        document.getElementById("registerModal").style.display = "flex";
        document.getElementById("loginModal").style.display = "none";
    }
    function closeModals() {
        document.getElementById("loginModal").style.display = "none";
        document.getElementById("registerModal").style.display = "none";
    }
    window.onclick = function(e) { if (e.target.classList.contains("modal")) closeModals(); }
    </script>`;
}

function sharedFooter() {
    return `
    <footer>
        <div>© 2026 Assignment 12 — Node.js + MySQL Web Application</div>
        <div style="margin-top:6px;">Made by <strong>Nikhil Kumar</strong>, 24U022005</div>
    </footer>`;
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
    const user = req.session.user;
    res.send(`<!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Assignment 12</title>
    ${sharedStyles()}
    <style>
    .hero {
        background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460);
        color: white; padding: 80px 24px; text-align: center;
    }
    .hero h1 { font-size: clamp(1.8rem, 5vw, 3rem); margin-bottom: 14px; }
    .hero p { font-size: 1.1rem; color: rgba(255,255,255,0.7); max-width: 600px; margin: 0 auto 28px; }
    .hero .cta {
        display: inline-block; background: #007BFF; color: white;
        padding: 12px 30px; border-radius: 6px; text-decoration: none;
        font-weight: bold; cursor: pointer; border: none; font-size: 15px;
    }
    .hero .cta:hover { background: #0056b3; }
    .container { max-width: 960px; margin: 0 auto; padding: 40px 24px; flex: 1; }
    .welcome-box {
        background: white; border-radius: 12px; padding: 32px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.08); margin-bottom: 32px;
    }
    .welcome-box h2 { color: #333; margin-bottom: 10px; }
    .welcome-box p { color: #666; line-height: 1.6; }
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 20px; }
    .info-card {
        background: #f8f9ff; border: 1px solid #e0e7ff;
        border-radius: 10px; padding: 20px; text-align: center;
    }
    .info-card .icon { font-size: 2rem; margin-bottom: 8px; }
    .info-card h4 { color: #333; font-size: 14px; }
    .info-card p { color: #666; font-size: 13px; margin-top: 4px; }
    @media(max-width:600px){ .hero { padding: 50px 16px; } }
    </style>
    </head>
    <body>
    ${sharedNav(user, 'home')}

    <div class="hero">
        <h1>Assignment 12</h1>
        <p>A Node.js + MySQL web app with user authentication, session handling, and a full My Account management page.</p>
        ${user
            ? `<a href="/account" class="cta">My Account →</a>`
            : `<button class="cta" onclick="showRegister()">Get Started →</button>`}
    </div>

    <div class="container">
        <div class="welcome-box">
            <h2>${user ? `Hello, ${user.first_name} ${user.last_name}! 👋` : 'Welcome to Assignment 12'}</h2>
            <p>${user
                ? `You are logged in as <strong>${user.email}</strong> (${user.role}). Your account was registered from ${user.city}, ${user.state}. Visit <a href="/account" style="color:#007BFF">My Account</a> to view or update your details.`
                : 'This project demonstrates a complete Node.js web application with Express, MySQL database integration, user authentication with sessions, profile management, and a responsive frontend.'}</p>
            <div class="info-grid">
                <div class="info-card"><div class="icon">⚡</div><h4>Node.js + Express</h4><p>Backend server</p></div>
                <div class="info-card"><div class="icon">🗄️</div><h4>MySQL Database</h4><p>User data storage</p></div>
                <div class="info-card"><div class="icon">🔐</div><h4>Session Auth</h4><p>Login & logout</p></div>
                <div class="info-card"><div class="icon">👤</div><h4>My Account</h4><p>View & edit profile</p></div>
            </div>
        </div>
    </div>

    ${sharedModals()}
    ${sharedFooter()}
    </body></html>`);
});

// ─── MY ACCOUNT ───────────────────────────────────────────────────────────────
app.get("/account", requireLogin, (req, res) => {
    const user = req.session.user;
    const genderOptions = ["Male", "Female", "Other"];
    const roleOptions   = ["Student", "Faculty", "Researcher"];

    function option(val, current) {
        return `<option value="${val}" ${current && current.toLowerCase() === val.toLowerCase() ? 'selected' : ''}>${val}</option>`;
    }

    res.send(`<!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Account — Assignment 12</title>
    ${sharedStyles()}
    <style>
    .page-header {
        background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460);
        color: white; padding: 48px 24px; text-align: center;
    }
    .page-header h1 { font-size: clamp(1.6rem, 4vw, 2.4rem); margin-bottom: 8px; }
    .page-header p { color: rgba(255,255,255,0.65); font-size: 1rem; }

    .account-container { max-width: 860px; margin: 0 auto; padding: 36px 24px; flex: 1; }

    /* Profile summary card */
    .profile-summary {
        background: white; border-radius: 14px;
        box-shadow: 0 2px 14px rgba(0,0,0,0.08);
        padding: 28px; margin-bottom: 28px;
        display: flex; align-items: center; gap: 24px; flex-wrap: wrap;
    }
    .avatar {
        width: 72px; height: 72px; border-radius: 50%;
        background: linear-gradient(135deg, #007BFF, #0056b3);
        color: white; font-size: 2rem; font-weight: bold;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
    }
    .profile-info h2 { color: #222; font-size: 1.3rem; }
    .profile-info p { color: #666; font-size: 0.9rem; margin-top: 4px; }
    .profile-badge {
        display: inline-block; background: #e8f0fe; color: #1a73e8;
        padding: 3px 10px; border-radius: 20px; font-size: 12px;
        font-weight: bold; margin-top: 6px;
    }

    /* Tabs */
    .tabs { display: flex; gap: 0; border-bottom: 2px solid #e0e0e0; margin-bottom: 28px; }
    .tab-btn {
        background: none; border: none; padding: 12px 24px; font-size: 15px;
        cursor: pointer; color: #666; position: relative; transition: color 0.2s;
    }
    .tab-btn.active { color: #007BFF; font-weight: bold; }
    .tab-btn.active::after {
        content: ''; position: absolute; bottom: -2px; left: 0; right: 0;
        height: 2px; background: #007BFF;
    }
    .tab-btn:hover { color: #333; }

    .tab-panel { display: none; }
    .tab-panel.active { display: block; }

    /* Section cards */
    .section-card {
        background: white; border-radius: 14px;
        box-shadow: 0 2px 14px rgba(0,0,0,0.08); padding: 32px;
    }
    .section-card h3 { color: #333; margin-bottom: 22px; font-size: 1.1rem; border-bottom: 1px solid #f0f0f0; padding-bottom: 12px; }

    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group.full-width { grid-column: 1 / -1; }
    .form-group label { font-size: 13px; color: #555; font-weight: 600; }
    .form-group input, .form-group select {
        padding: 11px 14px; font-size: 14px; border: 1px solid #ddd;
        border-radius: 8px; outline: none; transition: border 0.2s;
    }
    .form-group input:focus, .form-group select:focus { border-color: #007BFF; box-shadow: 0 0 0 3px rgba(0,123,255,0.1); }
    .form-group input[readonly] { background: #f8f9fa; color: #888; cursor: not-allowed; }

    .form-actions { display: flex; justify-content: flex-end; margin-top: 22px; gap: 12px; }

    /* Detail view (read-only grid) */
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .detail-item { background: #f8f9fa; border-radius: 10px; padding: 16px; }
    .detail-item .label { font-size: 12px; color: #888; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .detail-item .value { font-size: 15px; color: #222; margin-top: 4px; font-weight: 500; }

    /* Password strength */
    .strength-bar { height: 4px; border-radius: 2px; margin-top: 6px; transition: all 0.3s; background: #e0e0e0; }
    .strength-label { font-size: 12px; margin-top: 4px; color: #888; }

    .alert { padding: 12px 16px; border-radius: 8px; font-size: 14px; margin-bottom: 16px; }
    .alert-info { background: #e8f4fd; color: #1a73e8; border: 1px solid #b3d7f7; }

    @media(max-width: 600px) {
        .form-grid, .detail-grid { grid-template-columns: 1fr; }
        .form-group.full-width { grid-column: 1; }
        .tabs { overflow-x: auto; }
        .tab-btn { padding: 10px 16px; font-size: 14px; white-space: nowrap; }
        .profile-summary { flex-direction: column; text-align: center; }
    }
    </style>
    </head>
    <body>
    ${sharedNav(user, 'account')}

    <div class="page-header">
        <h1>My Account</h1>
        <p>View and manage your profile details</p>
    </div>

    <div class="account-container">

        <!-- Profile Summary -->
        <div class="profile-summary">
            <div class="avatar">${user.first_name.charAt(0).toUpperCase()}</div>
            <div class="profile-info">
                <h2>${user.first_name} ${user.last_name}</h2>
                <p>${user.email}</p>
                <span class="profile-badge">${user.role || 'User'}</span>
            </div>
        </div>

        <!-- Tabs -->
        <div class="tabs">
            <button class="tab-btn active" onclick="switchTab('details', this)">📋 My Details</button>
            <button class="tab-btn" onclick="switchTab('edit', this)">✏️ Edit Profile</button>
            <button class="tab-btn" onclick="switchTab('password', this)">🔒 Change Password</button>
        </div>

        <!-- TAB: Details (read-only view) -->
        <div id="tab-details" class="tab-panel active">
            <div class="section-card">
                <h3>Account Information</h3>
                <div class="detail-grid">
                    <div class="detail-item"><div class="label">First Name</div><div class="value">${user.first_name || '—'}</div></div>
                    <div class="detail-item"><div class="label">Last Name</div><div class="value">${user.last_name || '—'}</div></div>
                    <div class="detail-item"><div class="label">Email</div><div class="value">${user.email || '—'}</div></div>
                    <div class="detail-item"><div class="label">Contact</div><div class="value">${user.contact || '—'}</div></div>
                    <div class="detail-item"><div class="label">Gender</div><div class="value">${user.gender || '—'}</div></div>
                    <div class="detail-item"><div class="label">Qualification</div><div class="value">${user.qualification || '—'}</div></div>
                    <div class="detail-item"><div class="label">Role</div><div class="value">${user.role || '—'}</div></div>
                    <div class="detail-item"><div class="label">State</div><div class="value">${user.state || '—'}</div></div>
                    <div class="detail-item"><div class="label">City</div><div class="value">${user.city || '—'}</div></div>
                    <div class="detail-item"><div class="label">Member Since</div><div class="value">${user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'}) : '—'}</div></div>
                </div>
            </div>
        </div>

        <!-- TAB: Edit Profile -->
        <div id="tab-edit" class="tab-panel">
            <div class="section-card">
                <h3>Edit Profile</h3>
                <div class="alert alert-info">ℹ️ Your email address cannot be changed.</div>
                <form method="POST" action="/account/update">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>First Name</label>
                            <input name="first_name" value="${user.first_name || ''}" required>
                        </div>
                        <div class="form-group">
                            <label>Last Name</label>
                            <input name="last_name" value="${user.last_name || ''}" required>
                        </div>
                        <div class="form-group full-width">
                            <label>Email (read-only)</label>
                            <input value="${user.email}" readonly>
                        </div>
                        <div class="form-group">
                            <label>Contact Number</label>
                            <input name="contact" value="${user.contact || ''}">
                        </div>
                        <div class="form-group">
                            <label>Gender</label>
                            <select name="gender">
                                <option value="">Select Gender</option>
                                ${genderOptions.map(g => option(g, user.gender)).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Qualification</label>
                            <input name="qualification" value="${user.qualification || ''}">
                        </div>
                        <div class="form-group">
                            <label>Role</label>
                            <select name="role">
                                <option value="">Select Role</option>
                                ${roleOptions.map(r => option(r, user.role)).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>State</label>
                            <input name="state" value="${user.state || ''}">
                        </div>
                        <div class="form-group">
                            <label>City</label>
                            <input name="city" value="${user.city || ''}">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">💾 Save Changes</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- TAB: Change Password -->
        <div id="tab-password" class="tab-panel">
            <div class="section-card">
                <h3>Change Password</h3>
                <form method="POST" action="/account/password" style="max-width: 420px;">
                    <div class="form-group">
                        <label>Current Password</label>
                        <input name="current_password" type="password" placeholder="Enter current password" required>
                    </div>
                    <div class="form-group">
                        <label>New Password</label>
                        <input name="new_password" id="newPass" type="password" placeholder="At least 4 characters" required oninput="checkStrength(this.value)">
                        <div class="strength-bar" id="strengthBar"></div>
                        <div class="strength-label" id="strengthLabel"></div>
                    </div>
                    <div class="form-group">
                        <label>Confirm New Password</label>
                        <input name="confirm_password" id="confirmPass" type="password" placeholder="Repeat new password" required oninput="checkMatch()">
                        <div class="strength-label" id="matchLabel"></div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">🔒 Update Password</button>
                    </div>
                </form>
            </div>
        </div>

    </div>

    ${sharedFooter()}

    <script>
    function switchTab(name, btn) {
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('tab-' + name).classList.add('active');
        btn.classList.add('active');
    }

    function checkStrength(val) {
        const bar = document.getElementById('strengthBar');
        const lbl = document.getElementById('strengthLabel');
        if (!val) { bar.style.width = '0'; lbl.textContent = ''; return; }
        let score = 0;
        if (val.length >= 4)  score++;
        if (val.length >= 8)  score++;
        if (/[A-Z]/.test(val)) score++;
        if (/[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;
        const levels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
        const colors = ['', '#dc3545', '#fd7e14', '#ffc107', '#28a745', '#198754'];
        const widths = ['0%', '20%', '40%', '60%', '80%', '100%'];
        bar.style.width   = widths[score];
        bar.style.background = colors[score];
        lbl.textContent   = levels[score];
        lbl.style.color   = colors[score];
    }

    function checkMatch() {
        const np = document.getElementById('newPass').value;
        const cp = document.getElementById('confirmPass').value;
        const lbl = document.getElementById('matchLabel');
        if (!cp) { lbl.textContent = ''; return; }
        if (np === cp) { lbl.textContent = '✅ Passwords match'; lbl.style.color = '#28a745'; }
        else           { lbl.textContent = '❌ Passwords do not match'; lbl.style.color = '#dc3545'; }
    }
    </script>
    </body></html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));