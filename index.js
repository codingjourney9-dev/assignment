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
    database: process.env.MYSQLDATABASE || "assignment10",
    port:     process.env.MYSQLPORT     || 3306
});

db.connect(err => {
    if (err) {
        console.error("MySQL connection error:", err);
    } else {
        console.log("MySQL Connected");

        // Create users table if it doesn't exist, then seed data
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
                // Insert seed user if not exists
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

// REGISTER
app.post("/register", (req, res) => {
    const { first_name, last_name, email, password, contact, gender, qualification, role, state, city } = req.body;

    const sql = `INSERT INTO users (first_name,last_name,email,password,contact,gender,qualification,role,state,city)
                 VALUES (?,?,?,?,?,?,?,?,?,?)`;

    db.query(sql, [first_name, last_name, email, password, contact, gender, qualification, role, state, city], (err) => {
        if (err) {
            console.log(err);
            return res.send(`<script>alert("Email already registered or error occurred."); window.location="/";</script>`);
        }
        // Auto login after register
        db.query("SELECT * FROM users WHERE email = ?", [email], (err, result) => {
            if (!err && result.length > 0) req.session.user = result[0];
            res.redirect("/");
        });
    });
});

// LOGIN
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

// LOGOUT
app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

// HOME
app.get("/", (req, res) => {
    const user = req.session.user;

    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Assignment 10</title>
    <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
        font-family: Arial, sans-serif;
        background: #f4f6f9;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
    }

    nav {
        background: #333;
        color: white;
        padding: 15px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        position: sticky;
        top: 0;
        z-index: 100;
    }

    nav .brand { font-size: 18px; font-weight: bold; }

    nav .nav-btns { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

    nav button {
        background: #007BFF;
        color: white;
        border: none;
        padding: 8px 18px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
    }
    nav button:hover { background: #0056b3; }

    nav a { color: #ccc; text-decoration: none; font-size: 14px; }
    nav a:hover { color: white; }

    .hero {
        background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460);
        color: white;
        padding: 80px 24px;
        text-align: center;
    }
    .hero h1 { font-size: clamp(1.8rem, 5vw, 3rem); margin-bottom: 14px; }
    .hero p { font-size: 1.1rem; color: rgba(255,255,255,0.7); max-width: 600px; margin: 0 auto 28px; }
    .hero .cta {
        display: inline-block;
        background: #007BFF;
        color: white;
        padding: 12px 30px;
        border-radius: 6px;
        text-decoration: none;
        font-weight: bold;
        cursor: pointer;
        border: none;
        font-size: 15px;
    }
    .hero .cta:hover { background: #0056b3; }

    .container { max-width: 960px; margin: 0 auto; padding: 40px 24px; flex: 1; }

    .welcome-box {
        background: white;
        border-radius: 12px;
        padding: 32px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.08);
        margin-bottom: 32px;
    }
    .welcome-box h2 { color: #333; margin-bottom: 10px; }
    .welcome-box p { color: #666; line-height: 1.6; }

    .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin-top: 20px;
    }
    .info-card {
        background: #f8f9ff;
        border: 1px solid #e0e7ff;
        border-radius: 10px;
        padding: 20px;
        text-align: center;
    }
    .info-card .icon { font-size: 2rem; margin-bottom: 8px; }
    .info-card h4 { color: #333; font-size: 14px; }
    .info-card p { color: #666; font-size: 13px; margin-top: 4px; }

    /* MODAL */
    .modal {
        display: none;
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(0,0,0,0.5);
        justify-content: center;
        align-items: center;
        z-index: 999;
    }
    .modal-content {
        background: white;
        padding: 32px 28px;
        width: 90%;
        max-width: 420px;
        border-radius: 12px;
        position: relative;
        max-height: 90vh;
        overflow-y: auto;
    }
    .modal-content h2 { margin-bottom: 20px; color: #333; }
    .close-btn {
        position: absolute; top: 14px; right: 18px;
        font-size: 22px; cursor: pointer; color: #999;
        background: none; border: none;
    }
    form { display: flex; flex-direction: column; gap: 12px; }
    input, select {
        padding: 11px 14px;
        font-size: 15px;
        border: 1px solid #ddd;
        border-radius: 7px;
        outline: none;
        transition: border 0.2s;
    }
    input:focus, select:focus { border-color: #007BFF; }
    form button {
        background: #007BFF;
        color: white;
        border: none;
        padding: 13px;
        border-radius: 7px;
        cursor: pointer;
        font-size: 15px;
        font-weight: bold;
        margin-top: 4px;
    }
    form button:hover { background: #0056b3; }
    .switch-link { text-align: center; font-size: 13px; color: #666; margin-top: 8px; }
    .switch-link a { color: #007BFF; cursor: pointer; text-decoration: none; }

    footer {
        background: #222;
        color: rgba(255,255,255,0.5);
        text-align: center;
        padding: 20px;
        font-size: 13px;
    }
    footer strong { color: #f0c040; }

    @media(max-width: 600px) {
        .hero { padding: 50px 16px; }
        .modal-content { padding: 24px 18px; }
    }
    </style>
    </head>
    <body>

    <!-- FIXED NAV -->
    <nav>
        <div class="brand">📘 Assignment 10</div>
        <div class="nav-btns">
        ${user ? `
            <span style="color:#ccc;font-size:14px;">👤 Welcome, <strong style="color:white">${user.first_name}</strong></span>
            <a href="/logout">Logout</a>
        ` : `
            <button onclick="showLogin()">Login</button>
            <button onclick="showRegister()">Register</button>
        `}
        </div>
    </nav>

    <!-- HERO -->
    <div class="hero">
        <h1>Assignment 10</h1>
        <p>A Node.js + MySQL web app with user registration, login, session handling, and mobile responsiveness.</p>
        ${user ? `<span style="background:#28a745;color:white;padding:10px 24px;border-radius:6px;font-weight:bold;">✅ Logged in as ${user.first_name} ${user.last_name}</span>`
                : `<button class="cta" onclick="showRegister()">Get Started →</button>`}
    </div>

    <!-- MAIN CONTENT -->
    <div class="container">
        <div class="welcome-box">
            <h2>${user ? `Hello, ${user.first_name} ${user.last_name}! 👋` : 'Welcome to Assignment 10'}</h2>
            <p>${user ? `You are logged in as <strong>${user.email}</strong> (${user.role}). Your account was created from ${user.city}, ${user.state}.`
                      : 'This project demonstrates a complete Node.js web application with Express, MySQL database integration, user authentication with sessions, and a responsive frontend.'}</p>
            <div class="info-grid">
                <div class="info-card"><div class="icon">⚡</div><h4>Node.js + Express</h4><p>Backend server</p></div>
                <div class="info-card"><div class="icon">🗄️</div><h4>MySQL Database</h4><p>User data storage</p></div>
                <div class="info-card"><div class="icon">🔐</div><h4>Session Auth</h4><p>Login & logout</p></div>
                <div class="info-card"><div class="icon">📱</div><h4>Responsive</h4><p>Mobile friendly</p></div>
            </div>
        </div>
    </div>

    <!-- LOGIN MODAL -->
    <div id="loginModal" class="modal">
        <div class="modal-content">
            <button class="close-btn" onclick="closeModals()">×</button>
            <h2>Login</h2>
            <form method="POST" action="/login">
                <input name="email" type="email" placeholder="Email" required>
                <input name="password" type="password" placeholder="Password" required>
                <button type="submit">Login</button>
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
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                </select>
                <input name="qualification" placeholder="Qualification">
                <select name="role">
                    <option value="">Select Role</option>
                    <option>Student</option>
                    <option>Faculty</option>
                    <option>Researcher</option>
                </select>
                <input name="state" placeholder="State">
                <input name="city" placeholder="City">
                <button type="submit">Register</button>
            </form>
            <div class="switch-link">Already have an account? <a onclick="showLogin()">Login</a></div>
        </div>
    </div>

    <!-- FOOTER -->
    <footer>
        <div>© 2026 Assignment 10 — Node.js + MySQL Web Application</div>
        <div style="margin-top:6px;">Made by <strong>Nikhil Kumar</strong>, 24U022005</div>
    </footer>

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
    window.onclick = function(e) {
        if (e.target.classList.contains("modal")) closeModals();
    }
    </script>
    </body>
    </html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
