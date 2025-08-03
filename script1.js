
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('./Public/rocket_scene.glb', function (gltf) {
  scene.add(gltf.scene);
}, undefined, function (error) {
  console.error('Error loading model:', error);
});



// // === Sound Effects ===
// const ignitionSound = new Audio('ignition.mp3');
// const stageSeparationSound = new Audio('stage_separation.mp3');
// // const parachuteSound = new Audio('parachute.mp3');


// === Scene Setup ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0c12);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 10); // Better viewing angle
camera.lookAt(0, 0, 0); // Ensure camera points at scene center

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("scene"), 
  antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);


// Camera preset locations and look-ats (relative to your existing scene and rocket)
const cameraPresets = {
  side:   { pos: {x: 8, y: 2, z: 0},   look: {x: 0, y: 0, z: 0}},
  top:    { pos: {x: 0, y: 20, z: 0},  look: {x: 0, y: 0, z: 0}},
  cockpit:{ pos: {x: 0, y: 1.2, z: 1}, look: {x: 0, y: 0.5, z: -1}}
};

let camTransition = null;

function animateCameraTo(preset) {
  // Cancel ongoing transition
  if(camTransition) cancelAnimationFrame(camTransition);
  let {pos, look} = cameraPresets[preset];
  const duration = 900; // ms
  const start = performance.now();

  // Store initial values
  const startPos = {...camera.position};
  const startLook = {x: 0, y: 0, z: -1};
  let lookTarget = new THREE.Vector3(look.x, look.y, look.z);

  camTransition = function animate(now) {
    let t = Math.min(1, (now - start)/duration);
    t = t < 0 ? 0 : t;

    // Interpolate position
    camera.position.x = startPos.x + (pos.x - startPos.x)*t;
    camera.position.y = startPos.y + (pos.y - startPos.y)*t;
    camera.position.z = startPos.z + (pos.z - startPos.z)*t;

    // Interpolate look-at
    let curLook = new THREE.Vector3().lerpVectors(
      camera.getWorldDirection(new THREE.Vector3()).add(camera.position),
      lookTarget,
      t
    );
    camera.lookAt(curLook);

    if(t < 1) requestAnimationFrame(camTransition);
    else camTransition = null;
  }   
  requestAnimationFrame(camTransition);
}

// Attach button listeners
document.querySelectorAll('.camera-btn').forEach(btn => {
  btn.addEventListener('click', e=>{
    animateCameraTo(btn.dataset.view);
  });
});

// Optional: Keyboard shortcuts (1=side, 2=top, 3=cockpit)
window.addEventListener("keydown", e=>{
  if(e.key === "1") animateCameraTo("side");
  if(e.key === "2") animateCameraTo("top");
  if(e.key === "3") animateCameraTo("cockpit");
});


// === Lighting ===
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// === Rocket Container ===
const rocketContainer = new THREE.Group();
scene.add(rocketContainer);

let rocket;
let isRotating = false;
let isCountingDown = false;
let isLaunching = false;
let previousMousePosition = { x: 0, y: 0 };

