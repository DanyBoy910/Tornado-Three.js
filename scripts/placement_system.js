import * as THREE from 'three';

/**
 * PlacementSystem - Sistema para colocar objetos con click derecho
 * 
 * Uso:
 * const placer = new PlacementSystem(scene, camera, renderer, modelLoader);
 * placer.addAsset('coche', './assets/coche.glb', { mass: 5 });
 * placer.addAsset('poste', './assets/poste.glb', { mass: 10 });
 */
export class PlacementSystem {
    constructor(scene, camera, renderer, modelLoader, physicsWorld) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.modelLoader = modelLoader;
        this.physicsWorld = physicsWorld;
        
        this.assets = {}; // { nombre: { ruta, opciones } }
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.contextMenu = null;
        this.selectedObject = null;
        
        this.setupEventListeners();
    }

    /**
     * Agregar un asset a la lista disponible
     * @param {string} name - Nombre del asset
     * @param {string} path - Ruta al archivo
     * @param {object} options - Opciones físicas { mass, friction, restitution }
     */
    addAsset(name, path, options = {}) {
        this.assets[name] = { 
            path: path,
            options: {
                mass: options.mass || 2,           // Masa por defecto: 2
                friction: options.friction || 0.5,
                restitution: options.restitution || 0.3,
                ...options
            }
        };
    }

    /**
     * Configurar listeners para mouse
     */
    setupEventListeners() {
        // Click derecho (context menu)
        document.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            this.onRightClick(event);
        }, { passive: false });

        // Cerrar menú al click izquierdo FUERA del menú
        document.addEventListener('click', (event) => {
            // Si el click NO está en el menú, cerrarlo
            if (this.contextMenu && !this.contextMenu.contains(event.target)) {
                this.closeContextMenu();
            }
        }, { passive: true });

        // Detectar objetos bajo el ratón
        document.addEventListener('mousemove', (event) => {
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        }, { passive: true });
    }

    /**
     * Manejar click derecho
     */
    onRightClick(event) {
        // Actualizar raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Buscar intersecciones con modelos
        const loadedModels = this.modelLoader.getAllModels();
        const meshes = loadedModels.map(m => m.visual).filter(v => v);
        
        // También incluir meshes del objeto visual
        const allMeshes = [];
        meshes.forEach(mesh => {
            mesh.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    allMeshes.push(child);
                }
            });
        });


        const intersects = this.raycaster.intersectObjects(allMeshes, true);

        if (intersects.length > 0) {
            const intersection = intersects[0];
            this.selectedObject = intersection.point;
            this.showContextMenu(event.clientX, event.clientY);
        } else {
            console.warn('⚠️ No se detectó colisión con objetos');
        }
    }

    /**
     * Mostrar menú contextual
     */
    showContextMenu(x, y) {
        // Eliminar menú anterior si existe
        this.closeContextMenu();

        // Crear menú
        this.contextMenu = document.createElement('div');
        this.contextMenu.id = 'context-menu';
        this.contextMenu.style.cssText = `
            position: fixed;
            top: ${y}px;
            left: ${x}px;
            background: rgba(30, 30, 30, 0.95);
            border: 2px solid #00ccff;
            border-radius: 8px;
            padding: 8px 0;
            z-index: 10000;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.5);
            font-family: Arial, sans-serif;
            min-width: 150px;
        `;

        // Agregar opciones de assets
        Object.entries(this.assets).forEach(([name, assetData]) => {
            const item = document.createElement('div');
            item.style.cssText = `
                padding: 10px 20px;
                cursor: pointer;
                color: #00ccff;
                transition: all 0.2s;
                user-select: none;
                border-bottom: 1px solid rgba(0, 204, 255, 0.2);
            `;
            item.textContent = `Colocar ${name}`;
            
            item.addEventListener('mouseenter', () => {
                item.style.background = 'rgba(0, 204, 255, 0.2)';
                item.style.paddingLeft = '30px';
            }, { passive: true });
            
            item.addEventListener('mouseleave', () => {
                item.style.background = 'transparent';
                item.style.paddingLeft = '20px';
            }, { passive: true });
            
            // Usar mousedown en lugar de click (más confiable)
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.placeAsset(name);
                this.closeContextMenu();
            });
            
            this.contextMenu.appendChild(item);
        });

        document.body.appendChild(this.contextMenu);
    }

    /**
     * Cerrar menú contextual
     */
    closeContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
        }
    }

    /**
     * Colocar un asset en la posición seleccionada
     * @param {string} assetName - Nombre del asset registrado
     */
    placeAsset(assetName) {
        if (!this.selectedObject) {
            console.warn('No hay posición seleccionada');
            return;
        }

        if (!this.assets[assetName]) {
            console.error(`Asset no encontrado: ${assetName}`);
            return;
        }

        const position = [
            this.selectedObject.x,
            this.selectedObject.y + 5, // Elevamos un poco para evitar conflictos
            this.selectedObject.z
        ];

        const assetData = this.assets[assetName];
        const assetPath = assetData.path;
        const options = assetData.options;

        // Cargar modelo en la posición
        this.modelLoader.load(assetPath, {
            mass: options.mass,
            position: position,
            scale: 1,
            friction: options.friction,
            restitution: options.restitution,
            onLoad: (modelData) => {
                console.log(` ${assetName} colocado exitosamente en:`, position);
            }
        }).catch(error => {
            alert(`Error al cargar ${assetName}. Verifica la ruta: ${assetPath}`);
        });
    }

    /**
     * Limpiar el sistema
     */
    destroy() {
        this.closeContextMenu();
        document.removeEventListener('contextmenu', this.onRightClick);
    }
}
