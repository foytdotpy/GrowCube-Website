// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- 1. CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyC-yv8Kk-auYf4P1sN-RdkQeY372wYcANg",
    authDomain: "growcube-10f1d.firebaseapp.com",
    databaseURL: "https://growcube-10f1d-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "growcube-10f1d",
    storageBucket: "growcube-10f1d.firebasestorage.app",
    messagingSenderId: "684838572336",
    appId: "1:684838572336:web:cbdd3cc0444874d27738f5"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// --- 2. AUTHENTICATION ---
const loginOverlay = document.getElementById('login-overlay');
const dashboard = document.getElementById('dashboard');

onAuthStateChanged(auth, (user) => {
    if (user) {
        loginOverlay.classList.add('hidden');
        dashboard.classList.remove('hidden');
        updateStatusBadge(true);
        initDashboard();
    } else {
        loginOverlay.classList.remove('hidden');
        dashboard.classList.add('hidden');
    }
});

window.login = () => {
    const email = document.getElementById('email-input').value;
    const pass = document.getElementById('pass-input').value;
    document.getElementById('login-error').innerText = "Authenticating...";
    signInWithEmailAndPassword(auth, email, pass).catch((err) => {
        document.getElementById('login-error').innerText = err.message;
    });
}

window.logout = () => signOut(auth);

// --- 3. DASHBOARD LOGIC ---
function initDashboard() {
    
    // A. SENSORS (Includes Fuzzy Status)
    onValue(ref(db, 'sensors'), (snap) => {
        const d = snap.val();
        if(d) {
            document.getElementById('val-temp').innerText = d.temperature.toFixed(1) + " °C";
            document.getElementById('val-hum').innerText = d.humidity.toFixed(1) + " %";
            document.getElementById('val-soil').innerText = d.soil_percent + " %";
            
            setFuzzyStatus('stat-temp', d.status_temp);
            setFuzzyStatus('stat-hum', d.status_hum);
            setFuzzyStatus('stat-soil', d.status_soil);
        }
    });

    // B. ACTUATORS
    onValue(ref(db, 'actuators'), (snap) => {
        const d = snap.val();
        if(d) {
            updateActuator('fan', d.fan_pwm);
            updateActuator('pump', d.pump_pwm);
            updateToggleState('mist', d.mist_status);
            updateToggleState('lamp', d.lamp_status);
        }
    });

    // C. CONTROLS (Manual/Auto)
    onValue(ref(db, 'controls'), (snap) => {
        const d = snap.val();
        if(d) {
            const isManual = d.manual_override;
            document.getElementById('manual-override-toggle').checked = isManual;
            
            const panel = document.getElementById('manual-panel');
            const overlay = document.getElementById('manual-controls');
            const modeBadge = document.getElementById('mode-display');
            
            if(isManual) {
                panel.classList.remove('disabled');
                overlay.classList.remove('disabled-overlay');
                modeBadge.innerText = "MANUAL MODE";
                modeBadge.style.color = "var(--orange)";
            } else {
                panel.classList.add('disabled');
                overlay.classList.add('disabled-overlay');
                modeBadge.innerText = "AUTO MODE";
                modeBadge.style.color = "var(--green)";
            }

            // Sync Sliders only if not dragging
            if(document.activeElement.id !== 'slider-fan') {
                document.getElementById('slider-fan').value = d.manual_fan;
                document.getElementById('label-fan').innerText = d.manual_fan;
            }
            if(document.activeElement.id !== 'slider-pump') {
                document.getElementById('slider-pump').value = d.manual_pump;
                document.getElementById('label-pump').innerText = d.manual_pump;
            }
            document.getElementById('toggle-mist').checked = d.manual_mist;
            document.getElementById('toggle-lamp').checked = d.manual_lamp;
        }
    });

    // D. DIAGNOSTICS & MEMORY (NEW FEATURE)
    onValue(ref(db, 'diagnostics'), (snap) => {
        const d = snap.val();
        if(d) {
            // Update Global Heap Badge
            if(d.total_heap_kb) {
                document.getElementById('sys-heap-badge').innerText = `Free Heap: ${d.total_heap_kb.toFixed(2)} KB`;
            }

            // Update Task Memory Bars
            updateMemoryUI('iot', d.iot_used, d.iot_total);
            updateMemoryUI('fuz', d.fuzzy_used, d.fuzzy_total);
            updateMemoryUI('sen', d.sens_used, d.sens_total);
            updateMemoryUI('mon', d.mon_used, d.mon_total);
        }
    });

    // E. SETTINGS
    onValue(ref(db, 'settings'), (snap) => {
        const d = snap.val();
        if(d) {
            document.getElementById('set-soil-min').value = d.soil_threshold_min;
            document.getElementById('set-soil-max').value = d.soil_threshold_max;
            document.getElementById('set-hum-min').value = d.hum_threshold_min;
            document.getElementById('set-hum-max').value = d.hum_threshold_max;
            document.getElementById('set-temp-min').value = d.temp_threshold_min;
            document.getElementById('set-temp-max').value = d.temp_threshold_max;
        }
    });
}