// === Raycasting for hover ===
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
renderer.domElement.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// === Load Rocket Model ===
loader.load(
  '.Public/rocket_scene.glb',
  (gltf) => {
    rocket = gltf.scene;
    rocket.scale.set(0.5, 0.5, 0.5);

    // const box = new THREE.Box3().setFromObject(rocket);
    // const center = box.getCenter(new THREE.Vector3());
    // rocket.position.sub(center);

    const rocketBox = new THREE.Box3().setFromObject(rocket);
    const rocketMinY = rocketBox.min.y;
    const rocketMaxY = rocketBox.max.y;
    const rocketHeight = rocketMaxY - rocketMinY;

    rocket.traverse((child) => {
      if (child.isMesh) {
        child.geometry.computeBoundingBox();
        const meshBox = child.geometry.boundingBox;
        const meshCenterY = (meshBox.min.y + meshBox.max.y) / 2 + child.position.y;
        const normalizedY = (meshCenterY - rocketMinY) / rocketHeight;

        let color = 0xffffff;
        if (normalizedY > 0.90) {
          color = 0x888888;
        } else if (normalizedY > 0.25 && normalizedY <= 0.75) {
          color = 0xff0000;
        }

        child.material = new THREE.MeshStandardMaterial({
          color: color,
          emissive: 0x222222,
          roughness: 0.3
        });
      }
    });

    const finMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const finGeometry = new THREE.BoxGeometry(0.1, 0.6, 0.3);
    const finOffsets = [
      { x: 0.35, z: 0 },
      { x: -0.35, z: 0 },
      { x: 0, z: 0.35 },
      { x: 0, z: -0.35 }
    ];
    finOffsets.forEach(offset => {
      const fin = new THREE.Mesh(finGeometry, finMaterial);
      fin.position.set(offset.x, -1, offset.z);
      rocket.add(fin);
    });

    rocketContainer.add(rocket);
  },
  undefined,
  (error) => {
    console.error('Error loading model:', error);
    createFallbackRocket();
  }
);

// === Fallback Rocket ===
function createFallbackRocket() {
  const geometry = new THREE.ConeGeometry(0.5, 2, 32);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
  rocket = new THREE.Mesh(geometry, material);
  rocketContainer.add(rocket);
}

// === Mouse Rotation ===
renderer.domElement.style.touchAction = 'none';
renderer.domElement.style.cursor = 'default';

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (isCountingDown || isLaunching || !rocket) return;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(rocket.children.length ? rocket.children : [rocket], true);

  if (intersects.length > 0) {
    isRotating = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
    renderer.domElement.style.cursor = 'grabbing';
  }
});

renderer.domElement.addEventListener('pointerup', () => {
  isRotating = false;
  renderer.domElement.style.cursor = 'default';
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (!isRotating || isCountingDown || isLaunching) return;

  const deltaX = e.clientX - previousMousePosition.x;
  const deltaY = e.clientY - previousMousePosition.y;

  rocketContainer.rotation.y += deltaX * 0.01;
  rocketContainer.rotation.x += deltaY * 0.01;
  rocketContainer.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rocketContainer.rotation.x));

  previousMousePosition = { x: e.clientX, y: e.clientY };
});

// === Countdown UI ===
const countdownElement = document.createElement('div');
countdownElement.style.position = 'absolute';
countdownElement.style.top = '50%';
countdownElement.style.left = '50%';
countdownElement.style.transform = 'translate(-50%, -50%)';
countdownElement.style.color = 'white';
countdownElement.style.fontSize = '72px';
countdownElement.style.fontWeight = 'bold';
countdownElement.style.display = 'none';
document.body.appendChild(countdownElement);

function startCountdown() {
  if (isCountingDown || isLaunching) return;

  isCountingDown = true;
  let count = 3;
  countdownElement.style.display = 'block';

  const countdownInterval = setInterval(() => {
    countdownElement.textContent = count.toString();
    if (count <= 0) {
      clearInterval(countdownInterval);
      countdownElement.style.display = 'none';
      isCountingDown = false;
      launchRocket();

        startMissionTimer(); // ⬅️ Add this line here
  // rest of launchRocket...
    }
    count--;
  }, 1000);
}

