import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export class MovementControls {

    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement; // Guardamos referencia al elemento
        
        // PointerLockControls solo lo usamos para calcular vectores de movimiento (W,A,S,D)
        this.pointerLockControls = new PointerLockControls(camera, domElement);

        // Configuración
        this.moveSpeed = 50; 
        this.lookSensitivity = 0.003; 
        
        // Estado
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.moveUp = false;
        this.moveDown = false;

        this.scrollPressed = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Ángulos actuales
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');

        // Bindings
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);

        // --- LISTENERS ---
        // IMPORTANTE: { passive: false } es OBLIGATORIO para prevenir el scroll nativo
        this.domElement.addEventListener('pointerdown', this.onPointerDown, { passive: false });
        
        // Listener global para soltar el click aunque estemos fuera del canvas
        window.addEventListener('pointerup', this.onPointerUp);
        window.addEventListener('pointermove', this.onPointerMove);
        
        // Teclado
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);

        this.updateEulerFromCamera();
    }

    onPointerDown(event) {
        // 1. ELIMINADA la restricción de event.target que te estaba bloqueando
        
        // 2. Detectar botón central (Rueda = 1)
        if (event.button === 1) {

            this.scrollPressed = true;
            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;

            // 3. CAPTURAR PUNTERO: Esto evita que el mouse se "escape" si sales del canvas
            this.domElement.setPointerCapture(event.pointerId);

            // 4. Prevenir el icono de "autoscroll" del navegador
            event.preventDefault(); 
        }
    }

    onPointerUp(event) {
        if (event.button === 1) {
            this.scrollPressed = false;
            // Liberar el puntero
            if(this.domElement.hasPointerCapture(event.pointerId)){
                this.domElement.releasePointerCapture(event.pointerId);
            }
        }
    }

    onPointerMove(event) {
        if (!this.scrollPressed) return;

        const deltaX = event.clientX - this.lastMouseX;
        const deltaY = event.clientY - this.lastMouseY;

        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;

        // Actualizar ángulos
        this.euler.y -= deltaX * this.lookSensitivity;
        this.euler.x -= deltaY * this.lookSensitivity;

        // Limitar vertical (evitar volteretas)
        this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));

        // Aplicar a la cámara
        this.camera.quaternion.setFromEuler(this.euler);
    }

    updateEulerFromCamera() {
        this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    }

    onKeyDown(event) {
        switch (event.code) {
            case 'KeyW': this.moveForward = true; break;
            case 'KeyS': this.moveBackward = true; break;
            case 'KeyA': this.moveLeft = true; break;
            case 'KeyD': this.moveRight = true; break;
            case 'Space': this.moveUp = true; break;
            case 'ShiftLeft':
            case 'KeyC': this.moveDown = true; break;
        }
    }

    onKeyUp(event) {
        switch (event.code) {
            case 'KeyW': this.moveForward = false; break;
            case 'KeyS': this.moveBackward = false; break;
            case 'KeyA': this.moveLeft = false; break;
            case 'KeyD': this.moveRight = false; break;
            case 'Space': this.moveUp = false; break;
            case 'ShiftLeft':
            case 'KeyC': this.moveDown = false; break;
        }
    }

    update(delta) {
        const speed = this.moveSpeed * delta;

        // Usamos pointerLockControls solo para las matemáticas de dirección
        if (this.moveForward) this.pointerLockControls.moveForward(speed);
        if (this.moveBackward) this.pointerLockControls.moveForward(-speed);
        if (this.moveLeft) this.pointerLockControls.moveRight(-speed);
        if (this.moveRight) this.pointerLockControls.moveRight(speed);

        if (this.moveUp) this.camera.position.y += speed;
        if (this.moveDown) this.camera.position.y -= speed;
    }
}