// --- HELPER FUNCTIONS ---

// 1. Memory UI Updater
function updateMemoryUI(idSuffix, used, total) {
    const elText = document.getElementById(`txt-${idSuffix}-mem`);
    const elBar = document.getElementById(`prog-${idSuffix}-mem`);
    
    if(elText && elBar) {
        // Update Text: "6321 / 8192 bytes"
        elText.innerText = `${used} / ${total} bytes`;
        
        // Calculate Percentage
        const pct = Math.min((used / total) * 100, 100);
        elBar.style.width = `${pct}%`;

        // Change Color based on usage
        if(pct > 85) {
            elBar.style.backgroundColor = "#ef4444"; // Red (Critical)
        } else if (pct > 70) {
            elBar.style.backgroundColor = "#f97316"; // Orange (Warning)
        } else {
            elBar.style.backgroundColor = "#3b82f6"; // Blue (Normal)
        }
    }
}

// 2. Actuator UI
function updateActuator(type, val) {
    document.getElementById(`mon-${type}-pwm`).innerText = val;
    const pct = (val / 255) * 100;
    document.getElementById(`bar-${type}`).style.width = `${pct}%`;
}

function updateToggleState(type, state) {
    const el = document.getElementById(`mon-${type}`);
    if(state) {
        el.innerText = "ACTIVE";
        el.className = "status-dot active";
    } else {
        el.innerText = "OFF";
        el.className = "status-dot gray";
    }
}

function setFuzzyStatus(id, text) {
    const el = document.getElementById(id);
    if(text) el.innerText = text;
}

// 3. User Actions
window.sendControl = (type, val) => {
    set(ref(db, `controls/manual_${type}`), parseInt(val));
}
window.updateLabel = (type, val) => {
    document.getElementById(`label-${type}`).innerText = val;
}
window.sendToggle = (type, state) => {
    set(ref(db, `controls/manual_${type}`), state);
}
window.saveSettings = () => {
    update(ref(db, 'settings'), {
        soil_threshold_min: parseFloat(document.getElementById('set-soil-min').value),
        soil_threshold_max: parseFloat(document.getElementById('set-soil-max').value),
        hum_threshold_min: parseFloat(document.getElementById('set-hum-min').value),
        hum_threshold_max: parseFloat(document.getElementById('set-hum-max').value),
        temp_threshold_min: parseFloat(document.getElementById('set-temp-min').value),
        temp_threshold_max: parseFloat(document.getElementById('set-temp-max').value)
    });
    alert("AI Thresholds Updated!");
}

// Mode Toggle Listener
document.getElementById('manual-override-toggle').addEventListener('change', (e) => {
    update(ref(db, 'controls'), { manual_override: e.target.checked });
});

function updateStatusBadge(online) {
    const el = document.getElementById('connection-status');
    if(online) {
        el.innerText = "Connected";
        el.className = "badge badge-online";
    } else {
        el.innerText = "Disconnected";
        el.className = "badge badge-offline";
    }
}