function launchRocket() {
  isLaunching = true;

  // 🔊 Play ignition sound
  ignitionSound.play();

  // 🔥 Add flame
  const flameGeometry = new THREE.ConeGeometry(0.3, 1, 32);
  const flameMaterial = new THREE.MeshBasicMaterial({
    color: 0xff6600,
    transparent: true,
    opacity: 0.8
  });
  const flame = new THREE.Mesh(flameGeometry, flameMaterial);
  flame.position.y = -1.5;
  flame.rotation.x = Math.PI;
  rocketContainer.add(flame);

  // 🔥 Flame flicker
  const flicker = setInterval(() => {
    flame.scale.y = 0.8 + Math.random() * 0.4;
  }, 100);

  // 🕒 Launch animation (smooth)
  const startTime = Date.now();
  const duration = 3000;

  function animateLaunch() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    rocketContainer.position.y = progress * 10;
    const scale = 0.5 + progress * 0.5;
    rocketContainer.scale.set(scale, scale, scale);

    if (progress < 1) {
      requestAnimationFrame(animateLaunch);
    } else {
      clearInterval(flicker);
      rocketContainer.remove(flame);

      // 🚀 Simulate stage separation after 2s
      setTimeout(() => {
        stageSeparationSound.play();
        updateStageStatus(1, 'Completed');
        updateStageStatus(2, 'Active');

        // Optional: visually separate stage (e.g., move part of rocket)
      }, 2000);

      // // 🪂 Deploy parachute after 6s
      // setTimeout(() => {
      //   parachuteSound.play();
      //   updateStageStatus(2, 'Completed');
      //   updateStageStatus(3, 'Active');

      //   // Optional: parachute visual
      // }, 6000);

      // Reset rocket (optional)
      setTimeout(resetRocket, 8000);
    }
  }

  animateLaunch();
}


function resetRocket() {
  isLaunching = false;
  rocketContainer.position.y = 0;
  rocketContainer.scale.set(0.5, 0.5, 0.5);
}

// === Auto Rotate ===
let isAutoRotating = false;
let autoRotateStart = 0;
let autoRotateSpeed = 0.02;
let autoRotateTarget = Math.PI * 2;

window.startAutoRotate = function () {
  if (isAutoRotating || isLaunching || isCountingDown) return;
  isAutoRotating = true;
  autoRotateStart = rocketContainer.rotation.y;
};

// === Resize Handling ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// === Joystick Setup ===
const joystickZone = document.getElementById('joystick-zone');
const joystick = nipplejs.create({
  zone: joystickZone,
  mode: 'static',
  position: { left: 60, top: 60 },
  color: 'white',
  size: 100
});

let joystickRotation = { x: 0, y: 0 };

joystick.on('move', (evt, data) => {
  const angle = data.angle?.radian || 0;
  const distance = data.distance || 0;

  joystickRotation.x = Math.sin(angle) * distance * 0.002;
  joystickRotation.y = -Math.cos(angle) * distance * 0.002;
});

joystick.on('end', () => {
  joystickRotation.x = 0;
  joystickRotation.y = 0;
});

// === Device Orientation ===
// === Device Orientation Handler ===
// function handleOrientation(e) {
//   const beta = e.beta || 0;   // front-back tilt
//   const gamma = e.gamma || 0; // left-right tilt

//   const tiltX = THREE.MathUtils.degToRad(beta - 45);  // calibrate
//   const tiltY = THREE.MathUtils.degToRad(gamma);

//   rocketContainer.rotation.x = THREE.MathUtils.clamp(tiltX, -Math.PI / 3, Math.PI / 3);
//   rocketContainer.rotation.y = THREE.MathUtils.clamp(tiltY, -Math.PI / 2, Math.PI / 2);
// }

// // === Device Orientation Permission Request ===
// window.requestDeviceOrientation = async function () {
//   if (typeof DeviceOrientationEvent !== "undefined" &&
//       typeof DeviceOrientationEvent.requestPermission === "function") {
//     try {
//       const permissionState = await DeviceOrientationEvent.requestPermission();
//       if (permissionState === "granted") {
//         window.addEventListener("deviceorientation", handleOrientation);
//       } else {
//         alert("Permission denied.");
//       }
//     } catch (err) {
//       console.error(err);
//     }
//   } else if ("DeviceOrientationEvent" in window) {
//     window.addEventListener("deviceorientation", handleOrientation);
//   } else {
//     alert("Device orientation not supported.");
//   }
// };

