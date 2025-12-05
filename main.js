import * as THREE from 'three';
import * as CANNON from 'cannon-es'; 
import { GUI } from 'dat.gui';
import { MovementControls } from './scripts/controles_mov.js';
import { Tornado } from './scripts/tornado.js';
import { ModelLoader } from './scripts/model_loader.js';
import { PlacementSystem } from './scripts/placement_system.js';
import { DestructibleSystem } from './scripts/destructible_system.js';
import { BuildingSlots } from './scripts/building_slots.js';

// --- Configuración Visual (Three.js) ---
const scene = new THREE.Scene();
// --- Sky / Ambiente ---
// Fondo color cielo y niebla para dar sensación de profundidad
scene.background = new THREE.Color(0x87ceeb); // sky blue
scene.fog = new THREE.Fog(0x87ceeb, 10, 200);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 50;
camera.position.y = 5; 

const canvas = document.querySelector('#bg');
const renderer = new THREE.WebGLRenderer({ 
    canvas: canvas,
    antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 

// --- Luces ("Sol") ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); 
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2); 
directionalLight.position.set(50, 50, 30); 
directionalLight.castShadow = true; 
directionalLight.shadow.camera.top = 50;
directionalLight.shadow.camera.bottom = -50;
directionalLight.shadow.camera.left = -50;
directionalLight.shadow.camera.right = 50;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 200;
scene.add(directionalLight);

// Luz hemisférica para simular color del cielo y del suelo
const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.6);
hemiLight.position.set(0, 50, 0);
scene.add(hemiLight);

// --- Configuración del Mundo Físico ---
const physicsWorld = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0)
});




// --- Tornado ---
const tornado = new Tornado(scene);

// --- Reloj ---
const clock = new THREE.Clock();

// --- Objeto para controlar la pausa de la animación ---
const animationControl = {
    isRunning: true
};

// --- Controles ---
const controls = new MovementControls(camera, document.body);

// --- GUI para controlar parámetros del tornado ---
const gui = new GUI();

// Carpeta para parámetros del tornado
const tornadoFolder = gui.addFolder('Tornado');
tornadoFolder.add(tornado, 'tornadoForceStrength', 1000, 5000, 100).name('Fuerza');
tornadoFolder.add(tornado, 'maxRadius', 10, 30, 5).name('Radio Máximo');
tornadoFolder.add(tornado, 'maxHeight', 30, 50, 10).name('Altura Máxima');
tornadoFolder.add(tornado, 'particleCount', 200, 10000, 100).name('Partículas').onChange((value) => {
    tornado.setParticleCount(Math.floor(value));
});
tornadoFolder.add(tornado.velocity, 'x', -6, 6, 1).name('Velocidad X');
tornadoFolder.add(tornado.velocity, 'z', -6, 6, 1).name('Velocidad Z');
tornadoFolder.open();

// Carpeta de controles de animación
const animationFolder = gui.addFolder('Animación');
animationFolder.add(animationControl, 'isRunning').name('Play/Pausa');
animationFolder.open();

// --- Cargar modelo 3D con física ---
const modelLoader = new ModelLoader(scene, physicsWorld);

// Cargar el modelo del suelo
modelLoader.load('./assets/Suelo.glb', {
    mass: 0, // 0 = estático (no se mueve)
    position: [0, 0, 0],
    scale: 1,
    friction: 0.5,
    restitution: 0.2,
    onLoad: (modelData) => {
        console.log('✓ Suelo cargado con física');
    }
}).catch(error => {
    console.error('No se pudo cargar el suelo:', error);
});

// --- Sistema de Colocación de Objetos ---
const placer = new PlacementSystem(scene, camera, renderer, modelLoader, physicsWorld);

// Agregar assets disponibles
placer.addAsset('Coche', './assets/coche_item.glb', { mass: 5 });
placer.addAsset('Poste de Luz', './assets/poste_luz_item.glb', { mass: 2 });

// --- Sistema de Destructibilidad ---
const destructibles = new DestructibleSystem(modelLoader, physicsWorld);

// Ejemplo: Agregar edificios destructibles en posiciones específicas
// destructibles.addDestructible(
//     'edificio_1',
//     './assets/edificio_intacto.glb',
//     './assets/edificio_roto.glb',
//     [0, 5, 0]
// );

// Puedes agregar más edificios:
// destructibles.addDestructible('edificio_2', '...', '...', [20, 5, 0]);

// Puedes agregar más assets según necesites:
// placer.addAsset('Arbol', './assets/arbol.glb');
// placer.addAsset('Casa', './assets/casa.glb');

// --- Sistema de Slots de Edificios ---
const buildingSlots = new BuildingSlots(scene, camera, renderer, modelLoader, physicsWorld);

// Conectar tornado al sistema de slots para aplicar fuerzas y daños
buildingSlots.setTornado(tornado);

// Registrar tipos de edificios disponibles
buildingSlots.addBuilding('Casa', {
    intact: './assets/casa_0.glb',
    cracked: './assets/casa_0_cracked.glb'
}, { debrisMass: 2
 });

buildingSlots.addBuilding('Edificio 1', {
    intact: './assets/casa_1.glb',
    cracked: './assets/casa_1_cracked.glb'
}, { debrisMass: 2 });

buildingSlots.addBuilding('Casa 2 pisos', {
    intact: './assets/casa_2.glb',
    cracked: './assets/casa_2_cracked.glb'
}, { debrisMass: 2 });



// Crear slots (posiciones donde puedes colocar edificios)
// Slot de prueba en posiciónds [30, 0, 0]
for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 4; j++) {
        buildingSlots.addSlot(`slot_${i}_${j}`, [-34 + i * 17, 0.4, -37 + j * 10], { size: 1 });
    }
}

// --- Loop de Animación ---
function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    
    // Actualizar controles y tornado SIEMPRE (incluso en pausa)
    controls.update(delta);
    
    // Si la animación está pausada, solo renderizar sin actualizar física
    if (!animationControl.isRunning) {
        renderer.render(scene, camera);
        return;
    }
    
    // Actualizamos el mundo físico
    physicsWorld.step(1 / 60, delta);

    // Actualizar posición de modelos cargados
    modelLoader.updateModels();

    // --- Aplicar fuerzas del tornado a TODOS los modelos cargados ---
    modelLoader.applyTornadoForces(tornado);

    // --- Aplicar fuerzas del tornado a EDIFICIOS y detectar daños ---
    buildingSlots.applyTornadoForces();
    buildingSlots.update();

    // Actualizar tornado
    tornado.update(delta);

    renderer.render(scene, camera);
}

// --- Manejar redimensionamiento (Sin cambios) ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Iniciar (Sin cambios) ---
animate();