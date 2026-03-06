// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('✅ Service Worker Registered!'))
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
    let currentWorkoutSession = [];

    // Grab the inputs and the button
    const logSetBtn = document.getElementById('log-set-btn');
    const weightInput = document.getElementById('weight-input');
    const repsInput = document.getElementById('reps-input');
    const muscleSelect = document.getElementById('muscle-select');
    const machineSelect = document.getElementById('machine-select');

    logSetBtn.addEventListener('click', () => {
        // 2. Read what is currently on the screen
        const muscle = muscleSelect.value;
        const machine = machineSelect.value;
        const weight = weightInput.value;
        const reps = repsInput.value;
        const activeTab = document.querySelector('.set-tab.active-set');
        const currentSet = activeTab.getAttribute('data-set');

        // 3. Quick validation so you don't accidentally log blank sets
        if (!muscle || !machine || !weight || !reps) {
            alert("Fill out everything before logging the set, bro!");
            return;
        }

        // 4. Create a data object for this specific set
        const loggedSet = {
            muscle: muscle,
            machine: machine,
            set: parseInt(currentSet),
            weight: parseFloat(weight),
            reps: parseInt(reps),
            time: new Date().toLocaleTimeString() // Just to see when you hit it
        };

        // 5. Push it to our temporary array
        currentWorkoutSession.push(loggedSet);
        
        // Print it to the browser console so you can see it working!
        console.log("Workout Data:", currentWorkoutSession);

        // 6. UI Magic: Clear inputs for the next set
        weightInput.value = '';
        repsInput.value = '';

        // 7. Auto-advance to the next tab (if you aren't on set 5)
        const nextSetNum = parseInt(currentSet) + 1;
        if (nextSetNum <= 5) {
            const nextTab = document.querySelector(`.set-tab[data-set="${nextSetNum}"]`);
            if (nextTab) {
                nextTab.click(); // Simulates you tapping the next number
            }
        } else {
            alert("All 5 sets logged! Time for the next machine.");
        }
    });

    // --- Finish Workout & Save to Database ---
    const finishWorkoutBtn = document.getElementById('finish-workout-btn');

    // Update your existing logSetBtn listener to unhide the finish button
    logSetBtn.addEventListener('click', () => {
        // ... (Keep all your existing logging code here) ...

        // Unhide the Finish button once the first set is logged
        if (currentWorkoutSession.length > 0) {
            finishWorkoutBtn.classList.remove('hidden-btn');
        }
    });

    // The actual POST request to your backend
    finishWorkoutBtn.addEventListener('click', async () => {
        if (currentWorkoutSession.length === 0) {
            alert("You haven't logged any sets yet!");
            return;
        }

        // Change button text so you know it's working
        finishWorkoutBtn.innerText = "Saving to Database...";
        finishWorkoutBtn.disabled = true;

        try {
            // Send the data to your Node.js server
            const response = await fetch('https://gym-bot-backend-f5t8.onrender.com/api/save-workout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                // We wrap your array in an object so req.body.logs works on the backend
                body: JSON.stringify({ logs: currentWorkoutSession }) 
            });

            if (response.ok) {
                alert("Workout completely saved to MongoDB!");
                
                // Reset the frontend for the next workout
                currentWorkoutSession = [];
                finishWorkoutBtn.classList.add('hidden-btn');
                finishWorkoutBtn.innerText = "Finish & Save Workout";
                finishWorkoutBtn.disabled = false;
                
                // Optional: Automatically switch to the History tab
                document.querySelector('.nav-btn[data-target="history-view"]').click();
            } else {
                throw new Error("Server responded with an error");
            }

        } catch (error) {
            console.error("Error saving workout:", error);
            alert("Failed to save workout. Is your Node server running?");
            
            // Reset button if it fails
            finishWorkoutBtn.innerText = "Finish & Save Workout";
            finishWorkoutBtn.disabled = false;
        }
    });

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

                session.logs.forEach(log => {
                    const cleanMachineName = log.machine.replace('_', ' '); 
                    cardHTML += `
                        <li>
                            <span class="machine-name">${cleanMachineName} (Set ${log.set})</span>
                            <span>${log.weight}kg x ${log.reps}</span>
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
    }

    // --- Library & Dynamic Dropdowns Logic ---
    // const machineSelect = document.getElementById('machine-select');
    // const muscleSelect = document.getElementById('muscle-select'); // Ensure this is selected at the top of your file
    
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