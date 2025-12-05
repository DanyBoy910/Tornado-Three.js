import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * ModelLoader - Carga modelos 3D con física automática
 * 
 * Uso:
 * const loader = new ModelLoader(scene, physicsWorld);
 * loader.load('path/to/model.glb', { mass: 10, position: [0, 5, 0] });
 */
export class ModelLoader {
    constructor(scene, physicsWorld, material = null) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.gltfLoader = new GLTFLoader();
        this.physicsMaterial = material || new CANNON.Material('model');
        this.loadedModels = [];
    }

    /**
     * Carga un modelo y le agrega física
     * @param {string} path - Ruta al archivo GLB/GLTF
     * @param {object} options - Opciones de física
     *   - mass: número (default: 1) - Masa del objeto
     *   - position: [x, y, z] - Posición inicial
     *   - scale: número (default: 1) - Escala del modelo
     *   - friction: número (default: 0.3)
     *   - restitution: número (default: 0.3) - Rebote
     *   - onLoad: función - Callback cuando carga
     */
    load(path, options = {}) {
        const {
            mass = 1,
            position = [0, 0, 0],
            scale = 1,
            friction = 0.3,
            restitution = 0.3,
            onLoad = null
        } = options;

        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                path,
                (gltf) => {
                    const model = gltf.scene;
                    
                    // Aplicar escala
                    model.scale.set(scale, scale, scale);
                    
                    // Aplicar posición
                    model.position.set(...position);
                    
                    // Agregar el modelo a la escena
                    this.scene.add(model);

                    // Configurar sombras
                    model.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });

                    // Crear cuerpo físico
                    const physicsBody = this.createPhysicsBody(
                        model,
                        mass,
                        friction,
                        restitution
                    );

                    if (physicsBody) {
                        this.physicsWorld.addBody(physicsBody);

                        // Guardar referencia
                        const modelData = {
                            visual: model,
                            physics: physicsBody,
                            path: path
                        };
                        this.loadedModels.push(modelData);

                        // Callback
                        if (onLoad) onLoad(modelData);
                        
                        resolve(modelData);
                    }
                },
                (xhr) => {
                    // Progreso de carga
                    const progress = (xhr.loaded / xhr.total * 100);
                },
                (error) => {
                    reject(error);
                }
            );
        });
    }

    /**
     * Crea automáticamente un cuerpo físico desde la geometría del modelo
     */
    createPhysicsBody(model, mass, friction, restitution) {
        // Obtener bounding box del modelo
        const bbox = new THREE.Box3().setFromObject(model);
        const size = bbox.getSize(new THREE.Vector3());

        // Crear forma de caja simple (aproximada)
        const shape = new CANNON.Box(
            new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)
        );

        // Crear material y cuerpo físico
        const body = new CANNON.Body({
            mass: mass,
            shape: shape,
            material: this.physicsMaterial,
            linearDamping: 0.02,
            angularDamping: 0.3
        });

        // Establecer posición inicial
        body.position.set(
            model.position.x,
            model.position.y,
            model.position.z
        );

        return body;
    }

    /**
     * Actualiza la posición y rotación visual según la física
     * (Llamar en el loop de animación)
     */
    updateModels() {
        this.loadedModels.forEach(modelData => {
            const { visual, physics } = modelData;
            
            // Sincronizar posición
            visual.position.copy(physics.position);
            
            // Sincronizar rotación
            visual.quaternion.copy(physics.quaternion);
        });
    }

    /**
     * Obtiene un modelo cargado por su ruta
     */
    getModelByPath(path) {
        return this.loadedModels.find(m => m.path === path);
    }

    /**
     * Obtiene todos los modelos cargados
     */
    getAllModels() {
        return this.loadedModels;
    }

    /**
     * Elimina un modelo de la escena y de la física
     */
    remove(modelData) {
        // Remover de la escena visual
        this.scene.remove(modelData.visual);
        
        // Remover del mundo físico
        this.physicsWorld.removeBody(modelData.physics);
        
        // Remover del array de modelos
        const index = this.loadedModels.indexOf(modelData);
        if (index > -1) {
            this.loadedModels.splice(index, 1);
        }
        
    }

    /**
     * Elimina todos los modelos
     */
    removeAll() {
        this.loadedModels.forEach(modelData => {
            this.scene.remove(modelData.visual);
            this.physicsWorld.removeBody(modelData.physics);
        });
        this.loadedModels = [];
    }

    /**
     * Aplica fuerzas del tornado a todos los modelos cargados
     * (Llamar desde el loop de animación)
     */
    applyTornadoForces(tornado) {
        this.loadedModels.forEach(modelData => {
            if (modelData.physics.mass > 0) { // Solo afectar objetos dinámicos
                const tornadoResult = tornado.calculateForceOnObject(
                    modelData.physics.position.clone(),
                    modelData.physics.mass
                );

                if (tornadoResult.force.x !== 0 || tornadoResult.force.y !== 0 || tornadoResult.force.z !== 0) {
                    // Aplicar lift en el centro
                    const lift = new CANNON.Vec3(0, tornadoResult.force.y, 0);
                    if (lift.y !== 0) {
                        modelData.physics.applyForce(lift, modelData.physics.position);
                    }

                    // Aplicar componentes horizontales con offset para generar torque
                    const horizontal = new CANNON.Vec3(tornadoResult.force.x, 0, tornadoResult.force.z);
                    if (horizontal.x !== 0 || horizontal.z !== 0) {
                        const offsetPoint = modelData.physics.position.vadd(new CANNON.Vec3(0, 0.8, 0));
                        modelData.physics.applyForce(horizontal, offsetPoint);
                    }

                    // Aplicar torque directo
                    modelData.physics.torque.x += tornadoResult.torque.x || 0;
                    modelData.physics.torque.y += tornadoResult.torque.y || 0;
                    modelData.physics.torque.z += tornadoResult.torque.z || 0;
                }
            }
        });
    }
}

