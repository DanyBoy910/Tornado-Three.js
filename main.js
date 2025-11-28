import * as THREE from 'three';
import * as CANNON from 'cannon-es'; 
import { GUI } from 'dat.gui';
import { MovementControls } from './scripts/controles_mov.js';
import { Tornado } from './scripts/tornado.js';

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

// ===============================================
// === ¡NUEVO! - MATERIALES FÍSICOS ===
// ===============================================
// 1. Creamos los materiales
const groundMaterial = new CANNON.Material('ground');
const bouncyMaterial = new CANNON.Material('bouncy');

// 2. Definimos la interacción entre ellos
const contactMaterial = new CANNON.ContactMaterial(
    groundMaterial,
    bouncyMaterial,
    {
        friction: 0.1, // Fricción
        restitution: 0.7 // ¡REBOTE! (0 = nada, 1 = rebote perfecto)
    }
);
// 3. Añadimos la interacción al mundo
physicsWorld.addContactMaterial(contactMaterial);


// --- Físicas del Suelo ---
const planeGeometry = new THREE.PlaneGeometry(100, 100);
const planeMaterial = new THREE.MeshStandardMaterial({
    color: 0xeeeeee,
    side: THREE.DoubleSide
});
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.position.y = -3; 
plane.receiveShadow = true;
scene.add(plane);

// Cuerpo Físico del Suelo
const groundBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane(),
    material: groundMaterial // ¡NUEVO! Asignamos el material
});
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); 
groundBody.position.copy(plane.position);
physicsWorld.addBody(groundBody);

// --- El Cubo que Cae ---

// Cubo VISUAL
const cubeGeometry = new THREE.BoxGeometry(2,2, 2);
const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const visualCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
visualCube.position.set(50, 20, 0);
visualCube.castShadow = true;
scene.add(visualCube);

// Cubo FÍSICO
const cubeBody = new CANNON.Body({
    mass: 50,
    shape: new CANNON.Box(new CANNON.Vec3(1, 1, 1)),
    material: bouncyMaterial // ¡NUEVO! Asignamos el material
});
cubeBody.position.copy(visualCube.position);
physicsWorld.addBody(cubeBody);
// Ajustes para comportamiento más natural
cubeBody.linearDamping = 0.02; // reduce el movimiento errático en el aire
cubeBody.angularDamping = 0.7; // frena la rotación rápidamente cuando sale del tornado


// --- Tornado ---
const tornado = new Tornado(scene);

// --- Reloj ---
const clock = new THREE.Clock();

// --- Controles ---
const controls = new MovementControls(camera, document.body);

// --- GUI para controlar parámetros del tornado ---
const gui = new GUI();

// Carpeta para parámetros del tornado
const tornadoFolder = gui.addFolder('Tornado');
tornadoFolder.add(tornado, 'tornadoForceStrength', 10000, 500000, 10000).name('Fuerza');
tornadoFolder.add(tornado, 'maxRadius', 10, 100, 5).name('Radio Máximo');
tornadoFolder.add(tornado, 'maxHeight', 30, 200, 10).name('Altura Máxima');
tornadoFolder.add(tornado.velocity, 'x', -50, 50, 1).name('Velocidad X');
tornadoFolder.add(tornado.velocity, 'y', -30, 30, 1).name('Velocidad Y');
tornadoFolder.add(tornado.velocity, 'z', -50, 50, 1).name('Velocidad Z');
tornadoFolder.open();

// --- Loop de Animación (Sin cambios) ---
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // Actualizamos el mundo físico
    physicsWorld.step(1 / 60, delta);

    // --- Aplicar fuerzas del tornado al cubo ---
    const tornadoResult = tornado.calculateForceOnObject(
        new THREE.Vector3().copy(cubeBody.position),
        cubeBody.mass
    );

    // Separar la componente vertical (lift) y la horizontal (radial + tangencial)
    const lift = new CANNON.Vec3(0, tornadoResult.force.y, 0);
    const horizontal = new CANNON.Vec3(tornadoResult.force.x, 0, tornadoResult.force.z);

    // Aplicar lift en el centro del cuerpo (no genera torque)
    if (lift.y !== 0) {
        cubeBody.applyForce(lift, cubeBody.position);
    }

    // Aplicar la componente horizontal en un punto ligeramente por encima del centro
    // para generar torque natural (rotación) mientras está dentro del tornado.
    if (horizontal.x !== 0 || horizontal.z !== 0) {
        const offsetPoint = cubeBody.position.vadd(new CANNON.Vec3(0, 0.8, 0));
        cubeBody.applyForce(horizontal, offsetPoint);
    }

    // Además sumar el torque directo al cuerpo (como respaldo), integrado por el motor físico
    cubeBody.torque.x += tornadoResult.torque.x || 0;
    cubeBody.torque.y += tornadoResult.torque.y || 0;
    cubeBody.torque.z += tornadoResult.torque.z || 0;

    // Sincronizamos lo visual con lo físico
    visualCube.position.copy(cubeBody.position);
    visualCube.quaternion.copy(cubeBody.quaternion);

    // Actualizar controles y tornado
    controls.update(delta);
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