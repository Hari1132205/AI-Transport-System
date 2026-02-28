const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// --- Vehicles Data ---
let vehicles = {
    bus1: { load: 40, lat: 37.7749, lng: -122.4194, delay: 0 },
    bus2: { load: 60, lat: 37.7849, lng: -122.4294, delay: 1 },
    train1: { load: 80, lat: 37.7649, lng: -122.4094, delay: 2 },
    train2: { load: 30, lat: 37.7549, lng: -122.4194, delay: 0 }
};

const maxCapacity = 100;
let alerts = [];
let history = []; // Store last 50 snapshots

// --- Utility Functions ---
function addAlert(message) {
    alerts.push({ time: new Date(), message });
    io.emit('newAlert', { time: new Date(), message });
}

function detectPeakHour() {
    const h = new Date().getHours();
    return (h >= 7 && h <= 9) || (h >= 17 && h <= 19);
}

// --- REST APIs ---
// Get all vehicles
app.get('/api/vehicles', (req, res) => res.json(vehicles));

// Get vehicle by ID
app.get('/api/vehicles/:id', (req, res) => {
    const v = req.params.id;
    if (vehicles[v]) res.json(vehicles[v]);
    else res.status(404).json({ error: 'Vehicle not found' });
});

// Next stop prediction
app.get('/api/next-stop/:id', (req,res)=>{
    const stops = ["Central","Main Street","Airport","Downtown","University"];
    const stop = stops[Math.floor(Math.random()*stops.length)];
    const load = Math.floor(Math.random()*120);
    const waitTime = Math.floor(load/10)+1;
    // Alert if high load
    if(load>90) addAlert(`⚠️ High predicted load at ${stop} for ${req.params.id}`);
    res.json({ stop, predictedLoad: load, waitTime });
});

// AI reroute suggestion
app.get('/api/reroute/:id', (req,res)=>{
    const routes=["Route A (Balanced Load)","Route B (Extra Vehicle Added)","Route C (Low Traffic Alternative)"];
    const suggestion = routes[Math.floor(Math.random()*routes.length)];
    res.json({ suggestion });
});

// Passenger forecast (next 6 hours)
app.get('/api/forecast/:id', (req,res)=>{
    let forecast = [];
    for(let i=0;i<6;i++){
        forecast.push(Math.floor(Math.random()*120));
    }
    res.json({ vehicle: req.params.id, forecast });
});

// Search vehicle/route
app.get('/api/search/:route', (req,res)=>{
    const route = req.params.route.toLowerCase();
    if(vehicles[route]) res.json({ vehicle: route, load: vehicles[route].load });
    else res.status(404).json({ error: 'Route not found' });
});

// Clear alerts
app.post('/api/alerts/clear', (req,res)=>{
    alerts = [];
    res.json({ success: true });
});

// --- Real-time Simulation ---
function simulateMovement() {
    let snapshot = {};
    for (const v in vehicles) {
        // Random movement
        vehicles[v].lat += (Math.random()-0.5)*0.005;
        vehicles[v].lng += (Math.random()-0.5)*0.005;
        vehicles[v].load = Math.floor(Math.random()*120);
        vehicles[v].delay = Math.floor(Math.random()*5);

        // Peak hour detection
        if(detectPeakHour()) addAlert(`⚡ Peak hour detected! Monitor ${v}`);

        // Overload detection
        if(vehicles[v].load>90) addAlert(`🚨 ${v} overloaded: ${vehicles[v].load}%`);

        snapshot[v] = {...vehicles[v]};
    }
    // Keep history of last 50 snapshots
    history.push({ time: new Date(), snapshot });
    if(history.length>50) history.shift();

    // Emit to clients
    io.emit('vehiclesUpdate', vehicles);
}

setInterval(simulateMovement, 5000);

// --- WebSocket ---
io.on('connection', socket => {
    console.log('Client connected:', socket.id);
    socket.emit('vehiclesUpdate', vehicles);
    socket.emit('alertsUpdate', alerts);

    socket.on('disconnect', ()=>console.log('Client disconnected:', socket.id));
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log(`Enhanced backend running on port ${PORT}`));