// === Animation Loop ===
function animate() {
  requestAnimationFrame(animate);

  // Joystick blending
  rocketContainer.rotation.y += joystickRotation.x;
  rocketContainer.rotation.x += joystickRotation.y;
  rocketContainer.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rocketContainer.rotation.x));

  if (isAutoRotating) {
    rocketContainer.rotation.y += autoRotateSpeed;
    if (rocketContainer.rotation.y - autoRotateStart >= autoRotateTarget) {
      isAutoRotating = false;
    }
  }

  // Hover effects
  if (rocket && !isRotating && !isLaunching && !isCountingDown) {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(rocket.children.length ? rocket.children : [rocket], true);
    renderer.domElement.style.cursor = intersects.length > 0 ? 'grab' : 'default';
  }

  renderer.render(scene, camera);
}
animate();

// === UI Launch Button ===
document.querySelector('.btn-launch')?.addEventListener('click', startCountdown);

// === Random Info Box Values ===
setInterval(() => {
  const getRandom = (min, max, decimals = 0) =>
    (Math.random() * (max - min) + min).toFixed(decimals);

  document.querySelector('.box-rank div:last-child').textContent = getRandom(3.5, 5.0, 1);
  document.querySelector('.box-speed div:last-child').textContent = getRandom(80, 150);
  document.querySelector('.box-agent div:last-child').textContent = getRandom(1, 5);
  document.querySelector('.box-aerot div:last-child').textContent = getRandom(30, 60);
}, 500);
document.getElementById('permission-btn')?.addEventListener('click', () => {
  requestDeviceOrientation();  // this calls the tilt listener
});


// ===== Altitude Chart Setup =====
const ctx = document.getElementById('altitudeChart').getContext('2d');

// Custom plugin to draw rocket at latest point
// ===== Chart.js Rocket Plugin =====
const rocketMarkerPlugin = {
  id: 'rocketMarker',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea, scales: { x, y } } = chart;
    const data = chart.data.datasets[0].data;
    const labels = chart.data.labels;

    if (!data.length) return;

    const lastIndex = data.length - 1;
    const xPixel = x.getPixelForValue(labels[lastIndex]);
    const yPixel = y.getPixelForValue(data[lastIndex]);

    const topBuffer = chartArea.top + 30;
    const drawBelow = yPixel < topBuffer;

    ctx.save();
    ctx.font = '22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🚀', xPixel, drawBelow ? yPixel + 25 : yPixel - 12);
    ctx.restore();
  }
};

// ===== Altitude Chart Setup =====
const altitudeCtx = document.getElementById('altitudeChart').getContext('2d');


const altitudeData = {
  labels: [],
  datasets: [{
    label: 'Altitude (m)',
    data: [],
    borderColor: 'cyan',
    backgroundColor: 'rgba(0,255,255,0.2)',
    tension: 0.3,
    pointRadius: 2
  }]
};

const altitudeChart = new Chart(altitudeCtx,{
  type: 'line',
  data: altitudeData,
  options: {
    responsive: true,
    animation: false,
    layout: {
      padding: {
        top: 60  // Ensure room for rocket emoji above line
      }
    },
    plugins: {
      legend: {
        labels: {
          color: '#fff',
          boxWidth: 12,
          font: {
            size: 12
          }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#aaa' },
        title: { display: true, text: 'Time (s)', color: '#ccc' }
      },
      y: {
        beginAtZero: true,
        ticks: { color: '#aaa' },
        title: { display: true, text: 'Altitude (m)', color: '#ccc' }
      }
    }
  },
  plugins: [rocketMarkerPlugin]
});

// ===== Simulate Random Altitude Increase =====
let time = 0;
let currentAltitude = 0;

setInterval(() => {
  time++;
  currentAltitude += Math.floor(Math.random() * 40 + 10); // Random 10–50m rise

  if (altitudeData.labels.length > 30) {
    altitudeData.labels.shift();
    altitudeData.datasets[0].data.shift();
  }

  altitudeData.labels.push(time);
  altitudeData.datasets[0].data.push(currentAltitude);
  altitudeChart.update();
}, 1000);









// ===== Velocity Chart Setup =====
const velocityCtx = document.getElementById('velocityChart').getContext('2d');

// ===== Chart.js Rocket Plugin for Velocity (optional, same emoji) =====
const velocityRocketMarkerPlugin = {
  id: 'velocityRocketMarker',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea, scales: { x, y } } = chart;
    const data = chart.data.datasets[0].data;
    const labels = chart.data.labels;

    if (!data.length) return;

    const lastIndex = data.length - 1;
    const xPixel = x.getPixelForValue(labels[lastIndex]);
    const yPixel = y.getPixelForValue(data[lastIndex]);

    const topBuffer = chartArea.top + 30;
    const drawBelow = yPixel < topBuffer;

    ctx.save();
    ctx.font = '22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🚀', xPixel, drawBelow ? yPixel + 25 : yPixel - 12);
    ctx.restore();
  }
};

