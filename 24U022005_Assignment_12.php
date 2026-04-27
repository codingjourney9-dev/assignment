<?php
session_start();

// ==========================================
// 1. DATABASE CONNECTION & SETUP
// ==========================================
// Check for Railway environment variables, fallback to XAMPP defaults
$host = getenv("MYSQLHOST") ?: "localhost";
$user = getenv("MYSQLUSER") ?: "root";
$pass = getenv("MYSQLPASSWORD") ?: "";
$dbname = getenv("MYSQLDATABASE") ?: "assignment12";
$port = getenv("MYSQLPORT") ?: 3306;

// Connect to MySQL
$conn = @new mysqli($host, $user, $pass, $dbname, $port);

// If database doesn't exist (e.g., first time running locally on XAMPP)
if ($conn->connect_error) {
    $conn = new mysqli($host, $user, $pass, "", $port);
    $conn->query("CREATE DATABASE IF NOT EXISTS `$dbname`");
    $conn->select_db($dbname);
}

// Create Table if not exists
$tableQuery = "CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    contact VARCHAR(15),
    gender VARCHAR(10),
    qualification VARCHAR(100),
    role VARCHAR(20),
    state VARCHAR(50),
    city VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)";
$conn->query($tableQuery);

// Helper function to set Toast Messages
function set_message($type, $msg) {
    $_SESSION['msg_type'] = $type; // 'success' or 'error'
    $_SESSION['message'] = $msg;
}

// ==========================================
// 2. FORM HANDLING (ROUTING)
// ==========================================
if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $action = $_POST['action'] ?? '';

    // --- REGISTER ---
    if ($action == 'register') {
        $fname = $_POST['first_name'];
        $lname = $_POST['last_name'];
        $email = $_POST['email'];
        $password = password_hash($_POST['password'], PASSWORD_DEFAULT); // Secure hashing
        $contact = $_POST['contact'];
        $gender = $_POST['gender'];
        $qual = $_POST['qualification'];
        $role = $_POST['role'];
        $state = $_POST['state'];
        $city = $_POST['city'];

        $stmt = $conn->prepare("INSERT INTO users (first_name, last_name, email, password, contact, gender, qualification, role, state, city) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("ssssssssss", $fname, $lname, $email, $password, $contact, $gender, $qual, $role, $state, $city);
        
        if ($stmt->execute()) {
            set_message("success", "Registration successful! Please login.");
        } else {
            set_message("error", "Email already exists or registration failed.");
        }
        header("Location: " . $_SERVER['PHP_SELF']);
        exit();
    }

    // --- LOGIN ---
    if ($action == 'login') {
        $email = $_POST['email'];
        $password = $_POST['password'];

        $stmt = $conn->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows > 0) {
            $user = $result->fetch_assoc();
            if (password_verify($password, $user['password'])) {
                $_SESSION['user'] = $user;
                set_message("success", "Welcome back, " . $user['first_name'] . "!");
            } else {
                set_message("error", "Incorrect password.");
            }
        } else {
            set_message("error", "User not found.");
        }
        header("Location: " . $_SERVER['PHP_SELF']);
        exit();
    }

    // --- UPDATE PROFILE ---
    if ($action == 'update_profile' && isset($_SESSION['user'])) {
        $id = $_SESSION['user']['id'];
        $fname = $_POST['first_name'];
        $lname = $_POST['last_name'];
        $contact = $_POST['contact'];
        $gender = $_POST['gender'];
        $qual = $_POST['qualification'];
        $role = $_POST['role'];
        $state = $_POST['state'];
        $city = $_POST['city'];

        $stmt = $conn->prepare("UPDATE users SET first_name=?, last_name=?, contact=?, gender=?, qualification=?, role=?, state=?, city=? WHERE id=?");
        $stmt->bind_param("ssssssssi", $fname, $lname, $contact, $gender, $qual, $role, $state, $city, $id);
        
        if ($stmt->execute()) {
            // Refresh session data
            $res = $conn->query("SELECT * FROM users WHERE id=$id");
            $_SESSION['user'] = $res->fetch_assoc();
            set_message("success", "Profile updated successfully.");
        } else {
            set_message("error", "Failed to update profile.");
        }
        header("Location: ?page=account");
        exit();
    }

    // --- UPDATE PASSWORD ---
    if ($action == 'update_password' && isset($_SESSION['user'])) {
        $id = $_SESSION['user']['id'];
        $curr_pass = $_POST['current_password'];
        $new_pass = $_POST['new_password'];
        $conf_pass = $_POST['confirm_password'];

        $res = $conn->query("SELECT password FROM users WHERE id=$id");
        $db_pass = $res->fetch_assoc()['password'];

        if (!password_verify($curr_pass, $db_pass)) {
            set_message("error", "Current password is incorrect.");
        } elseif strlen($new_pass) < 4 {
            set_message("error", "New password must be at least 4 characters.");
        } elseif ($new_pass !== $conf_pass) {
            set_message("error", "New passwords do not match.");
        } else {
            $hashed = password_hash($new_pass, PASSWORD_DEFAULT);
            $conn->query("UPDATE users SET password='$hashed' WHERE id=$id");
            set_message("success", "Password changed successfully.");
        }
        header("Location: ?page=account");
        exit();
    }
}

