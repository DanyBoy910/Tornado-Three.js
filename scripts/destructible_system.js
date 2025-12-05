import * as THREE from 'three';

/**
 * DestructibleSystem - Sistema para edificios destructibles
 * 
 * Un edificio tiene 2 estados:
 * - Estado intacto: Estático (mass: 0)
 * - Estado destruido: Dinámico con física (mass > 0)
 * 
 * Uso:
 * const destructible = new DestructibleSystem(modelLoader, physicsWorld);
 * destructible.addDestructible('edificio_1', intactModel, brokenModel, position);
 */
export class DestructibleSystem {
    constructor(modelLoader, physicsWorld) {
        this.modelLoader = modelLoader;
        this.physicsWorld = physicsWorld;
        this.destructibles = {}; // { id: { intacto, roto, estado, modelData } }
    }

    /**
     * Registra un edificio destructible
     * @param {string} id - ID único del destructible
     * @param {string} intactPath - Ruta del modelo intacto
     * @param {string} brokenPath - Ruta del modelo roto/destruido
     * @param {array} position - Posición [x, y, z]
     * @param {object} options - { scale, friction, etc }
     */
    async addDestructible(id, intactPath, brokenPath, position, options = {}) {
        const {
            scale = 1,
            friction = 0.5,
            restitution = 0.2
        } = options;

        // Cargar modelo intacto (estático)
        const intactData = await this.modelLoader.load(intactPath, {
            mass: 0, // Estático
            position: position,
            scale: scale,
            friction: friction,
            restitution: restitution,
        });

        // Cargar modelo roto (dinámico, pero oculto inicialmente)
        const brokenData = await this.modelLoader.load(brokenPath, {
            mass: 3, // Dinámico
            position: position,
            scale: scale,
            friction: friction,
            restitution: restitution,
        });

        // Ocultar modelo roto inicialmente
        brokenData.visual.visible = false;

        // Guardar información del destructible
        this.destructibles[id] = {
            intactData: intactData,
            brokenData: brokenData,
            state: 'intact', // 'intact' o 'destroyed'
            position: position
        };

    }

    /**
     * Destruir un edificio (cambiar de modelo intacto a roto)
     */
    destroy(id) {
        if (!this.destructibles[id]) {
            return;
        }

        const destructible = this.destructibles[id];
        
        if (destructible.state === 'destroyed') {
            return;
        }

        // Ocultar modelo intacto
        destructible.intactData.visual.visible = false;
        
        // Mostrar modelo roto
        destructible.brokenData.visual.visible = true;
        
        // Cambiar estado
        destructible.state = 'destroyed';
        
    }

    /**
     * Restaurar un edificio al estado intacto
     */
    repair(id) {
        if (!this.destructibles[id]) {
            return;
        }

        const destructible = this.destructibles[id];
        
        // Mostrar modelo intacto
        destructible.intactData.visual.visible = true;
        
        // Ocultar modelo roto
        destructible.brokenData.visual.visible = false;
        
        // Cambiar estado
        destructible.state = 'intact';
        
    }

    /**
     * Obtener destructible por ID
     */
    getDestructible(id) {
        return this.destructibles[id];
    }

    /**
     * Obtener todos los destructibles
     */
    getAllDestructibles() {
        return Object.entries(this.destructibles).map(([id, data]) => ({
            id,
            ...data
        }));
    }
}
