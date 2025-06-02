document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const generateCodeBtn = document.getElementById('generateCodeBtn');
    const attendanceCodeDisplay = document.getElementById('attendanceCodeDisplay');
    const codeExpiryDisplay = document.getElementById('codeExpiryDisplay');
    const presentStudentsList = document.getElementById('presentStudentsList');
    const absentStudentsList = document.getElementById('absentStudentsList');
    const presentCount = document.getElementById('presentCount');
    const absentCount = document.getElementById('absentCount');
    const logoutBtn = document.getElementById('logoutBtn');
    const teacherClassSelector = document.getElementById('teacherClassSelector');
    const createClassForm = document.getElementById('createClassForm');
    const classNameInput = document.getElementById('className');
    const classCodeInput = document.getElementById('classCode');
    const API_BASE_URL = 'https://attendance-system-tlj2.onrender.com';
    
    // State variables
    let codeGenerationInterval;
    let attendanceRefreshInterval; // New interval for attendance refresh
    const CODE_VALIDITY_MINUTES = 4; // Code expires after 4 minutes

    // Initialize dashboard
    checkAuth();
    initializeDashboard();

    // Check authentication
    function checkAuth() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user'));
        
        if (!token || !user || user.role !== 'teacher') {
            window.location.href = 'login.html';
        }
    }

    // Generate attendance code
    async function generateAttendanceCode() {
        const classId = teacherClassSelector.value;
        if (!classId) {
            showAlert('Please select a class first to generate a code.', 'error');
            return null;
        }

        try {
            generateCodeBtn.disabled = true;
            generateCodeBtn.textContent = 'Generating...';
            
            // Generate new code
            const { code, expiresAt } = await generateNewCode(classId);
            
            // Update UI
            updateCodeDisplay(code, expiresAt);
            
            // Set auto-refresh for code
            setupCodeAutoRefresh(expiresAt);
            
            showAlert('Attendance code generated successfully!', 'success');
            return code;
            
        } catch (error) {
            console.error('Code generation error:', error);
            showAlert(`Error: ${error.message}`, 'error');
            return null;
        } finally {
            generateCodeBtn.disabled = false;
            generateCodeBtn.textContent = 'Generate Code';
        }
    }

    // Fetch teacher's classes with improved error handling
    async function fetchTeacherClasses() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/teacher/classes`, {
                headers: getAuthHeaders()
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch classes');
            }
            
            const data = await response.json();
            return data.data || [];
            
        } catch (error) {
            console.error('Error fetching classes:', error);
            showAlert(`Error: ${error.message}`, 'error');
            return [];
        }
    }

    // Populate class selector
    async function populateTeacherClassSelector() {
        teacherClassSelector.innerHTML = '<option value="">Loading classes...</option>';
        const classes = await fetchTeacherClasses();
        teacherClassSelector.innerHTML = ''; // Clear loading message

        if (classes.length > 0) {
            teacherClassSelector.innerHTML = '<option value="">Select a class</option>';
            classes.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls._id;
                option.textContent = cls.name;
                teacherClassSelector.appendChild(option);
            });
            teacherClassSelector.disabled = false;
            generateCodeBtn.disabled = true; // Initially disable until a class is selected

            // Select the first class by default if none is selected and refresh attendance
            if (teacherClassSelector.value === "" && classes.length > 0) {
                teacherClassSelector.value = classes[0]._id; // Select the first class
                updateAttendanceDisplay(classes[0]._id);
            } else if (teacherClassSelector.value) {
                 // If a class is already selected (e.g., after creating a new one)
                 updateAttendanceDisplay(teacherClassSelector.value);
            } else {
                 // No classes or no selection, clear attendance display
                 clearAttendanceDisplay();
            }

        } else {
            teacherClassSelector.innerHTML = '<option value="">No classes found</option>';
            teacherClassSelector.disabled = true;
            generateCodeBtn.disabled = true;
            clearAttendanceDisplay();
        }
    }

    // Generate new code API call with better error handling
    async function generateNewCode(classId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/teacher/classes/${classId}/generate-code`, {
                method: 'POST',
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to generate code');
            }

            const result = await response.json();
            if (!result.data || !result.data.code) {
                throw new Error('Invalid response from server');
            }

            return result.data;
        } catch (error) {
            console.error('Error generating code:', error);
            throw error; // Re-throw to be caught by the calling function
        }
    }

    // Update code display in UI
    function updateCodeDisplay(code, expiresAt) {
        attendanceCodeDisplay.textContent = code;
        const expiryDate = new Date(expiresAt);
        codeExpiryDisplay.textContent = `Expires at: ${expiryDate.toLocaleTimeString()}`;
    }

    // Setup auto code refresh
    function setupCodeAutoRefresh(expiresAt) {
        // Clear any existing interval
        if (codeGenerationInterval) {
            clearInterval(codeGenerationInterval);
        }
        
        // Set timeout to regenerate code 1 minute before expiration
        const expiresIn = new Date(expiresAt) - new Date() - 60000; // 1 minute before
        if (expiresIn > 0) {
            codeGenerationInterval = setTimeout(() => {
                generateAttendanceCode();
            }, expiresIn);
        }
    }

    // Fetch attendance data for a specific class
    async function fetchAttendanceData(classId) {
        if (!classId) {
            clearAttendanceDisplay();
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/api/teacher/today?classId=${classId}`, { // Pass classId
                headers: getAuthHeaders()
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch attendance data');
            }
            
            const data = await response.json();
            
            // Validate and normalize the response data
            const attendanceData = {
                present: data.data?.present || [],
                absent: data.data?.absent || []
            };
            
            updateAttendanceUI(attendanceData);
            
        } catch (error) {
            console.error('Attendance fetch error:', error);
            if (error.message.includes('Unauthorized')) {
                handleLogout();
            } else {
                // Update UI with empty data on error
                updateAttendanceUI({ present: [], absent: [] });
                showAlert('Could not load attendance data for selected class. Please try again.', 'error');
            }
        }
    }

    // Function to update attendance display based on selected class
    function updateAttendanceDisplay(classId) {
        if (attendanceRefreshInterval) {
            clearInterval(attendanceRefreshInterval); // Clear existing interval
        }
        if (classId) {
            fetchAttendanceData(classId); // Initial fetch
            attendanceRefreshInterval = setInterval(() => fetchAttendanceData(classId), 30000); // Set new interval
        } else {
            clearAttendanceDisplay();
        }
    }

    // Clear attendance display when no class is selected
    function clearAttendanceDisplay() {
        presentStudentsList.innerHTML = '<li class="empty-message">No students present yet</li>';
        absentStudentsList.innerHTML = '<li class="empty-message">No absent students</li>';
        presentCount.textContent = '0';
        absentCount.textContent = '0';
    }


    // Update attendance UI with safer data handling
    function updateAttendanceUI(attendanceData = { present: [], absent: [] }) {
        // Ensure we have arrays to work with
        const presentStudents = Array.isArray(attendanceData.present) ? attendanceData.present : [];
        const absentStudents = Array.isArray(attendanceData.absent) ? attendanceData.absent : [];
        
        // Update present students
        updateStudentList(
            presentStudentsList, 
            presentStudents,
            'No students present yet',
            (student) => `
                <li>
                    <span class="student-name">${student.name || 'Unknown'}</span>
                    <span class="student-email">${student.email || ''}</span>
                    ${student.time ? `<span class="attendance-time">${new Date(student.time).toLocaleTimeString()}</span>` : ''}
                </li>
            `
        );

        // Update absent students
        updateStudentList(
            absentStudentsList, 
            absentStudents,
            'No absent students',
            (student) => `
                <li>
                    <span class="student-name">${student.name || 'Unknown'}</span>
                    <span class="student-email">${student.email || ''}</span>
                    <span class="status-absent">Absent</span>
                </li>
            `
        );

        // Update counters
        presentCount.textContent = presentStudents.length;
        absentCount.textContent = absentStudents.length;
    }

    // Update student list UI
    function updateStudentList(listElement, students, emptyMessage, templateFn) {
        if (students.length === 0) {
            listElement.innerHTML = `<li class="empty-message">${emptyMessage}</li>`;
            return;
        }

        listElement.innerHTML = students.map(templateFn).join('');
    }

    // Get auth headers
    function getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        };
    }

    // Show alert message
    function showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert ${type}`;
        alertDiv.textContent = message;
        document.body.appendChild(alertDiv);
        setTimeout(() => alertDiv.remove(), 3000);
    }

    // Handle logout
    function handleLogout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }

    // Handle class creation
    if (createClassForm) {
        createClassForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = classNameInput.value.trim();
            const code = classCodeInput.value.trim();

            if (!name || !code) {
                showAlert('Please enter both class name and code.', 'error');
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/teacher/classes`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ name, code })
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Failed to create class.');
                }

                showAlert('Class created successfully!', 'success');
                classNameInput.value = '';
                classCodeInput.value = '';
                await populateTeacherClassSelector(); // Refresh the class list
                // Select the newly created class if it's the only one or desired
                if (data.data && data.data._id) {
                    teacherClassSelector.value = data.data._id;
                    updateAttendanceDisplay(data.data._id);
                }
            } catch (error) {
                console.error('Class creation error:', error);
                showAlert(`Error creating class: ${error.message}`, 'error');
            }
        });
    }

    // Initialize dashboard
    function initializeDashboard() {
        // Set up event listeners
        generateCodeBtn.addEventListener('click', generateAttendanceCode);
        logoutBtn.addEventListener('click', handleLogout);
        teacherClassSelector.addEventListener('change', (event) => {
            const selectedClassId = event.target.value;
            generateCodeBtn.disabled = !selectedClassId; // Disable generate button if no class selected
            updateAttendanceDisplay(selectedClassId); // Update attendance display for selected class
        });

        // Load initial data
        populateTeacherClassSelector(); // Populate classes on load and trigger initial attendance display
    }
});document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const generateCodeBtn = document.getElementById('generateCodeBtn');
    const attendanceCodeDisplay = document.getElementById('attendanceCodeDisplay');
    const codeExpiryDisplay = document.getElementById('codeExpiryDisplay');
    const presentStudentsList = document.getElementById('presentStudentsList');
    const absentStudentsList = document.getElementById('absentStudentsList');
    const presentCount = document.getElementById('presentCount');
    const absentCount = document.getElementById('absentCount');
    const logoutBtn = document.getElementById('logoutBtn');
    const teacherClassSelector = document.getElementById('teacherClassSelector');
    const createClassForm = document.getElementById('createClassForm');
    const classNameInput = document.getElementById('className');
    const classCodeInput = document.getElementById('classCode');
    const API_BASE_URL = 'https://attendance-system-tlj2.onrender.com';
    
    // State variables
    let codeGenerationInterval;
    let attendanceRefreshInterval; // New interval for attendance refresh
    const CODE_VALIDITY_MINUTES = 4; // Code expires after 4 minutes

    // Initialize dashboard
    checkAuth();
    initializeDashboard();

    // Check authentication
    function checkAuth() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user'));
        
        if (!token || !user || user.role !== 'teacher') {
            window.location.href = 'login.html';
        }
    }

    // Generate attendance code
    async function generateAttendanceCode() {
        const classId = teacherClassSelector.value;
        if (!classId) {
            showAlert('Please select a class first to generate a code.', 'error');
            return null;
        }

        try {
            generateCodeBtn.disabled = true;
            generateCodeBtn.textContent = 'Generating...';
            
            // Generate new code
            const { code, expiresAt } = await generateNewCode(classId);
            
            // Update UI
            updateCodeDisplay(code, expiresAt);
            
            // Set auto-refresh for code
            setupCodeAutoRefresh(expiresAt);
            
            showAlert('Attendance code generated successfully!', 'success');
            return code;
            
        } catch (error) {
            console.error('Code generation error:', error);
            showAlert(`Error: ${error.message}`, 'error');
            return null;
        } finally {
            generateCodeBtn.disabled = false;
            generateCodeBtn.textContent = 'Generate Code';
        }
    }

    // Fetch teacher's classes with improved error handling
    async function fetchTeacherClasses() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/teacher/classes`, {
                headers: getAuthHeaders()
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch classes');
            }
            
            const data = await response.json();
            return data.data || [];
            
        } catch (error) {
            console.error('Error fetching classes:', error);
            showAlert(`Error: ${error.message}`, 'error');
            return [];
        }
    }

    // Populate class selector
    async function populateTeacherClassSelector() {
        teacherClassSelector.innerHTML = '<option value="">Loading classes...</option>';
        const classes = await fetchTeacherClasses();
        teacherClassSelector.innerHTML = ''; // Clear loading message

        if (classes.length > 0) {
            teacherClassSelector.innerHTML = '<option value="">Select a class</option>';
            classes.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls._id;
                option.textContent = cls.name;
                teacherClassSelector.appendChild(option);
            });
            teacherClassSelector.disabled = false;
            generateCodeBtn.disabled = true; // Initially disable until a class is selected

            // Select the first class by default if none is selected and refresh attendance
            if (teacherClassSelector.value === "" && classes.length > 0) {
                teacherClassSelector.value = classes[0]._id; // Select the first class
                updateAttendanceDisplay(classes[0]._id);
            } else if (teacherClassSelector.value) {
                 // If a class is already selected (e.g., after creating a new one)
                 updateAttendanceDisplay(teacherClassSelector.value);
            } else {
                 // No classes or no selection, clear attendance display
                 clearAttendanceDisplay();
            }

        } else {
            teacherClassSelector.innerHTML = '<option value="">No classes found</option>';
            teacherClassSelector.disabled = true;
            generateCodeBtn.disabled = true;
            clearAttendanceDisplay();
        }
    }

    // Generate new code API call with better error handling
    async function generateNewCode(classId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/teacher/classes/${classId}/generate-code`, {
                method: 'POST',
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to generate code');
            }

            const result = await response.json();
            if (!result.data || !result.data.code) {
                throw new Error('Invalid response from server');
            }

            return result.data;
        } catch (error) {
            console.error('Error generating code:', error);
            throw error; // Re-throw to be caught by the calling function
        }
    }

    // Update code display in UI
    function updateCodeDisplay(code, expiresAt) {
        attendanceCodeDisplay.textContent = code;
        const expiryDate = new Date(expiresAt);
        codeExpiryDisplay.textContent = `Expires at: ${expiryDate.toLocaleTimeString()}`;
    }

    // Setup auto code refresh
    function setupCodeAutoRefresh(expiresAt) {
        // Clear any existing interval
        if (codeGenerationInterval) {
            clearInterval(codeGenerationInterval);
        }
        
        // Set timeout to regenerate code 1 minute before expiration
        const expiresIn = new Date(expiresAt) - new Date() - 60000; // 1 minute before
        if (expiresIn > 0) {
            codeGenerationInterval = setTimeout(() => {
                generateAttendanceCode();
            }, expiresIn);
        }
    }

    // Fetch attendance data for a specific class
    async function fetchAttendanceData(classId) {
        if (!classId) {
            clearAttendanceDisplay();
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/api/teacher/today?classId=${classId}`, { // Pass classId
                headers: getAuthHeaders()
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch attendance data');
            }
            
            const data = await response.json();
            
            // Validate and normalize the response data
            const attendanceData = {
                present: data.data?.present || [],
                absent: data.data?.absent || []
            };
            
            updateAttendanceUI(attendanceData);
            
        } catch (error) {
            console.error('Attendance fetch error:', error);
            if (error.message.includes('Unauthorized')) {
                handleLogout();
            } else {
                // Update UI with empty data on error
                updateAttendanceUI({ present: [], absent: [] });
                showAlert('Could not load attendance data for selected class. Please try again.', 'error');
            }
        }
    }

    // Function to update attendance display based on selected class
    function updateAttendanceDisplay(classId) {
        if (attendanceRefreshInterval) {
            clearInterval(attendanceRefreshInterval); // Clear existing interval
        }
        if (classId) {
            fetchAttendanceData(classId); // Initial fetch
            attendanceRefreshInterval = setInterval(() => fetchAttendanceData(classId), 30000); // Set new interval
        } else {
            clearAttendanceDisplay();
        }
    }

    // Clear attendance display when no class is selected
    function clearAttendanceDisplay() {
        presentStudentsList.innerHTML = '<li class="empty-message">No students present yet</li>';
        absentStudentsList.innerHTML = '<li class="empty-message">No absent students</li>';
        presentCount.textContent = '0';
        absentCount.textContent = '0';
    }


    // Update attendance UI with safer data handling
    function updateAttendanceUI(attendanceData = { present: [], absent: [] }) {
        // Ensure we have arrays to work with
        const presentStudents = Array.isArray(attendanceData.present) ? attendanceData.present : [];
        const absentStudents = Array.isArray(attendanceData.absent) ? attendanceData.absent : [];
        
        // Update present students
        updateStudentList(
            presentStudentsList, 
            presentStudents,
            'No students present yet',
            (student) => `
                <li>
                    <span class="student-name">${student.name || 'Unknown'}</span>
                    <span class="student-email">${student.email || ''}</span>
                    ${student.time ? `<span class="attendance-time">${new Date(student.time).toLocaleTimeString()}</span>` : ''}
                </li>
            `
        );

        // Update absent students
        updateStudentList(
            absentStudentsList, 
            absentStudents,
            'No absent students',
            (student) => `
                <li>
                    <span class="student-name">${student.name || 'Unknown'}</span>
                    <span class="student-email">${student.email || ''}</span>
                    <span class="status-absent">Absent</span>
                </li>
            `
        );

        // Update counters
        presentCount.textContent = presentStudents.length;
        absentCount.textContent = absentStudents.length;
    }

    // Update student list UI
    function updateStudentList(listElement, students, emptyMessage, templateFn) {
        if (students.length === 0) {
            listElement.innerHTML = `<li class="empty-message">${emptyMessage}</li>`;
            return;
        }

        listElement.innerHTML = students.map(templateFn).join('');
    }

    // Get auth headers
    function getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        };
    }

    // Show alert message
    function showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert ${type}`;
        alertDiv.textContent = message;
        document.body.appendChild(alertDiv);
        setTimeout(() => alertDiv.remove(), 3000);
    }

    // Handle logout
    function handleLogout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }

    // Handle class creation
    if (createClassForm) {
        createClassForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = classNameInput.value.trim();
            const code = classCodeInput.value.trim();

            if (!name || !code) {
                showAlert('Please enter both class name and code.', 'error');
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/teacher/classes`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ name, code })
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Failed to create class.');
                }

                showAlert('Class created successfully!', 'success');
                classNameInput.value = '';
                classCodeInput.value = '';
                await populateTeacherClassSelector(); // Refresh the class list
                // Select the newly created class if it's the only one or desired
                if (data.data && data.data._id) {
                    teacherClassSelector.value = data.data._id;
                    updateAttendanceDisplay(data.data._id);
                }
            } catch (error) {
                console.error('Class creation error:', error);
                showAlert(`Error creating class: ${error.message}`, 'error');
            }
        });
    }

    // Initialize dashboard
    function initializeDashboard() {
        // Set up event listeners
        generateCodeBtn.addEventListener('click', generateAttendanceCode);
        logoutBtn.addEventListener('click', handleLogout);
        teacherClassSelector.addEventListener('change', (event) => {
            const selectedClassId = event.target.value;
            generateCodeBtn.disabled = !selectedClassId; // Disable generate button if no class selected
            updateAttendanceDisplay(selectedClassId); // Update attendance display for selected class
        });

        // Load initial data
        populateTeacherClassSelector(); // Populate classes on load and trigger initial attendance display
    }
});
