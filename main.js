import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { biologyFacts } from './data.js';

// ---- DOM Elements ----
const container = document.getElementById('canvas-container');
const infoPanel = document.getElementById('info-panel');
const closeBtn = document.getElementById('close-btn');
const factTitle = document.getElementById('fact-title');
const factDesc = document.getElementById('fact-desc');
const factCategory = document.getElementById('fact-category');
const loader = document.getElementById('loader');
const progressFill = document.getElementById('discovery-progress');
const factCounter = document.getElementById('fact-counter');
const btnDna = document.getElementById('btn-dna');
const btnTour = document.getElementById('btn-tour');

const diagramModal = document.getElementById('diagram-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const modalCategory = document.getElementById('modal-category');
const modalDiagram = document.getElementById('modal-diagram');

// State
let discoveredFacts = new Set();
let tourMode = false;
let tourIndex = 0;
let tourTimeout;

// ---- Three.js Setup ----
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020617, 0.015);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 40);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 10;
controls.maxDistance = 80;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

const pointLight1 = new THREE.PointLight(0x0ea5e9, 2, 100);
pointLight1.position.set(10, 20, 10);
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0x22c55e, 2, 100);
pointLight2.position.set(-10, -20, -10);
scene.add(pointLight2);

// ---- DNA Helix Construction ----
const dnaGroup = new THREE.Group();
const nodes = [];
const numPairs = 15; // 15 pairs = 30 total nodes
const radius = 4;
const verticalSpacing = 2.5;
const angularOffset = Math.PI / 4;

// Materials
const matNormal = new THREE.MeshPhysicalMaterial({
    color: 0x94a3b8,
    metalness: 0.1,
    roughness: 0.2,
    transmission: 0.5,
    thickness: 0.5,
    emissive: 0x000000
});

const matHover = matNormal.clone();
matHover.emissive.setHex(0x0ea5e9);
matHover.emissiveIntensity = 0.8;

const matDiscovered = matNormal.clone();
matDiscovered.color.setHex(0x22c55e);
matDiscovered.emissive.setHex(0x22c55e);
matDiscovered.emissiveIntensity = 0.5;

let factIndex = 0;

for (let i = 0; i < numPairs; i++) {
    const y = (i - numPairs / 2) * verticalSpacing;
    const angle = i * angularOffset;

    // Node 1
    const x1 = Math.cos(angle) * radius;
    const z1 = Math.sin(angle) * radius;
    createNode(x1, y, z1, factIndex++);

    // Node 2
    const x2 = Math.cos(angle + Math.PI) * radius;
    const z2 = Math.sin(angle + Math.PI) * radius;
    createNode(x2, y, z2, factIndex++);

    // Connecting Bar
    const materialLine = new THREE.MeshBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.5 });
    const geometryLine = new THREE.CylinderGeometry(0.1, 0.1, radius * 2);
    const line = new THREE.Mesh(geometryLine, materialLine);
    line.position.set(0, y, 0);
    line.rotation.z = Math.PI / 2;
    line.rotation.y = -angle;
    dnaGroup.add(line);
}

scene.add(dnaGroup);

function createNode(x, y, z, index) {
    if (index >= biologyFacts.length) return;
    
    const geometry = new THREE.SphereGeometry(0.8, 32, 32);
    const mesh = new THREE.Mesh(geometry, matNormal.clone());
    mesh.position.set(x, y, z);
    
    // Attach fact data
    mesh.userData = { 
        fact: biologyFacts[index],
        originalMaterial: mesh.material,
        isDiscovered: false
    };
    
    dnaGroup.add(mesh);
    nodes.push(mesh);
}

// Background Particles
const particleGeom = new THREE.BufferGeometry();
const particleCount = 500;
const posArray = new Float32Array(particleCount * 3);
for(let i=0; i<particleCount*3; i++) {
    posArray[i] = (Math.random() - 0.5) * 100;
}
particleGeom.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particleMat = new THREE.PointsMaterial({ size: 0.1, color: 0x0ea5e9, transparent: true, opacity: 0.5});
const particles = new THREE.Points(particleGeom, particleMat);
scene.add(particles);

// ---- Interaction: Raycasting ----
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredNode = null;

window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('click', (e) => {
    // Avoid triggering when clicking UI elements or if modal is already open
    if (e.target.closest('button') || e.target.closest('.glass-panel') || e.target.closest('.glass-panel-large') || !diagramModal.classList.contains('hidden')) {
        return;
    }

    if (hoveredNode) {
        if (tourMode) {
            tourMode = false;
            btnTour.textContent = "Start Guided Tour";
            btnTour.classList.remove('active');
            btnDna.classList.add('active');
            clearTimeout(tourTimeout);
        }
        displayFact(hoveredNode, true);
    }
});