// ===== Velocity Chart Data =====
const velocityData = {
  labels: [],
  datasets: [{
    label: 'Velocity (m/s)',
    data: [],
    borderColor: 'lime',
    backgroundColor: 'rgba(0,255,0,0.2)',
    tension: 0.3,
    pointRadius: 2
  }]
};

// ===== Velocity Chart Config =====
const velocityChart = new Chart(velocityCtx, {
  type: 'line',
  data: velocityData,
  options: {
    responsive: true,
    animation: false,
    layout: {
      padding: {
        top: 60
      }
    },
    plugins: {
      legend: {
        labels: {
          color: '#fff',
          boxWidth: 12,
          font: { size: 12 }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#aaa' },
        title: { display: true, text: 'Time (s)', color: '#ccc' }
      },
      y: {
        beginAtZero: true,
        ticks: { color: '#aaa' },
        title: { display: true, text: 'Velocity (m/s)', color: '#ccc' }
      }
    }
  },
  plugins: [velocityRocketMarkerPlugin]  // Optional for emoji
});

// ===== Simulate Random Velocity Updates =====
let velocityTime = 0;

setInterval(() => {
  velocityTime++;
  const randomVelocity = Math.floor(Math.random() * 20 + 5); // Random 5–25 m/s

  if (velocityData.labels.length > 30) {
    velocityData.labels.shift();
    velocityData.datasets[0].data.shift();
  }

  velocityData.labels.push(velocityTime);
  velocityData.datasets[0].data.push(randomVelocity);
  velocityChart.update();
}, 1000);





// ===== Fuel Chart Setup =====
const fuelCtx = document.getElementById('fuelChart').getContext('2d');

// ===== Chart.js Rocket Plugin for Fuel (optional) =====
const fuelRocketMarkerPlugin = {
  id: 'fuelRocketMarker',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea, scales: { x, y } } = chart;
    const data = chart.data.datasets[0].data;
    const labels = chart.data.labels;

    if (!data.length) return;

    const lastIndex = data.length - 1;
    const xPixel = x.getPixelForValue(labels[lastIndex]);
    const yPixel = y.getPixelForValue(data[lastIndex]);

    const topBuffer = chartArea.top + 30;
    const drawBelow = yPixel < topBuffer;

    ctx.save();
    ctx.font = '22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🚀', xPixel, drawBelow ? yPixel + 25 : yPixel - 12);
    ctx.restore();
  }
};

// ===== Fuel Chart Data =====
const fuelData = {
  labels: [],
  datasets: [{
    label: 'Fuel Level (%)',
    data: [],
    borderColor: 'orange',
    backgroundColor: 'rgba(255,165,0,0.2)',
    tension: 0.3,
    pointRadius: 2
  }]
};

