// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- 1. FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyC-yv8Kk-auYf4P1sN-RdkQeY372wYcANg",
    authDomain: "growcube-10f1d.firebaseapp.com",
    databaseURL: "https://growcube-10f1d-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "growcube-10f1d",
    storageBucket: "growcube-10f1d.firebasestorage.app",
    messagingSenderId: "684838572336",
    appId: "1:684838572336:web:cbdd3cc0444874d27738f5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// --- 2. AUTHENTICATION LOGIC ---
const loginOverlay = document.getElementById('login-overlay');
const dashboard = document.getElementById('dashboard');

// Cek Status Login
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginOverlay.classList.add('hidden');
        dashboard.classList.remove('hidden');
        updateConnectionStatus(true);
        startListening();
    } else {
        loginOverlay.classList.remove('hidden');
        dashboard.classList.add('hidden');
    }
});

// Fungsi Login
window.login = () => {
    const email = document.getElementById('email-input').value;
    const pass = document.getElementById('pass-input').value;
    const errText = document.getElementById('login-error');

    errText.innerText = "Logging in...";
    
    signInWithEmailAndPassword(auth, email, pass)
        .catch((error) => {
            errText.innerText = "Error: " + error.message;
        });
}

// Fungsi Logout
window.logout = () => {
    signOut(auth);
}

// --- 3. REALTIME DATA LISTENING ---
function startListening() {
    
    // A. MONITORING SENSORS
    const sensorsRef = ref(db, 'sensors');
    onValue(sensorsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            document.getElementById('val-temp').innerText = data.temperature.toFixed(1) + " °C";
            document.getElementById('val-hum').innerText = data.humidity.toFixed(1) + " %";
            document.getElementById('val-soil').innerText = data.soil_percent + " %";
        }
    });

    // B. CONTROL STATUS
    const controlsRef = ref(db, 'controls');
    onValue(controlsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const isManual = data.manual_override;
            document.getElementById('manual-override-toggle').checked = isManual;
            
            const modeText = document.getElementById('mode-text');
            const manualPanel = document.getElementById('manual-panel');
            
            if (isManual) {
                modeText.innerText = "MANUAL CONTROL";
                manualPanel.classList.remove('disabled');
            } else {
                modeText.innerText = "AUTO (AI FUZZY LOGIC)";
                manualPanel.classList.add('disabled');
            }

            // Update Input Values jika tidak sedang fokus
            if(document.activeElement.id !== 'slider-fan') {
                document.getElementById('slider-fan').value = data.manual_fan;
                document.getElementById('label-fan').innerText = data.manual_fan;
            }
            if(document.activeElement.id !== 'slider-pump') {
                document.getElementById('slider-pump').value = data.manual_pump;
                document.getElementById('label-pump').innerText = data.manual_pump;
            }
            document.getElementById('toggle-mist').checked = data.manual_mist;
            document.getElementById('toggle-lamp').checked = data.manual_lamp;
        }
    });

    // C. SETTINGS STATUS (UPDATED for 6 VARIABLES)
    const settingsRef = ref(db, 'settings');
    onValue(settingsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            // Soil
            document.getElementById('set-soil-min').value = data.soil_threshold_min;
            document.getElementById('set-soil-max').value = data.soil_threshold_max;
            // Humidity
            document.getElementById('set-hum-min').value = data.hum_threshold_min;
            document.getElementById('set-hum-max').value = data.hum_threshold_max;
            // Temperature
            document.getElementById('set-temp-min').value = data.temp_threshold_min;
            document.getElementById('set-temp-max').value = data.temp_threshold_max;
        }
    });
}

// --- 4. CONTROL FUNCTIONS ---

// Mode Toggle
document.getElementById('manual-override-toggle').addEventListener('change', (e) => {
    update(ref(db, 'controls'), { manual_override: e.target.checked });
});

// Slider Helpers
window.updateLabel = (type, val) => {
    document.getElementById('label-' + type).innerText = val;
}

// Send PWM Control
window.sendControl = (type, val) => {
    const path = 'controls/manual_' + type;
    set(ref(db, path), parseInt(val));
}

// Send Toggle Control
window.sendToggle = (type, state) => {
    const path = 'controls/manual_' + type;
    set(ref(db, path), state);
}

// Save Settings (UPDATED)
window.saveSettings = () => {
    // Ambil semua 6 nilai dari input
    const sMin = parseFloat(document.getElementById('set-soil-min').value);
    const sMax = parseFloat(document.getElementById('set-soil-max').value);
    
    const hMin = parseFloat(document.getElementById('set-hum-min').value);
    const hMax = parseFloat(document.getElementById('set-hum-max').value);
    
    const tMin = parseFloat(document.getElementById('set-temp-min').value);
    const tMax = parseFloat(document.getElementById('set-temp-max').value);

    // Update ke Firebase
    update(ref(db, 'settings'), {
        soil_threshold_min: sMin,
        soil_threshold_max: sMax,
        hum_threshold_min: hMin,
        hum_threshold_max: hMax,
        temp_threshold_min: tMin,
        temp_threshold_max: tMax
    }).then(() => {
        alert("All Thresholds Saved to Cloud!");
    }).catch((error) => {
        alert("Error saving: " + error.message);
    });
}

// UI Helper
function updateConnectionStatus(online) {
    const el = document.getElementById('connection-status');
    if (online) {
        el.innerText = "Connected";
        el.classList.remove('offline');
        el.classList.add('online');
    }
}
