// Import Firebase SDK (menggunakan URL CDN agar tidak perlu instalasi Node.js)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- 1. FIREBASE CONFIGURATION (DATA ANDA) ---
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
        // User Login -> Tampilkan Dashboard
        loginOverlay.classList.add('hidden');
        dashboard.classList.remove('hidden');
        updateConnectionStatus(true);
        startListening(); // Mulai baca data
    } else {
        // User Logout -> Tampilkan Login
        loginOverlay.classList.remove('hidden');
        dashboard.classList.add('hidden');
    }
});

// Fungsi Login (Dipanggil tombol HTML)
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
    
    // A. MONITORING SENSORS (/sensors)
    const sensorsRef = ref(db, 'sensors');
    onValue(sensorsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            // Update UI
            document.getElementById('val-temp').innerText = data.temperature.toFixed(1) + " °C";
            document.getElementById('val-hum').innerText = data.humidity.toFixed(1) + " %";
            document.getElementById('val-soil').innerText = data.soil_percent + " %";
        }
    });

    // B. MONITORING STATUS STRINGS (from ESP32 actuators feedback)
    // Sebenarnya ESP32 update status string di variabel internal,
    // Jika kita ingin tampilkan status teks (OPTIMAL/KERING), kita harus kirim string itu ke Firebase.
    // Tapi karena JSON ESP32 tadi belum kirim string, kita buat logic visual di JS saja.
    // (Optional: Bisa ditambahkan nanti di ESP32 json.set("stat_soil", ...))

    // C. CONTROL STATUS (/controls)
    const controlsRef = ref(db, 'controls');
    onValue(controlsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            // Update Toggle Auto/Manual
            const isManual = data.manual_override;
            document.getElementById('manual-override-toggle').checked = isManual;
            
            // Update UI Mode Text
            const modeText = document.getElementById('mode-text');
            const manualPanel = document.getElementById('manual-panel');
            
            if (isManual) {
                modeText.innerText = "MANUAL CONTROL";
                manualPanel.classList.remove('disabled');
            } else {
                modeText.innerText = "AUTO (AI FUZZY LOGIC)";
                manualPanel.classList.add('disabled');
            }

            // Update Input Values (Sync with DB incase changed elsewhere)
            // Hanya update jika elemen tidak sedang difokuskan (agar slider tidak loncat saat digeser)
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

    // D. SETTINGS STATUS (/settings)
    const settingsRef = ref(db, 'settings');
    onValue(settingsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            document.getElementById('set-temp-max').value = data.temp_threshold_max;
            document.getElementById('set-soil-min').value = data.soil_threshold_min;
            document.getElementById('set-soil-max').value = data.soil_threshold_max;
        }
    });
}

// --- 4. CONTROL FUNCTIONS ---

// Mode Toggle
document.getElementById('manual-override-toggle').addEventListener('change', (e) => {
    update(ref(db, 'controls'), {
        manual_override: e.target.checked
    });
});

// Slider Helpers (Tampilkan angka saat geser)
window.updateLabel = (type, val) => {
    document.getElementById('label-' + type).innerText = val;
}

// Send PWM Control (Fan/Pump)
window.sendControl = (type, val) => {
    const path = 'controls/manual_' + type;
    set(ref(db, path), parseInt(val));
}

// Send Toggle Control (Mist/Lamp)
window.sendToggle = (type, state) => {
    const path = 'controls/manual_' + type;
    set(ref(db, path), state);
}

// Save Settings
window.saveSettings = () => {
    const tMax = parseFloat(document.getElementById('set-temp-max').value);
    const sMin = parseFloat(document.getElementById('set-soil-min').value);
    const sMax = parseFloat(document.getElementById('set-soil-max').value);

    update(ref(db, 'settings'), {
        temp_threshold_max: tMax,
        soil_threshold_min: sMin,
        soil_threshold_max: sMax
    }).then(() => {
        alert("Settings Saved to Cloud!");
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