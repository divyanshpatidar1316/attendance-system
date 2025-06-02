document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const attendanceCodeInput = document.getElementById('attendanceCode');
    const markAttendanceBtn = document.getElementById('markAttendanceBtn');
    const getLocationBtn = document.getElementById('getLocationBtn');
    const locationStatus = document.getElementById('locationStatus');
    const attendanceStatus = document.getElementById('attendanceStatus');
    const studentNameSpan = document.getElementById('studentName');
    const logoutBtn = document.getElementById('logoutBtn');
    const classSelector = document.getElementById('classSelector');
    const classTitle = document.getElementById('classTitle');
    const classTotal = document.getElementById('classTotal');
    const classPresent = document.getElementById('classPresent');
    const classAbsent = document.getElementById('classAbsent');
    const classPercentage = document.getElementById('classPercentage');
    const attendanceTableBody = document.querySelector('#attendanceTable tbody');
    const progressBar = document.querySelector('.progress-bar');
    const attendancePercentCircle = document.getElementById('attendancePercent');

    let userLocation = null;
    const API_BASE_URL = 'http://localhost:5000';

    // Initial setup
    checkAuth();
    loadStudentDashboard();

    // Check authentication and redirect if not logged in or wrong role
    function checkAuth() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user'));

        if (!token || !user || user.role !== 'student') {
            window.location.href = 'login.html';
        } else {
            studentNameSpan.textContent = user.name;
        }
    }

    // Load student dashboard data
    async function loadStudentDashboard() {
        await populateClassSelector();
        // Automatically select the first class if available and load its data
        if (classSelector.options.length > 1 && classSelector.options[1].value !== "") { // Check if there's at least one actual class option
            classSelector.value = classSelector.options[1].value; // Select the first actual class
            fetchClassAttendanceDetails(classSelector.value); // Fetch and display its details
        } else {
            classTitle.textContent = 'Select a Class to view details';
            clearAttendanceDetails(); // Clear display if no classes or "No classes found"
        }
    }

    // Populate class selector dropdown
    async function populateClassSelector() {
        classSelector.innerHTML = '<option value="">Select a class</option>'; // Reset dropdown
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/student/classes`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch classes');
            }

            const classes = await response.json();
            if (classes.length > 0) {
                classes.forEach(cls => {
                    const option = document.createElement('option');
                    option.value = cls._id;
                    option.textContent = cls.name; // Display class name
                    classSelector.appendChild(option);
                });
            } else {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No classes found';
                classSelector.appendChild(option);
            }
        } catch (error) {
            console.error('Error fetching student classes:', error);
            showAlert(`Error loading classes: ${error.message}`, 'error');
        }
    }

    // Clear attendance details display
    function clearAttendanceDetails() {
        classTotal.textContent = '0';
        classPresent.textContent = '0';
        classAbsent.textContent = '0';
        classPercentage.textContent = '0';
        attendancePercentCircle.textContent = '0';
        progressBar.style.strokeDashoffset = 339.292; // Reset progress bar (circumference of circle)
        attendanceTableBody.innerHTML = '';
        const emptyMessageRow = document.createElement('tr');
        emptyMessageRow.innerHTML = '<td colspan="3" style="text-align: center; color: rgba(255, 255, 255, 0.5);">No attendance records found for this class.</td>';
        attendanceTableBody.appendChild(emptyMessageRow);
    }

    // Fetch attendance details for a specific class
    async function fetchClassAttendanceDetails(classId) {
        if (!classId) {
            classTitle.textContent = 'Select a Class to view details';
            clearAttendanceDetails();
            return;
        }

        const token = localStorage.getItem('token');
        try {
            // Fetch stats
            const statsResponse = await fetch(`${API_BASE_URL}/api/student/stats/${classId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const statsData = await statsResponse.json();

            if (!statsResponse.ok) {
                throw new Error(statsData.message || 'Failed to fetch attendance stats');
            }

            classTotal.textContent = statsData.total;
            classPresent.textContent = statsData.present;
            classAbsent.textContent = statsData.absent;
            classPercentage.textContent = statsData.percentage;
            attendancePercentCircle.textContent = statsData.percentage; // Update the circle text

            // Update progress circle
            const circumference = 339.292; // 2 * π * r (r = 54 for a radius of 54, assuming viewBox 0 0 120 120 means r=60-6 margin)
            const offset = circumference - (statsData.percentage / 100) * circumference;
            progressBar.style.strokeDashoffset = offset;
            
            // Fetch attendance history
            const historyResponse = await fetch(`${API_BASE_URL}/api/student/attendance/${classId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const historyData = await historyResponse.json();

            if (!historyResponse.ok) {
                throw new Error(historyData.message || 'Failed to fetch attendance history');
            }

            attendanceTableBody.innerHTML = ''; // Clear existing rows
            if (historyData.length > 0) {
                historyData.forEach(record => {
                    const row = document.createElement('tr');
                    const date = new Date(record.date).toLocaleDateString();
                    const statusClass = record.status === 'present' ? 'present' : 'absent';
                    row.innerHTML = `
                        <td>${date}</td>
                        <td class="${statusClass}">${record.status}</td>
                        <td>${record.code || 'N/A'}</td> `;
                    attendanceTableBody.appendChild(row);
                });
            } else {
                const emptyMessageRow = document.createElement('tr');
                emptyMessageRow.innerHTML = '<td colspan="3" style="text-align: center; color: rgba(255, 255, 255, 0.5);">No attendance records found for this class.</td>';
                attendanceTableBody.appendChild(emptyMessageRow);
            }
            
            const selectedClassName = classSelector.options[classSelector.selectedIndex].textContent;
            classTitle.textContent = `${selectedClassName} Attendance`;

        } catch (error) {
            console.error('Error fetching class attendance details:', error);
            showAlert(`Error fetching class details: ${error.message}`, 'error');
            classTitle.textContent = 'Error loading attendance';
            clearAttendanceDetails();
        }
    }

    // Get user location
    getLocationBtn.addEventListener('click', () => {
        locationStatus.textContent = 'Getting location...';
        
        if (!navigator.geolocation) {
            locationStatus.textContent = 'Geolocation is not supported by your browser';
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                locationStatus.textContent = `Location verified: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`;
            },
            (error) => {
                locationStatus.textContent = `Error getting location: ${error.message}`;
            }
        );
    });
    
    // Mark attendance
    markAttendanceBtn.addEventListener('click', async () => {
        const code = attendanceCodeInput.value.trim();
        const selectedClassId = classSelector.value; // Get selected class ID for refresh

        if (!code) {
            showAlert('Please enter attendance code', 'error');
            return;
        }
        
        if (!userLocation) {
            showAlert('Please verify your location first', 'error');
            return;
        }
        
        // Optional: Check if a class is selected before marking attendance
        // if (!selectedClassId) {
        //     showAlert('Please select a class before marking attendance.', 'error');
        //     return;
        // }


        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/attendance/mark`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    code,
                    location: userLocation
                })
            });
            
            const data = await response.json();
            
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Failed to mark attendance');
            }
            
            showAlert(`Attendance marked successfully for ${data.class}!`, 'success');
            attendanceCodeInput.value = ''; // Clear the input field after successful marking
            
            // Refresh attendance stats and history for the currently selected class
            // This assumes the marked attendance applies to the currently selected class
            // or the class associated with the code.
            if (selectedClassId) {
                fetchClassAttendanceDetails(selectedClassId);
            } else {
                // If no class was selected in dropdown but attendance was marked,
                // you might want to re-populate classes and try to select the relevant one.
                // For simplicity, we'll rely on the student selecting a class.
                await populateClassSelector();
                // Find the class that was just marked and select it
                // This requires the /api/attendance/mark endpoint to return classId
                // If data.class (name) is returned, we can try to find its ID in the selector
                // Or simply re-select the first class if available.
                if (classSelector.options.length > 1 && classSelector.options[1].value !== "") {
                    classSelector.value = classSelector.options[1].value;
                    fetchClassAttendanceDetails(classSelector.value);
                }
            }
            
        } catch (error) {
            showAlert(error.message, 'error');
        }
    });
    
    // Event listener for class selection change
    classSelector.addEventListener('change', (event) => {
        const selectedClassId = event.target.value;
        fetchClassAttendanceDetails(selectedClassId);
    });

    // Logout functionality
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    });

    // Helper function to show alerts
    function showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert ${type}`;
        alertDiv.textContent = message;
        document.body.appendChild(alertDiv);
        setTimeout(() => alertDiv.remove(), 3000);
    }
});