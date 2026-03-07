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

// Wait for the HTML to fully load before running the script
document.addEventListener('DOMContentLoaded', () => {
    
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

            if (targetId === 'history-view') {
                loadHistory();
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
            alert("Please select a machine, weight, and reps.");
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
        alert("Exercise saved to draft. Select a new machine!");
    });

    // 3. Finish & Save Entire Workout to MongoDB
    finishWorkoutBtn.addEventListener('click', async () => {
        // Grab any sets currently on the screen that haven't been pushed to the session yet
        let finalSession = [...currentWorkoutSession];
        if (currentExerciseLogs.length > 0) {
            finalSession = finalSession.concat(currentExerciseLogs);
        }

        if (finalSession.length === 0) {
            alert("You haven't logged any sets yet!");
            return;
        }

        finishWorkoutBtn.innerText = "Saving to Server...";
        finishWorkoutBtn.disabled = true;

        try {
            const response = await fetch('https://gym-bot-backend-f5t8.onrender.com/api/save-workout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logs: finalSession })
            });

            if (!response.ok) throw new Error("Server error");

            alert("Workout completely saved to cloud!");
            
            // WIPE EVERYTHING CLEAN
            currentWorkoutSession = [];
            currentExerciseLogs = [];
            currentSetNumber = 1;
            localStorage.removeItem('workoutDraft'); // Clear phone backup
            
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
            alert("Failed to save to cloud. Don't worry, your workout is safely backed up on your phone.");
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
                const dateString = dateObj.toLocaleDateString() + ' - ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                let cardHTML = `
                    <div class="history-card">
                        <h3>${dateString}</h3>
                        <ul class="history-logs">
                `;

                session.logs.forEach((log, logIndex) => {
                    const cleanMachineName = log.machine.replace('_', ' '); 
                    cardHTML += `
                        <li class="history-log-item">
                            <div class="log-details">
                                <span class="machine-name">${cleanMachineName} (Set ${log.set})</span>
                                <span>${log.weight}kg x ${log.reps}</span>
                            </div>
                            <button class="delete-log-btn" data-session-id="${session._id}" data-log-index="${logIndex}" title="Delete this exercise">✕</button>
                        </li>
                    `;
                });

                cardHTML += `</ul></div>`;
                historyContainer.innerHTML += cardHTML;
            });

        } catch (error) {
            console.error("Error loading history:", error);
            // Auto-retry in 5 seconds if it fails
            setTimeout(loadHistory, 5000);
        }

        // Add delete event listeners to all delete buttons
        const deleteButtons = document.querySelectorAll('.delete-log-btn');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                
                const sessionId = btn.getAttribute('data-session-id');
                const logIndex = parseInt(btn.getAttribute('data-log-index'), 10);

                if (!confirm("Are you sure you want to delete this exercise?")) {
                    return;
                }

                try {
                    console.log("Deleting - sessionId:", sessionId, "logIndex:", logIndex);
                    
                    const response = await fetch('https://gym-bot-backend-f5t8.onrender.com/api/delete-exercise', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId, logIndex })
                    });

                    const responseData = await response.json();
                    console.log("Delete response:", responseData);

                    if (!response.ok) throw new Error(responseData.error || "Failed to delete");

                    alert("Exercise deleted!");
                    await fetch('https://gym-bot-backend-f5t8.onrender.com/api/health');
                    loadHistory(); // Refresh the history
                } catch (error) {
                    console.error("Error deleting exercise:", error);
                    alert("Failed to delete exercise: " + error.message);
                }
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
            alert("Bro, enter a machine name first!");
            return;
        }

        try {
            const response = await fetch('https://gym-bot-backend-f5t8.onrender.com/api/add-exercise', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ muscle, machine })
            });

            if (response.ok) {
                alert(`${machine} added to your library!`);
                newMachineName.value = ''; // clear input
                loadExercises(); // Refresh the list in the background
            }
        } catch (error) {
            console.error("Error adding machine:", error);
            alert("Failed to save machine.");
        }
    });

    // Load exercises the second the app opens
    loadExercises();
});