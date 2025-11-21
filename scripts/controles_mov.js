// Importamos solo lo que este módulo necesita
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// Usamos 'export' para que la clase esté disponible para main.js
export class MovementControls {

    // Propiedades de la clase
    pointerLockControls;
    camera;
    moveSpeed = 50; // Puedes ajustar la velocidad aquí

    // Estado del movimiento
    moveForward = false;
    moveBackward = false;
    moveLeft = false;
    moveRight = false;
    moveUp = false;
    moveDown = false;

    // El 'constructor' se llama cuando hacemos 'new MovementControls()'
    constructor(camera, domElement) {
        this.camera = camera;
        // Creamos la instancia de PointerLockControls
        this.pointerLockControls = new PointerLockControls(camera, domElement);

        // --- Vinculamos 'this' a nuestros manejadores de eventos ---
        // (Esto es crucial para que 'this' funcione dentro de las funciones)
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);

        // --- Agregamos los Event Listeners ---
        domElement.addEventListener('mousedown', this.onMouseDown);
        domElement.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
    }

    // --- Manejadores de Eventos ---
    onMouseDown() {
        this.pointerLockControls.lock();
    }

    onMouseUp() {
        this.pointerLockControls.unlock();
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

    // --- Método de Actualización ---
    // main.js llamará a esto en cada frame
    update(delta) {
        const speed = this.moveSpeed * delta;

        // Movimiento relativo a la cámara
        if (this.moveForward) this.pointerLockControls.moveForward(speed);
        if (this.moveBackward) this.pointerLockControls.moveForward(-speed);
        if (this.moveLeft) this.pointerLockControls.moveRight(-speed);
        if (this.moveRight) this.pointerLockControls.moveRight(speed);

        // Movimiento vertical (Y)
        if (this.moveUp) this.camera.position.y += speed;
        if (this.moveDown) this.camera.position.y -= speed;
    }
}