// --- LOGOUT ---
if (isset($_GET['action']) && $_GET['action'] == 'logout') {
    session_destroy();
    session_start();
    set_message("success", "You have been logged out.");
    header("Location: " . $_SERVER['PHP_SELF']);
    exit();
}

$page = $_GET['page'] ?? 'home';
$isLoggedIn = isset($_SESSION['user']);
$user = $isLoggedIn ? $_SESSION['user'] : null;

// Require login for account page
if ($page == 'account' && !$isLoggedIn) {
    set_message("error", "Please login to access your account.");
    header("Location: " . $_SERVER['PHP_SELF']);
    exit();
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Assignment 12 - My Account App</title>
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- FontAwesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body { background-color: #f3f4f6; display: flex; flex-direction: column; min-height: 100vh; }
        .tab-content { display: none; }
        .tab-content.active { display: block; animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        /* Custom Scrollbar */
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #f1f1f1; }
        ::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
    </style>
</head>
<body class="text-gray-800 font-sans">

    <!-- Toast Notification System -->
    <?php if (isset($_SESSION['message'])): ?>
        <div id="toast" class="fixed top-20 right-5 z-50 px-6 py-4 rounded shadow-lg text-white font-semibold transition-opacity duration-500 <?php echo $_SESSION['msg_type'] == 'success' ? 'bg-green-500' : 'bg-red-500'; ?>">
            <i class="fa-solid <?php echo $_SESSION['msg_type'] == 'success' ? 'fa-check-circle' : 'fa-triangle-exclamation'; ?> mr-2"></i>
            <?php echo $_SESSION['message']; ?>
        </div>
        <script>
            setTimeout(() => { document.getElementById('toast').style.opacity = '0'; setTimeout(() => document.getElementById('toast').remove(), 500); }, 3000);
        </script>
        <?php unset($_SESSION['message']); unset($_SESSION['msg_type']); ?>
    <?php endif; ?>

    <!-- NAVBAR -->
    <nav class="bg-gray-900 text-white shadow-lg sticky top-0 z-40">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16">
                <div class="flex items-center">
                    <a href="?" class="text-xl font-bold tracking-wider flex items-center gap-2">
                        <i class="fa-solid fa-graduation-cap text-blue-400"></i> Assignment 12
                    </a>
                </div>
                <div class="flex items-center space-x-4">
                    <?php if ($isLoggedIn): ?>
                        <span class="hidden sm:block text-gray-300">Welcome, <span class="font-bold text-white"><?php echo htmlspecialchars($user['first_name']); ?></span></span>
                        <a href="?page=account" class="px-3 py-2 rounded-md text-sm font-medium <?php echo $page == 'account' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'; ?>">
                            <i class="fa-solid fa-user-circle"></i> My Account
                        </a>
                        <a href="?action=logout" class="px-3 py-2 rounded-md text-sm font-medium text-red-400 hover:bg-gray-700 hover:text-red-300">
                            <i class="fa-solid fa-right-from-bracket"></i> Logout
                        </a>
                    <?php else: ?>
                        <button onclick="document.getElementById('loginModal').classList.remove('hidden')" class="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition">Login</button>
                        <button onclick="document.getElementById('registerModal').classList.remove('hidden')" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium transition shadow">Register</button>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </nav>

    <!-- MAIN CONTENT AREA -->
    <main class="flex-grow flex flex-col">
        
        <?php if ($page == 'home'): ?>
        <!-- HOME PAGE -->
        <div class="bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900 text-white py-20 flex-grow flex items-center">
            <div class="max-w-4xl mx-auto text-center px-4">
                <h1 class="text-4xl md:text-6xl font-extrabold mb-6">Student Information Portal</h1>
                <p class="text-lg md:text-xl text-gray-300 mb-10 max-w-2xl mx-auto">A fully functional web application built with PHP and MySQL featuring user authentication, role management, and profile customization.</p>
                
                <?php if ($isLoggedIn): ?>
                    <a href="?page=account" class="inline-block bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition hover:scale-105">Go to My Account <i class="fa-solid fa-arrow-right ml-2"></i></a>
                <?php else: ?>
                    <button onclick="document.getElementById('registerModal').classList.remove('hidden')" class="inline-block bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition hover:scale-105">Get Started <i class="fa-solid fa-user-plus ml-2"></i></button>
                <?php endif; ?>
            </div>
        </div>

        <?php elseif ($page == 'account'): ?>
        <!-- MY ACCOUNT PAGE -->
        <div class="max-w-6xl mx-auto px-4 py-8 w-full flex-grow">
            <div class="flex flex-col md:flex-row gap-8">
                
                <!-- Sidebar / Profile Summary -->
                <div class="w-full md:w-1/3 lg:w-1/4">
                    <div class="bg-white rounded-xl shadow-md p-6 text-center border-t-4 border-blue-500">
                        <div class="w-24 h-24 mx-auto bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-4xl font-bold mb-4 shadow-inner">
                            <?php echo strtoupper(substr($user['first_name'], 0, 1)); ?>
                        </div>
                        <h2 class="text-xl font-bold text-gray-800"><?php echo htmlspecialchars($user['first_name'] . ' ' . $user['last_name']); ?></h2>
                        <p class="text-gray-500 text-sm mb-4"><?php echo htmlspecialchars($user['email']); ?></p>
                        <span class="inline-block bg-gray-100 text-gray-800 text-xs px-3 py-1 rounded-full font-semibold uppercase tracking-wide border border-gray-200">
                            <?php echo htmlspecialchars($user['role'] ? $user['role'] : 'User'); ?>
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
                            <?php 
                            $fields = [
                                'First Name' => $user['first_name'], 'Last Name' => $user['last_name'],
                                'Email Address' => $user['email'], 'Contact Number' => $user['contact'],
                                'Gender' => $user['gender'], 'Education/Qualification' => $user['qualification'],
                                'Role' => $user['role'], 'State' => $user['state'], 'City' => $user['city']
                            ];
                            foreach($fields as $label => $val): ?>
                                <div class="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                    <p class="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1"><?php echo $label; ?></p>
                                    <p class="text-gray-800 font-medium text-lg"><?php echo empty($val) ? '<span class="text-gray-400 italic">Not provided</span>' : htmlspecialchars($val); ?></p>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    </div>

                    <!-- Edit Profile Tab -->
                    <div id="tab-edit" class="tab-content bg-white rounded-xl shadow-md p-6 lg:p-8">
                        <h3 class="text-2xl font-bold text-gray-800 border-b pb-4 mb-6"><i class="fa-solid fa-user-pen text-blue-500 mr-2"></i> Edit Profile</h3>
                        <div class="bg-blue-50 text-blue-700 p-4 rounded-lg mb-6 text-sm flex items-start gap-3">
                            <i class="fa-solid fa-circle-info mt-1"></i>
                            <p>Keep your profile updated. Note that your email address is used for login and cannot be changed.</p>
                        </div>
                        <form action="?" method="POST" class="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <input type="hidden" name="action" value="update_profile">
                            
                            <div><label class="block text-sm font-semibold text-gray-700 mb-1">First Name</label><input type="text" name="first_name" value="<?php echo htmlspecialchars($user['first_name']); ?>" required class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></div>
                            <div><label class="block text-sm font-semibold text-gray-700 mb-1">Last Name</label><input type="text" name="last_name" value="<?php echo htmlspecialchars($user['last_name']); ?>" required class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></div>
                            
                            <div class="md:col-span-2"><label class="block text-sm font-semibold text-gray-700 mb-1">Email Address (Read-only)</label><input type="email" value="<?php echo htmlspecialchars($user['email']); ?>" readonly class="w-full px-4 py-2 border bg-gray-100 text-gray-500 rounded-lg cursor-not-allowed"></div>
                            
                            <div><label class="block text-sm font-semibold text-gray-700 mb-1">Contact Number</label><input type="text" name="contact" value="<?php echo htmlspecialchars($user['contact']); ?>" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></div>
                            <div><label class="block text-sm font-semibold text-gray-700 mb-1">Gender</label>
                                <select name="gender" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                    <option value="">Select Gender</option>
                                    <option value="Male" <?php if($user['gender']=='Male') echo 'selected';?>>Male</option>
                                    <option value="Female" <?php if($user['gender']=='Female') echo 'selected';?>>Female</option>
                                    <option value="Other" <?php if($user['gender']=='Other') echo 'selected';?>>Other</option>
                                </select>
                            </div>
                            
                            <div><label class="block text-sm font-semibold text-gray-700 mb-1">Qualification</label><input type="text" name="qualification" value="<?php echo htmlspecialchars($user['qualification']); ?>" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></div>
                            <div><label class="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                                <select name="role" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                    <option value="">Select Role</option>
                                    <option value="Student" <?php if($user['role']=='Student') echo 'selected';?>>Student</option>
                                    <option value="Faculty" <?php if($user['role']=='Faculty') echo 'selected';?>>Faculty</option>
                                </select>
                            </div>

                            <div><label class="block text-sm font-semibold text-gray-700 mb-1">State</label><input type="text" name="state" value="<?php echo htmlspecialchars($user['state']); ?>" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></div>
                            <div><label class="block text-sm font-semibold text-gray-700 mb-1">City</label><input type="text" name="city" value="<?php echo htmlspecialchars($user['city']); ?>" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></div>
                            
                            <div class="md:col-span-2 pt-4 border-t mt-2 flex justify-end">
                                <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow transition">Save Changes</button>
                            </div>
                        </form>
                    </div>

                    <!-- Change Password Tab -->
                    <div id="tab-password" class="tab-content bg-white rounded-xl shadow-md p-6 lg:p-8">
                        <h3 class="text-2xl font-bold text-gray-800 border-b pb-4 mb-6"><i class="fa-solid fa-shield-halved text-blue-500 mr-2"></i> Change Password</h3>
                        <form action="?" method="POST" class="max-w-md space-y-5">
                            <input type="hidden" name="action" value="update_password">
                            
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1">Current Password</label>
                                <input type="password" name="current_password" required class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                            </div>
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
                                <button type="submit" id="pwd_btn" class="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-6 rounded-lg shadow transition w-full">Update Password</button>
                            </div>
                        </form>
                    </div>

                </div>
            </div>
        </div>

        <script>
            // Tabs logic
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

            // Password match logic
            function checkPass() {
                const p1 = document.getElementById('new_password').value;
                const p2 = document.getElementById('confirm_password').value;
                const msg = document.getElementById('pass_match_msg');
                if(p2 === '') { msg.innerText = ''; return; }
                if(p1 === p2) { msg.innerText = 'Passwords match ✓'; msg.className = 'text-xs mt-1 font-semibold text-green-600'; } 
                else { msg.innerText = 'Passwords do not match ✗'; msg.className = 'text-xs mt-1 font-semibold text-red-600'; }
            }
        </script>
        <?php endif; ?>

    </main>

    <!-- FOOTER -->
    <footer class="bg-gray-900 text-gray-400 py-6 text-center text-sm border-t border-gray-800 mt-auto">
        <p>&copy; 2026 Assignment 12 - Web App Portal</p>
        <p class="mt-1">Developed by <span class="text-white font-semibold">Nikhil Kumar</span> | Scholar No: 24U022005</p>
    </footer>

    <!-- MODALS -->
    <!-- Login Modal -->
    <div id="loginModal" class="fixed inset-0 bg-black bg-opacity-60 hidden flex justify-center items-center z-50 px-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all relative">
            <button onclick="document.getElementById('loginModal').classList.add('hidden')" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 text-xl"><i class="fa-solid fa-xmark"></i></button>
            <div class="bg-gray-50 border-b p-6 text-center">
                <h2 class="text-2xl font-bold text-gray-800">Welcome Back</h2>
                <p class="text-sm text-gray-500 mt-1">Please enter your credentials to login</p>
            </div>
            <form action="?" method="POST" class="p-6 space-y-4">
                <input type="hidden" name="action" value="login">
                <div><label class="block text-sm font-semibold text-gray-700 mb-1">Email</label><input type="email" name="email" required class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></div>
                <div><label class="block text-sm font-semibold text-gray-700 mb-1">Password</label><input type="password" name="password" required class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></div>
                <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition mt-2">Login</button>
                <p class="text-center text-sm text-gray-600 mt-4">Don't have an account? <a href="#" onclick="document.getElementById('loginModal').classList.add('hidden'); document.getElementById('registerModal').classList.remove('hidden')" class="text-blue-600 hover:underline">Register</a></p>
            </form>
        </div>
    </div>

    <!-- Register Modal -->
    <div id="registerModal" class="fixed inset-0 bg-black bg-opacity-60 hidden flex justify-center items-center z-50 px-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all relative max-h-[90vh] overflow-y-auto">
            <button onclick="document.getElementById('registerModal').classList.add('hidden')" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 text-xl"><i class="fa-solid fa-xmark"></i></button>
            <div class="bg-gray-50 border-b p-6 text-center">
                <h2 class="text-2xl font-bold text-gray-800">Create an Account</h2>
                <p class="text-sm text-gray-500 mt-1">Fill in your details to register</p>
            </div>
            <form action="?" method="POST" class="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="hidden" name="action" value="register">
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

</body>
</html>