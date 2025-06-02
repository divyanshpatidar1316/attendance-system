document.addEventListener('DOMContentLoaded', () => {
// DOM Elements
const roleButtons = document.querySelectorAll('.role-btn');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

// Set active role
roleButtons.forEach(button => {
    button.addEventListener('click', () => {
        roleButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
    });
});

// Login Form Handler
// Login Form Handler
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const role = document.querySelector('.role-btn.active').dataset.role;
        
        try {
            const response = await fetch('https://attendance-system-tlj2.onrender.com/api/auth/login', {
                method: 'POST',
                mode: 'cors', // Explicitly set CORS mode
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ email, password, role })
            });
            
            // Handle response
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Invalid response from server');
            }
            
            const data = await response.json();
            
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Login failed');
            }
            
            // Store token and user data
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Redirect based on role
            window.location.href = data.user.role === 'teacher' 
                ? 'teacher-dashboard.html' 
                : 'student-dashboard.html';
                
        } catch (error) {
            console.error('Login error:', error);
            alert(error.message || 'Login failed. Please try again.');
        }
    });
}

// Register Form Handler
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const role = document.querySelector('.role-btn.active').dataset.role;
        
        // Basic validation
        if (!name || !email || !password || !confirmPassword) {
            alert('Please fill all fields');
            return;
        }
        
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        
        try {
            const response = await fetch('http://localhost:5000/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    name, 
                    email, 
                    password, 
                    role 
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Registration failed');
            }
            
            alert('Registration successful! Please login.');
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Registration error:', error);
            alert(error.message || 'Registration failed. Please try again.');
        }
    });
}

// Logout Button
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    });
}

// Check authentication on dashboard pages
if (window.location.pathname.includes('dashboard')) {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (!token || !user) {
        window.location.href = 'login.html';
    }
    
    // Display user name on student dashboard
    if (user && user.role === 'student' && document.getElementById('studentName')) {
        document.getElementById('studentName').textContent = user.name;
    }
}
});