function displayFact(node, openWindow = false) {
    const fact = node.userData.fact;
    
    // Update Node Appearance
    if (!node.userData.isDiscovered) {
        node.userData.isDiscovered = true;
        node.userData.originalMaterial = matDiscovered.clone();
        node.material = node.userData.originalMaterial;
        discoveredFacts.add(fact.id);
        updateProgress();
    }

    // Update UI
    factCategory.textContent = fact.category;
    factTitle.textContent = fact.title;
    factDesc.textContent = fact.description;
    
    infoPanel.classList.remove('hidden');

    if (openWindow) {
        modalCategory.textContent = fact.category;
        modalTitle.textContent = fact.title;
        modalDesc.textContent = fact.description;
        const encodedTitle = encodeURIComponent(fact.title);
        // Generates a nice placeholder diagram
        modalDiagram.src = `https://placehold.co/1200x600/0f172a/0ea5e9?font=montserrat&text=Detailed+Diagram:+${encodedTitle}`;
        diagramModal.classList.remove('hidden');
    }

    // Camera Animation to Node
    const targetY = node.position.y;
    // Animate camera height smoothly (dummy approach for vanilla js)
    const animateCam = () => {
        camera.position.y += (targetY - camera.position.y) * 0.05;
        controls.target.y += (targetY - controls.target.y) * 0.05;
        if(Math.abs(targetY - camera.position.y) > 0.1) {
            requestAnimationFrame(animateCam);
        }
    };
    animateCam();
}

function updateProgress() {
    const count = discoveredFacts.size;
    const total = biologyFacts.length; // 30
    factCounter.textContent = `${count} / ${total} Discovered`;
    progressFill.style.width = `${(count / total) * 100}%`;
    
    if (count === total) {
        alert("🎉 Congratulations! You have fully explored the 3D Biology Atlas.");
    }
}

// ---- UI Listeners ----
closeBtn.addEventListener('click', () => {
    infoPanel.classList.add('hidden');
});

closeModalBtn.addEventListener('click', () => {
    diagramModal.classList.add('hidden');
});

diagramModal.addEventListener('click', (e) => {
    if (e.target === diagramModal) {
        diagramModal.classList.add('hidden');
    }
});

btnTour.addEventListener('click', () => {
    tourMode = !tourMode;
    if (tourMode) {
        btnTour.textContent = "Stop Tour";
        btnTour.classList.add('active');
        btnDna.classList.remove('active');
        startTour();
    } else {
        btnTour.textContent = "Start Guided Tour";
        btnTour.classList.remove('active');
        btnDna.classList.add('active');
        clearTimeout(tourTimeout);
    }
});

btnDna.addEventListener('click', () => {
    tourMode = false;
    btnTour.textContent = "Start Guided Tour";
    btnTour.classList.remove('active');
    btnDna.classList.add('active');
    clearTimeout(tourTimeout);
});

function startTour() {
    if(!tourMode) return;
    if(tourIndex >= nodes.length) tourIndex = 0;
    
    displayFact(nodes[tourIndex], false);
    tourIndex++;
    
    tourTimeout = setTimeout(startTour, 4000);
}

// ---- Animation Loop ----
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    controls.update();
    
    if(!tourMode) {
        // Slow auto-rotate
        dnaGroup.rotation.y += 0.002;
    }

    // Particles subtle motion
    particles.rotation.y = elapsedTime * 0.05;
    particles.rotation.x = elapsedTime * 0.02;

    // Raycast Logic
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(nodes);

    if (intersects.length > 0) {
        const object = intersects[0].object;
        if (hoveredNode !== object) {
            if (hoveredNode) hoveredNode.material = hoveredNode.userData.originalMaterial;
            hoveredNode = object;
            hoveredNode.material = matHover;
            document.body.style.cursor = 'pointer';
        }
    } else {
        if (hoveredNode) {
            hoveredNode.material = hoveredNode.userData.originalMaterial;
            hoveredNode = null;
            document.body.style.cursor = 'default';
        }
    }

    renderer.render(scene, camera);
}

// ---- Resize Handler ----
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Remove Loader
window.onload = () => {
    setTimeout(() => {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 1000);
    }, 1500); // 1.5s artificial delay for 'synthesis' effect
    
    // Initial UI state setup for the 10 fixes / robust requirements
    updateProgress();
};

animate();