// ===== Fuel Chart Config =====
const fuelChart = new Chart(fuelCtx, {
  type: 'line',
  data: fuelData,
  options: {
    responsive: true,
    animation: false,
    layout: {
      padding: {
        top: 60
      }
    },
    plugins: {
      legend: {
        labels: {
          color: '#fff',
          boxWidth: 12,
          font: { size: 12 }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#aaa' },
        title: { display: true, text: 'Time (s)', color: '#ccc' }
      },
      y: {
        min: 0,
        max: 100,
        ticks: { color: '#aaa' },
        title: { display: true, text: 'Fuel Level (%)', color: '#ccc' }
      }
    }
  },
  plugins: [fuelRocketMarkerPlugin]  // Optional
});

// ===== Simulate Fuel Consumption =====
let fuelTime = 0;
let currentFuel = 100;

setInterval(() => {
  fuelTime++;
  currentFuel = Math.max(0, currentFuel - Math.floor(Math.random() * 5 + 1)); // Drop 1–5%

  if (fuelData.labels.length > 30) {
    fuelData.labels.shift();
    fuelData.datasets[0].data.shift();
  }

  fuelData.labels.push(fuelTime);
  fuelData.datasets[0].data.push(currentFuel);
  fuelChart.update();
}, 1000);


let missionStartTime = null;
const missionTimerElement = document.getElementById("mission-timer");

function startMissionTimer() {
  missionStartTime = Date.now();

  setInterval(() => {
    if (!missionStartTime) return;
    const elapsed = Date.now() - missionStartTime;

    const hours = String(Math.floor(elapsed / 3600000)).padStart(2, '0');
    const minutes = String(Math.floor((elapsed % 3600000) / 60000)).padStart(2, '0');
    const seconds = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');

    missionTimerElement.textContent = `${hours}:${minutes}:${seconds}`;
  }, 1000);
}




// const thrustSlider = document.getElementById("thrust-slider");
// const thrustValueText = document.getElementById("thrust-value");

// let currentThrust = 50;

// thrustSlider.addEventListener("input", () => {
//   currentThrust = parseInt(thrustSlider.value);
//   thrustValueText.textContent = `${currentThrust}%`;

//   // Optionally: Apply this value to flame or motion intensity
//   updateRocketThrustVisual(currentThrust);
// });

// // Optional function for visual response
// function updateRocketThrustVisual(thrust) {
//   // You could adjust flame size, sound volume, speed, etc.
//   console.log("Current thrust:", thrust);
// }



const stage1Status = document.getElementById('stage1');
const stage2Status = document.getElementById('stage2');
const stage3Status = document.getElementById('stage3');

function updateStageStatus(stage, status) {
  const element = document.getElementById(`stage${stage}`);
  if (element) {
    element.textContent = status;
    if (status === 'Active') {
      element.style.color = 'lime';
    } else if (status === 'Completed') {
      element.style.color = 'gray';
    } else {
      element.style.color = 'orange';
    }
  }
}

// Example simulation: Stage progression
setTimeout(() => updateStageStatus(1, 'Active'), 1000);       // Stage 1: Active
setTimeout(() => updateStageStatus(1, 'Completed'), 5000);    // Stage 1: Completed
setTimeout(() => updateStageStatus(2, 'Active'), 5000);       // Stage 2: Active
setTimeout(() => updateStageStatus(2, 'Completed'), 9000);    // Stage 2: Completed
setTimeout(() => updateStageStatus(3, 'Active'), 9000);       // Stage 3: Active



//for real time data

const windEl = document.getElementById('wind');
const temperatureEl = document.getElementById('temperature');
const gravityEl = document.getElementById('gravity');

// Fetch real-time data from Open-Meteo API
async function fetchEnvironmentData(lat, lon) {
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m`);
    const data = await response.json();
    const weather = data.current;

    windEl.textContent = `${weather.wind_speed_10m} km/h, ${weather.wind_direction_10m}°`;
    temperatureEl.textContent = `${weather.temperature_2m} °C`;

    // Gravity remains simulated or fixed (optional Earth-like or Moon/Mars)
    const gravity = 100; // Assume Earth gravity = 100%
    gravityEl.textContent = `${gravity} %`;
  } catch (error) {
    console.error("Failed to fetch weather:", error);
    windEl.textContent = `-- km/h, --°`;
    temperatureEl.textContent = `-- °C`;
    gravityEl.textContent = `-- %`;
  }
}

// Try to get user location
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      fetchEnvironmentData(latitude, longitude);
      setInterval(() => fetchEnvironmentData(latitude, longitude), 60000); // update every 60s
    },
    (error) => {
      console.warn("Geolocation denied or failed, using default location.");
      // Default to Delhi
      fetchEnvironmentData(28.6139, 77.2090);
      setInterval(() => fetchEnvironmentData(28.6139, 77.2090), 60000);
    }
  );
} else {
  // No geolocation support
  fetchEnvironmentData(28.6139, 77.2090); // default to Delhi
}
// Example data structure for rockets
const rocketDatabase = {
  falcon9: {
    name: "Falcon 9",
    maker: "SpaceX",
    firstLaunch: "June 4, 2010",
    height: "70 m",
    diameter: "3.7 m",
    mass: "549,054 kg",
    payloadLEO: "22,800 kg",
    desc: "Two-stage rocket designed and manufactured by SpaceX for reliable and safe transport of satellites and the Dragon spacecraft into orbit."
  },
  saturnV: {
    name: "Saturn V",
    maker: "NASA",
    firstLaunch: "November 9, 1967",
    height: "110.6 m",
    diameter: "10.1 m",
    mass: "2,970,000 kg",
    payloadLEO: "140,000 kg",
    desc: "A multi-stage heavy lift launch vehicle used by NASA between 1967 and 1973, famous for launching Apollo and Skylab missions."
  }
  // Add more rockets as needed
};

// If you have a way to select rocket type, call this when changed:
function updateRocketDetails(rocketKey) {
  const rocket = rocketDatabase[rocketKey];
  if (!rocket) return;

  document.getElementById("rocket-name").textContent = rocket.name;
  document.getElementById("rocket-maker").textContent = rocket.maker;
  document.getElementById("rocket-first-launch").textContent = rocket.firstLaunch;
  document.getElementById("rocket-height").textContent = rocket.height;
  document.getElementById("rocket-diameter").textContent = rocket.diameter;
  document.getElementById("rocket-mass").textContent = rocket.mass;
  document.getElementById("rocket-payload-leo").textContent = rocket.payloadLEO;
  document.getElementById("rocket-desc").textContent = rocket.desc;
}

// Example: updateRocketDetails('saturnV');
// === Mission Log Event Function ===
function addMissionEvent(label, extra = '') {
  const logList = document.getElementById('mission-log-list');
  if (!logList) return;

  const currentTime = getMissionTimestamp(); // You can customize to match your timer
  const li = document.createElement('li');
  li.innerHTML = `<strong>${currentTime}</strong> — ${label}${extra ? ` <span style="color:#aaa">(${extra})</span>` : ''}`;
  logList.prepend(li); // Newest on top

  // Limit log to latest 25 messages
  if (logList.children.length > 25) {
    logList.removeChild(logList.lastChild);
  }
}

// === Example: Mock Mission Time Based on Launch (T+ Format) ===
const launchStartTime = Date.now(); // store launch time when user launches rocket

function getMissionTimestamp() {
  const elapsedMs = Date.now() - launchStartTime;
  const totalSec = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `T+${pad(minutes)}:${pad(seconds)}`;
}

function pad(n) {
  return n < 10 ? '0' + n : n;
}

// === Example Usage: Trigger Events in Sequence ===
// Call these from within your simulation logic at the right moments
setTimeout(() => addMissionEvent("Liftoff 🚀", "All systems go"), 0);
setTimeout(() => addMissionEvent("Max Q", "Max dynamic pressure"), 15000);
setTimeout(() => addMissionEvent("MECO", "Main Engine Cutoff"), 28000);
setTimeout(() => addMissionEvent("Stage Separation", "Stage 2 ignition started"), 30000);
setTimeout(() => addMissionEvent("Payload Fairing Jettisoned"), 40000);
setTimeout(() => addMissionEvent("Orbit Achieved 🛰️", "LEO insertion complete"), 60000);
