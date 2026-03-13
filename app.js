// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => {
                console.log('✅ Service Worker Registered!');
                
                // Check for updates every 30 seconds
                setInterval(() => {
                    reg.update();
                }, 30000);
                
                // Listen for new version and prompt user
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('🔄 New version available! Reloading...');
                            window.location.reload();
                        }
                    });
                });
            })
            .catch(err => console.log('❌ Service Worker failed:', err));
    });
}

// --- Toast Notification System ---
function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    
    toastContainer.appendChild(toast);
    
    // Auto-remove after duration
    setTimeout(() => {
        toast.style.animation = 'toastFadeOut 0.3s ease-in-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// --- Confirmation Modal ---
function showConfirmDialog(message, onConfirm, onCancel = null) {
    const modal = document.getElementById('confirm-modal');
    const modalContent = modal.querySelector('.modal-content p');
    const confirmYes = document.getElementById('confirm-yes');
    const confirmNo = document.getElementById('confirm-no');
    
    modalContent.innerText = message;
    
    // Remove old listeners
    const newConfirmYes = confirmYes.cloneNode(true);
    const newConfirmNo = confirmNo.cloneNode(true);
    confirmYes.parentElement.replaceChild(newConfirmYes, confirmYes);
    confirmNo.parentElement.replaceChild(newConfirmNo, confirmNo);
    
    newConfirmYes.addEventListener('click', () => {
        modal.classList.add('hidden');
        onConfirm();
    });
    
    newConfirmNo.addEventListener('click', () => {
        modal.classList.add('hidden');
        if (onCancel) onCancel();
    });
    
    modal.classList.remove('hidden');
}

// Wait for the HTML to fully load before running the script
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Wake Up Server on Load ---
    async function wakeUpServer() {
        try {
            console.log('⏰ Waking up server...');
            const response = await fetch('https://gym-bot-backend-f5t8.onrender.com/api/health');
            if (response.ok) {
                console.log('✅ Server is awake!');
            }
        } catch (error) {
            console.log('Server wake-up attempt made');
        }
    }
    
    // Wake up server immediately on page load
    wakeUpServer();
    
    // Keep server alive during workout with periodic pings
    let keepAliveInterval = null;
    
    function startKeepAlive() {
        if (keepAliveInterval) return; // Already running
        console.log('🔄 Starting keep-alive pings...');
        keepAliveInterval = setInterval(() => {
            fetch('https://gym-bot-backend-f5t8.onrender.com/api/health').catch(() => {});
        }, 600000); // Ping every 10 minutes (600000ms)
    }
    
    function stopKeepAlive() {
        if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
            console.log('⏸️ Keep-alive pings stopped');
        }
    }
    
    // Grab all the navigation buttons and all the views (sections)
    const navButtons = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('main > section');

    // Add a click listener to every button
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            
            // 1. Reset all buttons (remove the green active text)
            navButtons.forEach(btn => btn.classList.remove('active'));
            
            // 2. Hide all views
            views.forEach(view => {
                view.classList.remove('active-view');
                view.classList.add('hidden-view');
            });

            // 3. Light up the button you just clicked
            button.classList.add('active');

            // 4. Find the matching view and show it
            const targetId = button.getAttribute('data-target');
            const targetView = document.getElementById(targetId);
            
            targetView.classList.remove('hidden-view');
            targetView.classList.add('active-view');

            // Hide editing indicator when leaving workout tab (unless still in editing mode)
            if (targetId !== 'workout-view') {
                const editingIndicator = document.getElementById('editing-indicator');
                if (!window.editingSessionId) {
                    editingIndicator.classList.add('hidden');
                }
            }

            if (targetId === 'history-view') {
                loadHistory();
            }
            
            if (targetId === 'workout-view') {
                loadSameDayWorkouts();
            }
            
            if (targetId === 'muscles-view') {
                loadMusclesDashboard();
            }
        });
    });

    // --- Set Tab Logic ---
    const setTabs = document.querySelectorAll('.set-tab');
    const currentSetDisplay = document.getElementById('current-set-display');

    setTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 1. Remove active class from all set tabs
            setTabs.forEach(t => t.classList.remove('active-set'));
            
            // 2. Add active class to the clicked tab
            tab.classList.add('active-set');

            // 3. Update the button text to show which set you are logging
            const setNumber = tab.getAttribute('data-set');
            currentSetDisplay.innerText = setNumber;
        });
    });

    // --- Logging Logic ---
    
    // 1. Create an empty array to hold the session data

    // --- Workout Logging & UI State ---
    const weightInput = document.getElementById('weight-input');
    const repsInput = document.getElementById('reps-input');
    const logSetBtn = document.getElementById('log-set-btn');
    const nextExerciseBtn = document.getElementById('next-exercise-btn');
    const finishWorkoutBtn = document.getElementById('finish-workout-btn');
    const setTabsContainer = document.getElementById('set-tabs-container');

    // Load draft from local storage, or start fresh
    let currentWorkoutSession = JSON.parse(localStorage.getItem('workoutDraft')) || [];
    let currentSetNumber = 1;
    let currentExerciseLogs = []; // Temporarily holds sets for the current machine

    // Function to draw the set tabs
    function renderSetTabs() {
        setTabsContainer.innerHTML = ''; // Clear existing
        
        // Draw completed sets with green ticks
        currentExerciseLogs.forEach((log, index) => {
            const tab = document.createElement('button');
            tab.className = 'set-tab completed';
            tab.innerText = `Set ${index + 1} ✅`;
            
            // Allow clicking to view past numbers
            tab.addEventListener('click', () => {
                weightInput.value = log.weight;
                repsInput.value = log.reps;
                logSetBtn.innerText = `Update Set ${index + 1}`;
                currentSetNumber = index + 1; // Put UI in "Edit Mode"
            });
            setTabsContainer.appendChild(tab);
        });

        // Draw the "Next Set" tab (if we aren't in edit mode)
        if (currentSetNumber > currentExerciseLogs.length) {
            const currentTab = document.createElement('button');
            currentTab.className = 'set-tab active';
            currentTab.innerText = `Set ${currentExerciseLogs.length + 1}`;
            setTabsContainer.appendChild(currentTab);
        }
    }

    // 1. Log a Set (or update an old one)
    logSetBtn.addEventListener('click', () => {
        const weight = weightInput.value;
        const reps = repsInput.value;
        const machine = machineSelect.value;
        const muscle = muscleSelect.value;

        if (!machine || !weight || !reps) {
            showToast("Please select a machine, weight and reps", 'error', 3000);
            return;
        }

        const setLog = { muscle, machine, set: currentSetNumber, weight, reps };

        // If editing a past set, replace it. Otherwise, add new.
        if (currentSetNumber <= currentExerciseLogs.length) {
            currentExerciseLogs[currentSetNumber - 1] = setLog;
        } else {
            currentExerciseLogs.push(setLog);
        }

        // Advance to the next set
        currentSetNumber = currentExerciseLogs.length + 1;
        
        // Keep weight in the input, but clear reps for the next set
        repsInput.value = '';
        logSetBtn.innerText = `Log Set ${currentSetNumber}`;
        
        // Show the workout action buttons
        nextExerciseBtn.classList.remove('hidden-btn');
        finishWorkoutBtn.classList.remove('hidden-btn');
        
        // Start keep-alive pings to keep server awake during workout
        startKeepAlive();

        renderSetTabs();
    });

    // 2. Save & Move to New Exercise
    nextExerciseBtn.addEventListener('click', () => {
        if (currentExerciseLogs.length === 0) return;

        // Push all sets from this exercise into the global session
        currentWorkoutSession = currentWorkoutSession.concat(currentExerciseLogs);
        
        // Backup to the phone's physical storage so no data is lost!
        localStorage.setItem('workoutDraft', JSON.stringify(currentWorkoutSession));

        // Reset the UI for the next exercise
        currentExerciseLogs = [];
        currentSetNumber = 1;
        weightInput.value = '';
        repsInput.value = '';
        machineSelect.value = '';
        logSetBtn.innerText = `Log Set 1`;
        
        renderSetTabs();
        showToast("Exercise saved to draft. Select a new machine!", 'success', 3000);
    });

    // 3. Finish & Save Entire Workout to MongoDB
    finishWorkoutBtn.addEventListener('click', async () => {
        // Grab any sets currently on the screen that haven't been pushed to the session yet
        let finalSession = [...currentWorkoutSession];
        if (currentExerciseLogs.length > 0) {
            finalSession = finalSession.concat(currentExerciseLogs);
        }

        if (finalSession.length === 0) {
            showToast("You haven't logged any sets yet!", 'error', 3000);
            return;
        }

        finishWorkoutBtn.innerText = "Saving to Server...";
        finishWorkoutBtn.disabled = true;

        try {
            const requestBody = { logs: finalSession };
            
            // If editing an existing session, include the sessionId
            if (window.editingSessionId) {
                requestBody.sessionId = window.editingSessionId;
            }
            
            const response = await fetch('https://gym-bot-backend-f5t8.onrender.com/api/save-workout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) throw new Error("Server error");

            showToast("Workout saved to cloud!", 'success', 3000);
            
            // Stop keep-alive pings
            stopKeepAlive();
            
            // WIPE EVERYTHING CLEAN
            currentWorkoutSession = [];
            currentExerciseLogs = [];
            currentSetNumber = 1;
            localStorage.removeItem('workoutDraft'); // Clear phone backup
            window.editingSessionId = null; // Clear editing mode
            
            // Hide editing indicator
            const editingIndicator = document.getElementById('editing-indicator');
            editingIndicator.classList.add('hidden');
            
            // Reset UI
            weightInput.value = '';
            repsInput.value = '';
            machineSelect.value = '';
            logSetBtn.innerText = `Log Set 1`;
            finishWorkoutBtn.classList.add('hidden-btn');
            nextExerciseBtn.classList.add('hidden-btn');
            finishWorkoutBtn.innerText = "Finish & Save Workout";
            finishWorkoutBtn.disabled = false;
            
            renderSetTabs();
            
            // Switch to History tab
            document.querySelector('.nav-btn[data-target="history-view"]').click();
            
        } catch (error) {
            console.error("Error saving workout:", error);
            stopKeepAlive();
            showToast("Failed to save. Your workout is backed up on your phone.", 'error', 4000);
            finishWorkoutBtn.innerText = "Finish & Save Workout";
            finishWorkoutBtn.disabled = false;
        }
    });

    // Run this once when the app opens to check for an interrupted workout
    if (currentWorkoutSession.length > 0) {
        finishWorkoutBtn.classList.remove('hidden-btn');
        nextExerciseBtn.classList.remove('hidden-btn');
    }

    // --- Load History Logic ---
    const historyContainer = document.getElementById('workout-history-container');
    const sameDayContainer = document.getElementById('same-day-workouts');

    // Helper function to group logs by machine
    function groupLogsByMachine(logs) {
        const grouped = {};
        logs.forEach((log, originalIndex) => {
            const machine = log.machine;
            if (!grouped[machine]) {
                grouped[machine] = [];
            }
            grouped[machine].push({ ...log, originalIndex });
        });
        return grouped;
    }

    // --- Load Same Day Workouts ---
    async function loadSameDayWorkouts() {
        const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        sameDayContainer.innerHTML = '<p class="loading-text">Loading workouts...</p>';

        try {
            const response = await fetch('https://gym-bot-backend-f5t8.onrender.com/api/get-workouts');
            if (!response.ok) throw new Error("Server not ready");

            const sessions = await response.json();
            
            // Filter workouts from the same day of the week
            const sameDayWorkouts = sessions.filter(session => {
                const sessionDate = new Date(session.date);
                const sessionDayName = sessionDate.toLocaleDateString('en-US', { weekday: 'long' });
                return sessionDayName === todayDayName;
            });

            if (sameDayWorkouts.length === 0) {
                sameDayContainer.innerHTML = `<p class="same-day-workouts-empty">No previous ${todayDayName} workouts. Go set a new record! 💪</p>`;
                return;
            }

            // Combine all logs from same-day workouts
            const allSameDayLogs = [];
            sameDayWorkouts.forEach(session => {
                session.logs.forEach(log => {
                    allSameDayLogs.push(log);
                });
            });

            // Group by machine
            const groupedLogs = groupLogsByMachine(allSameDayLogs);

            let containerHTML = `<h3>💪 Your ${todayDayName} Routine</h3><ul class="same-day-workouts-list">`;

            // Render grouped exercises
            Object.keys(groupedLogs).forEach(machine => {
                const logsForMachine = groupedLogs[machine];
                const cleanMachineName = machine.replace('_', ' ');
                const muscle = logsForMachine[0].muscle;
                const cleanMuscle = muscle.charAt(0).toUpperCase() + muscle.slice(1);

                if (logsForMachine.length >= 2) {
                    // Multiple sets
                    const setNumbers = logsForMachine.map(log => log.set).join(', ');
                    const weightReps = logsForMachine.map(log => `${log.weight}*${log.reps}`).join(' | ');
                    
                    containerHTML += `
                        <li class="same-day-workout-item">
                            <span class="machine-name">${cleanMachineName}</span>
                            <span class="muscle-info">Muscle: ${cleanMuscle}</span>
                            <span class="sets-info"><strong>Sets:</strong> ${setNumbers}</span>
                            <span class="weight-reps-info"><strong>wt*reps:</strong> ${weightReps}</span>
                        </li>
                    `;
                } else {
                    // Single set
                    const log = logsForMachine[0];
                    containerHTML += `
                        <li class="same-day-workout-item">
                            <span class="machine-name">${cleanMachineName}</span>
                            <span class="muscle-info">Muscle: ${cleanMuscle}</span>
                            <span class="sets-info"><strong>Set ${log.set}:</strong> ${log.weight}kg x ${log.reps}</span>
                        </li>
                    `;
                }
            });

            containerHTML += `</ul>`;
            sameDayContainer.innerHTML = containerHTML;

        } catch (error) {
            console.error("Error loading same-day workouts:", error);
            sameDayContainer.innerHTML = '<p class="same-day-workouts-empty">Could not load past workouts.</p>';
        }
    }

    async function loadHistory() {
        historyContainer.innerHTML = '<p class="loading-text">Waking up server & loading past workouts...</p>';

        try {
            // FIX: The exact URL with the /api/get-workouts endpoint included
            const response = await fetch('https://gym-bot-backend-f5t8.onrender.com/api/get-workouts');
            
            // If the server is asleep (or sends an HTML page), throw an error to trigger a retry
            if (!response.ok) {
                throw new Error("Server not ready or endpoint missing");
            }

            const sessions = await response.json();

            if (sessions.length === 0) {
                historyContainer.innerHTML = '<p class="loading-text">No workouts logged yet. Go lift!</p>';
                return;
            }

            historyContainer.innerHTML = ''; // Clear loading text

            sessions.forEach(session => {
                const dateObj = new Date(session.date);
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                const dateString = dayName + ', ' + dateObj.toLocaleDateString() + ' - ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                let cardHTML = `
                    <div class="history-card" data-session-id="${session._id}">
                        <div class="history-card-header">
                            <h3>${dateString}</h3>
                            <button class="edit-session-btn" title="Add more exercises to this session">Edit</button>
                        </div>
                        <ul class="history-logs">
                `;

                // Group logs by machine
                const groupedLogs = groupLogsByMachine(session.logs);

                // Render grouped exercises
                Object.keys(groupedLogs).forEach(machine => {
                    const logsForMachine = groupedLogs[machine];
                    const cleanMachineName = machine.replace('_', ' ');

                    if (logsForMachine.length >= 2) {
                        // Multiple sets of the same exercise
                        const setNumbers = logsForMachine.map(log => log.set).join(', ');
                        const weightReps = logsForMachine.map(log => `${log.weight}*${log.reps}`).join(' | ');
                        
                        cardHTML += `
                            <li class="history-log-item grouped-log">
                                <div class="log-details grouped">
                                    <span class="machine-name">${cleanMachineName}</span>
                                    <span class="sets-info"><strong>Sets:</strong> <span class="sets-numbers">${setNumbers}</span></span>
                                    <span class="weight-reps-info"><strong>wt*reps:</strong> <span class="weight-reps-numbers">${weightReps}</span></span>
                                </div>
                                <div class="grouped-delete-buttons">
                                    ${logsForMachine.map(log => `
                                        <button class="delete-log-btn" data-session-id="${session._id}" data-log-index="${log.originalIndex}" title="Select for deletion">☐</button>
                                    `).join('')}
                                </div>
                            </li>
                        `;
                    } else {
                        // Single set of the exercise
                        const log = logsForMachine[0];
                        cardHTML += `
                            <li class="history-log-item" data-session-id="${session._id}" data-log-index="${log.originalIndex}">
                                <div class="log-details">
                                    <span class="machine-name">${cleanMachineName}</span>
                                    <span>${log.weight}kg x ${log.reps}</span>
                                </div>
                                <button class="delete-log-btn" title="Select for deletion">☐</button>
                            </li>
                        `;
                    }
                });

                cardHTML += `</ul></div>`;
                historyContainer.innerHTML += cardHTML;
            });

        } catch (error) {
            console.error("Error loading history:", error);
            // Auto-retry in 5 seconds if it fails
            setTimeout(loadHistory, 5000);
        }

        // --- Delete Selection System ---
        const deleteActionBar = document.getElementById('delete-action-bar');
        const deleteActionBtn = document.getElementById('delete-action-btn');
        let selectedItems = new Set();

        const logItems = document.querySelectorAll('.history-log-item');
        logItems.forEach(item => {
            const deleteButtons = item.querySelectorAll('.delete-log-btn');
            
            deleteButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    const sessionId = btn.getAttribute('data-session-id') || item.getAttribute('data-session-id');
                    const logIndex = btn.getAttribute('data-log-index') || item.getAttribute('data-log-index');
                    const key = `${sessionId}-${logIndex}`;
                    
                    // Toggle selection
                    if (selectedItems.has(key)) {
                        selectedItems.delete(key);
                        btn.classList.remove('selected');
                        btn.innerText = '☐'; // Change back to empty square
                    } else {
                        selectedItems.add(key);
                        btn.classList.add('selected');
                        btn.innerText = '✓'; // Change to checkmark
                    }
                    
                    // Update action bar
                    if (selectedItems.size > 0) {
                        document.getElementById('delete-count').innerText = `${selectedItems.size} selected`;
                        deleteActionBar.classList.remove('hidden');
                    } else {
                        deleteActionBar.classList.add('hidden');
                    }
                });
            });
        });

        // Delete action button handler
        deleteActionBtn.addEventListener('click', () => {
            if (selectedItems.size === 0) return;
            
            const itemsToDelete = Array.from(selectedItems);
            
            showConfirmDialog(
                `Delete ${itemsToDelete.length === 1 ? 'this exercise' : itemsToDelete.length + ' exercises'}?`,
                async () => {
                    try {
                        // Sort items in reverse order so deleting doesn't shift indices
                        const sortedItems = itemsToDelete.sort((a, b) => {
                            const aIndex = parseInt(a.split('-')[1]);
                            const bIndex = parseInt(b.split('-')[1]);
                            return bIndex - aIndex; // Highest index first
                        });
                        
                        // Delete each selected item (highest index first)
                        for (let key of sortedItems) {
                            const [sessionId, logIndex] = key.split('-');
                            
                            const response = await fetch('https://gym-bot-backend-f5t8.onrender.com/api/delete-exercise', {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ sessionId, logIndex: parseInt(logIndex) })
                            });

                            if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.error || "Failed to delete");
                            }
                        }
                        
                        showToast("Exercise deleted!", 'success', 3000);
                        selectedItems.clear();
                        deleteActionBar.classList.add('hidden');
                        loadHistory(); // Refresh the history
                    } catch (error) {
                        console.error("Error deleting exercises:", error);
                        showToast("Failed to delete. Try again.", 'error', 3000);
                    }
                },
                () => {
                    // Cancel - do nothing
                }
            );
        });

        // --- Edit Session Logic (Add exercises to existing session) ---
        window.editingSessionId = null; // Global variable to track if we're editing a session
        
        const editSessionBtns = document.querySelectorAll('.edit-session-btn');
        editSessionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                const sessionId = btn.closest('.history-card').getAttribute('data-session-id');
                window.editingSessionId = sessionId; // Store the session ID globally
                
                // Show editing indicator
                const editingIndicator = document.getElementById('editing-indicator');
                editingIndicator.classList.remove('hidden');
                
                // Reset the workout state to show we're editing
                currentWorkoutSession = [];
                currentExerciseLogs = [];
                currentSetNumber = 1;
                localStorage.removeItem('workoutDraft');
                
                // Reset UI
                const weightInput = document.getElementById('weight-input');
                const repsInput = document.getElementById('reps-input');
                const machineSelect = document.getElementById('machine-select');
                const logSetBtn = document.getElementById('log-set-btn');
                const finishWorkoutBtn = document.getElementById('finish-workout-btn');
                const nextExerciseBtn = document.getElementById('next-exercise-btn');
                const setTabsContainer = document.getElementById('set-tabs-container');
                
                weightInput.value = '';
                repsInput.value = '';
                machineSelect.value = '';
                logSetBtn.innerText = 'Log Set 1';
                finishWorkoutBtn.classList.add('hidden-btn');
                nextExerciseBtn.classList.add('hidden-btn');
                setTabsContainer.innerHTML = '';
                
                // Switch to workout tab
                document.querySelector('.nav-btn[data-target="workout-view"]').click();
            });
        });
    }

    // --- Library & Dynamic Dropdowns Logic ---
    const machineSelect = document.getElementById('machine-select');
    const muscleSelect = document.getElementById('muscle-select');
    
    let allExercises = [];

    // 1. Fetch exercises from DB
    async function loadExercises() {
        try {
            const response = await fetch('https://gym-bot-backend-f5t8.onrender.com/api/get-exercises');
            allExercises = await response.json();
        } catch (error) {
            console.error("Error loading exercises:", error);
        }
    }

    // 2. Update the Machine dropdown based on the Muscle selected
    muscleSelect.addEventListener('change', () => {
        const selectedMuscle = muscleSelect.value;
        
        // Clear current options
        machineSelect.innerHTML = '<option value="">Select Machine...</option>';

        // Filter exercises for the chosen muscle
        const filteredMachines = allExercises.filter(ex => ex.muscle === selectedMuscle);

        // Inject them into the HTML
        filteredMachines.forEach(ex => {
            const option = document.createElement('option');
            option.value = ex.machine; // e.g., "Pec Deck Fly"
            option.innerText = ex.machine;
            machineSelect.appendChild(option);
        });
    });

    // 3. Add a new machine from the Library Tab
    const addMachineBtn = document.getElementById('add-machine-btn');
    const newMachineMuscle = document.getElementById('new-machine-muscle');
    const newMachineName = document.getElementById('new-machine-name');

    addMachineBtn.addEventListener('click', async () => {
        const muscle = newMachineMuscle.value;
        const machine = newMachineName.value.trim();

        if (!machine) {
            showToast("Please enter a machine name!", 'error', 3000);
            return;
        }

        try {
            const response = await fetch('https://gym-bot-backend-f5t8.onrender.com/api/add-exercise', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ muscle, machine })
            });

            if (response.ok) {
                showToast(`${machine} added to your library!`, 'success', 3000);
                newMachineName.value = ''; // clear input
                loadExercises(); // Refresh the list in the background
            }
        } catch (error) {
            console.error("Error adding machine:", error);
            showToast("Failed to save machine.", 'error', 3000);
        }
    });

    // Load exercises the second the app opens
    loadExercises();
    loadSameDayWorkouts();

    // --- Muscle Recovery Time Configuration (in hours) ---
    const RECOVERY_TIMES = {
        chest: 48,      // Large muscle - 48 hours (2 days)
        back: 48,       // Large muscle - 48 hours
        legs: 72,       // Large muscle - 72 hours (3 days)
        shoulders: 48,  // Medium muscle - 48 hours
        arms: 36,       // Small muscle - 36 hours
        core: 36,       // Small muscle - 36 hours
        head: 0,        // Not trained
        neck: 0         // Not trained
    };

    // Function to calculate recovery percentage (0-100%)
    function getRecoveryPercentage(lastTrainedDate) {
        if (!lastTrainedDate) return 100; // Never trained = fully recovered
        
        const now = new Date();
        const hoursSinceTraining = (now - new Date(lastTrainedDate)) / (1000 * 60 * 60);
        return Math.min(100, (hoursSinceTraining / 48) * 100); // Use 48h as reference for percentage
    }

    // Function to get color status based on recovery percentage
    function getRecoveryStatus(muscle, lastTrainedDate) {
        if (!lastTrainedDate) return 'ready'; // Never trained = ready to go

        const recoveryTime = RECOVERY_TIMES[muscle] || 48;
        const now = new Date();
        const hoursSinceTraining = (now - new Date(lastTrainedDate)) / (1000 * 60 * 60);
        const recoveryPercent = Math.min(100, (hoursSinceTraining / recoveryTime) * 100);

        if (recoveryPercent < 50) {
            return 'trained-today'; // Red: Recently trained (0-50%)
        } else if (recoveryPercent < 80) {
            return 'trained-recently'; // Yellow: Mid recovery (50-80%)
        } else if (recoveryPercent < 100) {
            return 'light-green'; // Light green: Almost recovered (80-100%)
        } else {
            return 'ready'; // Green: Fully recovered (>100%)
        }
    }

    // Function to apply color coding to the anatomy SVGs
    function updateMuscleAnatomyColors(lastHitDates) {
        // Map muscle groups to their body part IDs
        const muscleToBodyParts = {
            chest: ['chest'],
            back: ['abdomen'], // Back muscles visualization
            shoulders: ['right-shoulder', 'left-shoulder'],
            arms: ['right-arm', 'right-hand', 'left-arm', 'left-hand'],
            legs: ['right-leg', 'right-foot', 'left-leg', 'left-foot'],
            core: ['abdomen'],
            head: ['head', 'orbit'],
            neck: ['neck']
        };

        // Clear all color classes first
        document.querySelectorAll('.muscle-part').forEach(svg => {
            svg.classList.remove('trained-today', 'trained-recently', 'light-green', 'ready');
        });

        // Apply new color classes based on recovery status
        Object.keys(muscleToBodyParts).forEach(muscle => {
            const status = getRecoveryStatus(muscle, lastHitDates[muscle]);
            const bodyParts = muscleToBodyParts[muscle];

            bodyParts.forEach(partId => {
                const svgElement = document.getElementById(partId);
                if (svgElement) {
                    svgElement.classList.add(status);
                }
            });
        });
    }

    // --- Muscles Dashboard Logic ---
    let radarChartInstance = null; // Keeps track of the chart so we can update it

    async function loadMusclesDashboard() {
        const checklistContainer = document.getElementById('weekly-checklist');
        
        try {
            const response = await fetch('https://gym-bot-backend-f5t8.onrender.com/api/get-workouts');
            if (!response.ok) throw new Error("Server not ready");
            const sessions = await response.json();

            // 1. Setup our Data Trackers
            const now = new Date();
            const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
            const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

            const weeklyHits = { chest: 0, back: 0, legs: 0, shoulders: 0, arms: 0, core: 0 };
            const lastHitDates = { chest: null, back: null, legs: null, shoulders: null, arms: null, core: 0 };
            const volume30Days = { chest: 0, back: 0, legs: 0, shoulders: 0, arms: 0, core: 0 };

            // 2. Crunch the Numbers from MongoDB
            sessions.forEach(session => {
                const sessionDate = new Date(session.date);
                
                session.logs.forEach(log => {
                    const muscle = log.muscle;
                    if (!weeklyHits[muscle] && weeklyHits[muscle] !== 0) return; // Skip unknown muscles

                    // A. Radar Chart Volume (Last 30 Days)
                    if (sessionDate >= thirtyDaysAgo) {
                        volume30Days[muscle] += (log.weight * log.reps);
                    }

                    // B. Weekly Checklist (Last 7 Days)
                    if (sessionDate >= oneWeekAgo) {
                        // We count 'sessions' not 'sets'. If they did 5 sets of bench in one day, it counts as 1 hit.
                        // We will roughly estimate this by just incrementing the hit. (Can be refined later)
                        weeklyHits[muscle] += 0.2; // Rough math assuming 5 sets per muscle per session
                    }

                    // C. Heat Map Dates (Find the most recent time this muscle was hit)
                    if (!lastHitDates[muscle] || sessionDate > lastHitDates[muscle]) {
                        lastHitDates[muscle] = sessionDate;
                    }
                });
            });

            // 3. Render the 2x/Week Checklist
            checklistContainer.innerHTML = '';
            const allMuscles = Object.keys(weeklyHits);
            
            allMuscles.forEach(muscle => {
                const estimatedSessions = Math.round(weeklyHits[muscle]);
                const remaining = 2 - estimatedSessions; // You specifically want 2x a week
                
                const li = document.createElement('li');
                const cleanName = muscle.charAt(0).toUpperCase() + muscle.slice(1);

                if (remaining <= 0) {
                    li.className = 'target-met';
                    li.innerHTML = `<span>${cleanName}</span> <span>✅ Done (2/2)</span>`;
                } else {
                    li.className = 'target-missed';
                    li.innerHTML = `<span>${cleanName}</span> <span>🔴 ${remaining} session(s) left</span>`;
                }
                checklistContainer.appendChild(li);
            });

            // 4. Apply Color Coding to Anatomy SVGs Based on Recovery Status
            updateMuscleAnatomyColors(lastHitDates);

            // 5. Draw the Chart.js Radar
            const ctx = document.getElementById('volumeRadar').getContext('2d');
            
            // Destroy the old chart if it exists so we don't draw on top of it
            if (radarChartInstance) radarChartInstance.destroy();

            radarChartInstance = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'],
                    datasets: [{
                        label: 'Volume (kg) - Last 30 Days',
                        data: [
                            volume30Days.chest, volume30Days.back, volume30Days.legs, 
                            volume30Days.shoulders, volume30Days.arms, volume30Days.core
                        ],
                        backgroundColor: 'rgba(76, 175, 80, 0.2)', // Transparent Green
                        borderColor: '#4CAF50', // Solid Green border
                        pointBackgroundColor: '#fff',
                        borderWidth: 2
                    }]
                },
                options: {
                    scales: {
                        r: {
                            angleLines: { color: '#333' },
                            grid: { color: '#333' },
                            pointLabels: { color: '#ccc', font: { size: 12 } },
                            ticks: { display: false } // Hides the ugly numbers on the web
                        }
                    },
                    plugins: { legend: { display: false } },
                    maintainAspectRatio: false
                }
            });

        } catch (error) {
            console.error("Dashboard error, retrying...", error);
            setTimeout(loadMusclesDashboard, 5000); // Auto-retry if server is asleep
        }
    }
});