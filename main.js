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
const modalDiagramContainer = document.getElementById('modal-diagram-container') || document.querySelector('.diagram-container');

// Clear out old cached HTML images if they exist
if (modalDiagramContainer) {
    modalDiagramContainer.innerHTML = '';
}

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
        
        diagramModal.classList.remove('hidden');
        if (modal3D) {
            modal3D.open(fact);
        }
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
    if (modal3D) modal3D.close();
});

diagramModal.addEventListener('click', (e) => {
    if (e.target === diagramModal) {
        diagramModal.classList.add('hidden');
        if (modal3D) modal3D.close();
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

// ---- Secondary 3D Modal System ----
function createModal3DScene() {
    if (!modalDiagramContainer) return null;

    const width = modalDiagramContainer.clientWidth || 800;
    const height = modalDiagramContainer.clientHeight || 400;

    const modalScene = new THREE.Scene();
    modalScene.fog = new THREE.FogExp2(0x020617, 0.05);

    const modalCamera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    modalCamera.position.z = 25;

    const modalRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    modalRenderer.setSize(width, height);
    modalRenderer.setPixelRatio(window.devicePixelRatio ? Math.min(window.devicePixelRatio, 2) : 1);
    modalDiagramContainer.appendChild(modalRenderer.domElement);

    const modalControls = new OrbitControls(modalCamera, modalRenderer.domElement);
    modalControls.enableDamping = true;
    modalControls.dampingFactor = 0.05;
    modalControls.autoRotate = true;
    modalControls.autoRotateSpeed = 2.0;

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    modalScene.add(ambient);
    const pointLight = new THREE.PointLight(0x0ea5e9, 3, 100);
    pointLight.position.set(10, 15, 10);
    modalScene.add(pointLight);
    const pointLight2 = new THREE.PointLight(0x22c55e, 2, 100);
    pointLight2.position.set(-10, -15, -10);
    modalScene.add(pointLight2);

    let currentObject = null;
    let animId = null;
    let isAnimating = false;

    function animateModal() {
        if (!isAnimating) return;
        animId = requestAnimationFrame(animateModal);
        modalControls.update();
        if(currentObject && currentObject.userData.updateFunc) {
            currentObject.userData.updateFunc();
        }
        modalRenderer.render(modalScene, modalCamera);
    }

    function buildGeometry(fact) {
        if (currentObject) {
            modalScene.remove(currentObject);
        }

        currentObject = new THREE.Group();
        const category = fact.category;

        const mainMat = new THREE.MeshPhysicalMaterial({
            color: 0x94a3b8, metalness: 0.2, roughness: 0.3, transmission: 0.6, thickness: 1.0
        });
        
        if (category === "Genetics" || category === "Molecular Biology" || category === "Biotechnology") {
            mainMat.color.setHex(0x0ea5e9);
            mainMat.emissive.setHex(0x000000);
            for(let i=0; i<8; i++) {
                const angle = i * 0.8;
                const y = (i - 4) * 1.5;
                const node1 = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), mainMat);
                node1.position.set(Math.cos(angle)*3, y, Math.sin(angle)*3);
                currentObject.add(node1);
                
                const node2 = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), mainMat);
                node2.position.set(Math.cos(angle+Math.PI)*3, y, Math.sin(angle+Math.PI)*3);
                currentObject.add(node2);
                
                const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 6), new THREE.MeshBasicMaterial({color:0x334155}));
                bar.position.set(0, y, 0);
                bar.rotation.x = Math.PI/2;
                bar.rotation.z = -angle;
                currentObject.add(bar);
            }
        } else if (category === "Cytology" || category === "Cell Biology") {
            const cellMat = mainMat.clone();
            cellMat.color.setHex(0x22c55e);
            cellMat.transparent = true; cellMat.opacity = 0.3;
            const membrane = new THREE.Mesh(new THREE.SphereGeometry(6, 32, 32), cellMat);
            currentObject.add(membrane);
            
            const nucleusMat = mainMat.clone();
            nucleusMat.color.setHex(0x0ea5e9);
            const nucleus = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 16), nucleusMat);
            nucleus.position.set(1.5, 0, 1.5);
            currentObject.add(nucleus);
            
            for(let i=0; i<6; i++) {
                const organelle = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1, 8, 8), mainMat);
                organelle.position.set((Math.random()-0.5)*8, (Math.random()-0.5)*8, (Math.random()-0.5)*8);
                organelle.rotation.set(Math.random(), Math.random(), Math.random());
                currentObject.add(organelle);
            }
        } else if (category === "Biochemistry" || category === "Physiology") {
            const molMat = mainMat.clone();
            molMat.color.setHex(0x8b5cf6); // Purple
            for(let i=0; i<18; i++) {
                const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2), molMat);
                mesh.position.set((Math.random()-0.5)*10, (Math.random()-0.5)*10, (Math.random()-0.5)*10);
                currentObject.add(mesh);
                
                const link = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4), new THREE.MeshBasicMaterial({color:0x475569}));
                link.position.copy(mesh.position);
                link.lookAt(0,0,0);
                currentObject.add(link);
            }
        } else if (category === "Histology" || category === "Immunology") {
            const redMat = mainMat.clone();
            redMat.color.setHex(0xef4444); // Red
            const whiteMat = mainMat.clone();
            whiteMat.color.setHex(0xf8fafc); // White
            
            for(let i=0; i<7; i++) {
                const rbc = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.9, 16, 32), redMat);
                rbc.scale.z = 0.5;
                rbc.position.set((Math.random()-0.5)*12, (Math.random()-0.5)*12, (Math.random()-0.5)*12);
                rbc.rotation.set(Math.random(), Math.random(), Math.random());
                currentObject.add(rbc);
            }
            const wbc = new THREE.Mesh(new THREE.IcosahedronGeometry(2.5, 1), whiteMat);
            wbc.position.set(0, 0, 0);
            currentObject.add(wbc);
        } else if (category === "Botany" || category === "Ecology" || category === "Mycology") {
            mainMat.color.setHex(0x10b981); // Emerald
            for(let j=0; j<5; j++) {
                const stack = new THREE.Group();
                for(let i=0; i<4; i++) {
                    const disc = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.4, 16), mainMat);
                    disc.position.y = i * 0.7;
                    stack.add(disc);
                }
                stack.position.set((Math.random()-0.5)*10, (Math.random()-0.5)*6, (Math.random()-0.5)*10);
                stack.rotation.set(Math.random(), Math.random(), Math.random());
                currentObject.add(stack);
            }
        } else if (category === "Virology" || category === "Microbiology") {
            mainMat.color.setHex(0xf59e0b); // Amber
            const body = new THREE.Mesh(new THREE.IcosahedronGeometry(3.5, 0), mainMat);
            body.position.y = 2.5;
            currentObject.add(body);
            
            const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 3), mainMat);
            neck.position.y = -0.5;
            currentObject.add(neck);
            
            for(let i=0; i<6; i++) {
                const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.1, 5), mainMat);
                const angle = (i/6) * Math.PI * 2;
                leg.position.set(Math.cos(angle)*2.5, -3.5, Math.sin(angle)*2.5);
                leg.rotation.z = Math.cos(angle) * 0.6;
                leg.rotation.x = -Math.sin(angle) * 0.6;
                currentObject.add(leg);
            }
        } else {
            mainMat.color.setHex(0x0ea5e9);
            const core = new THREE.Mesh(new THREE.OctahedronGeometry(2.5, 0), mainMat);
            currentObject.add(core);
            for(let i=0; i<10; i++) {
                const spike = new THREE.Mesh(new THREE.ConeGeometry(0.4, 9), mainMat);
                spike.position.set((Math.random()-0.5)*2, (Math.random()-0.5)*2, (Math.random()-0.5)*2);
                spike.lookAt((Math.random()-0.5)*15, (Math.random()-0.5)*15, (Math.random()-0.5)*15);
                currentObject.add(spike);
            }
        }

        modalScene.add(currentObject);
    }

    window.addEventListener('resize', () => {
        if (!diagramModal.classList.contains('hidden')) {
            const w = modalDiagramContainer.clientWidth;
            const h = modalDiagramContainer.clientHeight;
            modalCamera.aspect = w / h;
            modalCamera.updateProjectionMatrix();
            modalRenderer.setSize(w, h);
        }
    });

    return {
        open: (fact) => {
            buildGeometry(fact);
            isAnimating = true;
            
            setTimeout(() => {
                const w = modalDiagramContainer.clientWidth || 800;
                const h = modalDiagramContainer.clientHeight || 400;
                modalCamera.aspect = w / h;
                modalCamera.updateProjectionMatrix();
                modalRenderer.setSize(w, h);
            }, 50);

            if (!animId) {
                animateModal();
            }
        },
        close: () => {
            isAnimating = false;
            if (animId) {
                cancelAnimationFrame(animId);
                animId = null;
            }
        }
    };
}

let modal3D = createModal3DScene();

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
