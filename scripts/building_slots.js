import * as THREE from "three";
import * as CANNON from "cannon-es";

export class BuildingSlots {
  constructor(scene, camera, renderer, modelLoader, physicsWorld) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.modelLoader = modelLoader;
    this.physicsWorld = physicsWorld;

    this.slots = {};
    this.buildings = {}; 
    this.slotVisuals = {}; 
    this.buildingVisuals = {}; 

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.contextMenu = null;
    this.selectedSlot = null;
    this.tornado = null; 
    this.damageThreshold = 30; // Distancia mínima antes de dañar (en unidades)

    this.setupEventListeners();
  }

  /**
   * Registrar un tipo de edificio disponible
   * @param {string} buildingType - Nombre del tipo de edificio
   * @param {object} paths - { intact: rutaIntacto, cracked: rutaRoto }
   * @param {object} options - { debrisMass: 0.5 } - Masa de los pedazos cuando se daña
   */
  addBuilding(buildingType, paths, options = {}) {
    this.buildings[buildingType] = {
      intact: paths.intact,
      cracked: paths.cracked,
      debrisMass: options.debrisMass || 0.5, // Masa por defecto: 0.5
    };
  }


  setTornado(tornado) {
    this.tornado = tornado;
  }

  applyTornadoForces() {
    if (!this.tornado) return;

    // USAR ENTRIES PARA OBTENER EL ID CORRECTO (La clave del objeto)
    Object.entries(this.buildingVisuals).forEach(([realBuildingId, building]) => {
      
      // 1. Lógica para dañar el edificio
      if (!building.damaged) {
        const buildingPos = building.visual.position;
        const tornadoPos = this.tornado.position || new THREE.Vector3();
        const distance = buildingPos.distanceTo(tornadoPos);

        if (distance < this.damageThreshold) {
          this.damageBuilding(realBuildingId); 
        }
      }

      // Mover escombros
      if (building.damaged && building.crackedBodies && building.crackedBodies.length > 0) {
        building.crackedBodies.forEach((debris) => {
          if(!debris.body) return;
          
          const body = debris.body;

          const debrisPos = new THREE.Vector3(
            body.position.x,
            body.position.y,
            body.position.z
          );

          // cual es la masa del objeto
          const tornadoResult = this.tornado.calculateForceOnObject(
            debrisPos,
            body.mass 
          );

          const lift = new CANNON.Vec3(0, tornadoResult.force.y, 0);
          const horizontal = new CANNON.Vec3(
            tornadoResult.force.x,
            0,
            tornadoResult.force.z
          );

          body.applyForce(lift, body.position);
          body.applyForce(horizontal, body.position);

          // gira así a lo loco
          body.torque.x += (Math.random() - 0.5) * 10;
          body.torque.y += (Math.random() - 0.5) * 10;
        });
      }
    });
  }

  /**
   * Crear un slot para colocar edificios
   * @param {string} slotId
   * @param {array} position
   * @param {object} options 
   */
  addSlot(slotId, position, options = {}) {
    const size = options.size || 1;
    const slotSize = 5 * size;

    // Crear cubo visual para el slot
    const geometry = new THREE.BoxGeometry(slotSize, slotSize, slotSize);
    const material = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      metalness: 0.3,
      roughness: 0.7,
      emissive: 0x00aa00,
      wireframe: false,
    });
    const visual = new THREE.Mesh(geometry, material);
    visual.position.set(...position);
    visual.castShadow = true;
    visual.receiveShadow = true;
    this.scene.add(visual);

    // Guardar información del slot
    this.slots[slotId] = {
      position: position,
      size: size,
      occupied: false,
      buildingType: options.buildingType || null,
      buildingId: null,
    };

    this.slotVisuals[slotId] = {
      visual: visual,
      body: null, // Sin cuerpo físico
    };

  }

  setupEventListeners() {
    document.addEventListener(
      "click",
      (event) => {
        this.onLeftClick(event);
      },
      { passive: true }
    );

    document.addEventListener(
      "mousemove",
      (event) => {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      },
      { passive: true }
    );
  }

  onLeftClick(event) {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const slotVisuals = Object.values(this.slotVisuals).map((s) => s.visual);

    const intersects = this.raycaster.intersectObjects(slotVisuals, true);

    if (intersects.length > 0) {
      const clickedVisual = intersects[0].object;
      const slotId = Object.keys(this.slotVisuals).find(
        (id) => this.slotVisuals[id].visual === clickedVisual
      );

      if (slotId) {
        this.selectedSlot = slotId;
        this.showBuildingMenu(event.clientX, event.clientY, slotId);
      }
    } else {
      this.closeMenu();
    }
  }

  showBuildingMenu(x, y, slotId) {
    this.closeMenu();

    this.contextMenu = document.createElement("div");
    this.contextMenu.id = "building-menu";
    this.contextMenu.style.cssText = `
            position: fixed;
            top: ${y}px;
            left: ${x}px;
            background: rgba(20, 40, 60, 0.95);
            border: 2px solid #00ff00;
            border-radius: 8px;
            padding: 8px 0;
            z-index: 10000;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.5);
            font-family: Arial, sans-serif;
            min-width: 180px;
        `;

    // título del menú
    const title = document.createElement("div");
    title.style.cssText = `
            padding: 10px 20px;
            color: #00ff00;
            font-weight: bold;
            border-bottom: 2px solid rgba(0, 255, 0, 0.3);
        `;
    title.textContent = `Edificios - ${slotId}`;
    this.contextMenu.appendChild(title);

    // Opciones de edificios
    Object.keys(this.buildings).forEach((buildingType) => {
      const item = document.createElement("div");
      item.style.cssText = `
                padding: 10px 20px;
                cursor: pointer;
                color: #00ff00;
                transition: all 0.2s;
                user-select: none;
                border-bottom: 1px solid rgba(0, 255, 0, 0.2);
            `;
      item.textContent = `Colocar ${buildingType}`;

      item.addEventListener(
        "mouseenter",
        () => {
          item.style.background = "rgba(0, 255, 0, 0.2)";
          item.style.paddingLeft = "30px";
        },
        { passive: true }
      );

      item.addEventListener(
        "mouseleave",
        () => {
          item.style.background = "transparent";
          item.style.paddingLeft = "20px";
        },
        { passive: true }
      );

      item.addEventListener(
        "mousedown",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.placeBuilding(slotId, buildingType);
          this.closeMenu();
        },
        { passive: false }
      );

      this.contextMenu.appendChild(item);
    });

    // Opción para demoler si hay algo colocado
    if (this.slots[slotId].occupied) {
      const demolish = document.createElement("div");
      demolish.style.cssText = `
                padding: 10px 20px;
                cursor: pointer;
                color: #ff6600;
                transition: all 0.2s;
                user-select: none;
                border-top: 1px solid rgba(255, 102, 0, 0.3);
            `;
      demolish.textContent = "🗑️ Demoler";

      demolish.addEventListener(
        "mouseenter",
        () => {
          demolish.style.background = "rgba(255, 102, 0, 0.2)";
          demolish.style.paddingLeft = "30px";
        },
        { passive: true }
      );

      demolish.addEventListener(
        "mouseleave",
        () => {
          demolish.style.background = "transparent";
          demolish.style.paddingLeft = "20px";
        },
        { passive: true }
      );

      demolish.addEventListener(
        "mousedown",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.demolishBuilding(slotId);
          this.closeMenu();
        },
        { passive: false }
      );

      this.contextMenu.appendChild(demolish);
    }

    document.body.appendChild(this.contextMenu);
  }

  /**
   * Colocar un edificio en el slot
   */
  placeBuilding(slotId, buildingType) {
    const slot = this.slots[slotId];

    // Si ya hay algo, demoler primero
    if (slot.occupied) {
      this.demolishBuilding(slotId);
    }

    const buildingPaths = this.buildings[buildingType];
    if (!buildingPaths) {
      return;
    }

    // Crear ID único para este edificio
    const buildingId = `${slotId}_${buildingType}_${Date.now()}`;

    // Cargar el modelo intacto
    this.modelLoader
      .load(buildingPaths.intact, {
        mass: 0, // Edificios estáticos inicialmente
        position: slot.position,
        scale: 1,
        friction: 0.5,
        restitution: 0.2,
        onLoad: (modelData) => {

          // Guardar referencia visual
          this.buildingVisuals[buildingId] = {
            visual: modelData.visual,
            body: modelData.body,
            type: buildingType,
            slotId: slotId,
            intact: buildingPaths.intact,
            cracked: buildingPaths.cracked,
            damaged: false,
            crackedBodies: [], // Para almacenar los cuerpos del modelo roto
            originalPosition: slot.position.slice(), // Guardar posición original
          };

          // Actualizar slot
          slot.occupied = true;
          slot.buildingType = buildingType;
          slot.buildingId = buildingId;

          // Ocultar el slot cuando está ocupado
          this.slotVisuals[slotId].visual.visible = false;
        },
      })
      .catch((error) => {
      });
  }

  /**
   * Demoler un edificio
   */
  demolishBuilding(slotId) {
    const slot = this.slots[slotId];

    if (!slot.occupied || !slot.buildingId) {
      return;
    }

    const buildingId = slot.buildingId;
    const building = this.buildingVisuals[buildingId];

    if (building) {
      // Remover visual
      this.scene.remove(building.visual);

      // Remover body físico del modelo intacto
      if (building.body) {
        this.physicsWorld.removeBody(building.body);
      }

      // Remover bodies del modelo roto si existen
      if (building.crackedBodies && building.crackedBodies.length > 0) {
        building.crackedBodies.forEach((body) => {
          this.physicsWorld.removeBody(body);
        });
      }

      // Eliminar referencia
      delete this.buildingVisuals[buildingId];
    }

    // Actualizar slot
    slot.occupied = false;
    slot.buildingType = null;
    slot.buildingId = null;

    // Mostrar el slot nuevamente cuando se demoler
    this.slotVisuals[slotId].visual.visible = true;

  }


  damageBuilding(buildingId) {
    const building = this.buildingVisuals[buildingId];
    if (!building || building.damaged) {
      return;
    }

    building.damaged = true;
    const position = building.visual.position.clone();
    const quaternion = building.visual.quaternion.clone();

    // Configuración de masa (Ligera)
    const buildingType = building.type;
    const buildingConfig = this.buildings[buildingType];
    const debrisMass = buildingConfig?.debrisMass || 10; 

    // 1. Limpiar lo viejo
    this.scene.remove(building.visual);
    if (building.body) {
      this.physicsWorld.removeBody(building.body);
    }

    // 2. Cargar el modelo roto
    this.modelLoader
      .load(building.cracked, {
        mass: 0,
        position: [position.x, position.y, position.z],
        scale: 1,
        onLoad: (crackedData) => {
          building.visual = crackedData.visual;
          // Actualizamos matriz mundo para asegurar cálculos correctos
          building.visual.position.copy(position);
          building.visual.quaternion.copy(quaternion);
          building.visual.updateMatrixWorld(true);

          if (crackedData.body) {
            this.physicsWorld.removeBody(crackedData.body);
          }

          building.crackedBodies = [];
          
          const debrisParts = [];
          building.visual.traverse((child) => {
            if (child.isMesh) {
              debrisParts.push(child);
            }
          });

          // === PROCESO DE CENTRADO Y CREACIÓN FÍSICA ===
          debrisParts.forEach((child) => {
            // 1. Obtener transformaciones mundiales actuales del PIVOTE
            const worldPos = new THREE.Vector3();
            const worldQuat = new THREE.Quaternion();
            const worldScale = new THREE.Vector3();
            child.matrixWorld.decompose(worldPos, worldQuat, worldScale);

            // 2. Calcular el centro real de la geometría (Bounding Box local)
            child.geometry.computeBoundingBox();
            const box = child.geometry.boundingBox;
            const size = new THREE.Vector3();
            box.getSize(size);
            const center = new THREE.Vector3();
            box.getCenter(center);

            // 3. CORRECCIÓN DE PIVOTE:
            // Movemos la geometría para que su origen (0,0,0) sea su centro real.
            // Esto alinea visuales y físicas perfectamente.
            child.geometry.translate(-center.x, -center.y, -center.z);

            // 4. Calcular dónde debe ir el objeto en el mundo real
            // (Posición del pivote original + offset del centro rotado)
            const centerOffset = center.clone().applyQuaternion(worldQuat);
            const realCenterPos = worldPos.clone().add(centerOffset);

            // 5. Separar del padre y actualizar posición
            child.removeFromParent(); 
            this.scene.add(child);
            
            // Colocamos el mesh en su centro real
            child.position.copy(realCenterPos);
            child.quaternion.copy(worldQuat);
            child.scale.copy(worldScale);

            // 6. 🔥 FIX DEL SUELO: Levantar un poquito todo (20cm)
            // Esto evita que nazcan "dentro" del piso
            child.position.y += 0.2;

            // 7. Reducir caja física (Anti-overlap)
            const physicsSize = size.clone().multiplyScalar(0.85);

            // Crear cuerpo físico
            const pieceBody = new CANNON.Body({
              mass: debrisMass,
              shape: new CANNON.Box(new CANNON.Vec3(physicsSize.x / 2, physicsSize.y / 2, physicsSize.z / 2)),
              linearDamping: 0.05, 
              angularDamping: 0.05,
            });

            // Sincronizar posición inicial (Mesh y Body ahora comparten el mismo centro)
            pieceBody.position.copy(child.position);
            pieceBody.quaternion.copy(child.quaternion);

            // Despertar suave
            pieceBody.wakeUp();

            this.physicsWorld.addBody(pieceBody);

            building.crackedBodies.push({
              mesh: child,
              body: pieceBody,
            });
          });

        },
      })
      .catch((error) => console.error(error));
  }

  update() {
    Object.values(this.buildingVisuals).forEach((building) => {
      if (building.damaged && building.crackedBodies) {
        building.crackedBodies.forEach((part) => {
          if (part.mesh && part.body) {
            // Copiar posición y rotación del cuerpo físico al visual de ESTE pedazo
            part.mesh.position.copy(part.body.position);
            part.mesh.quaternion.copy(part.body.quaternion);
          }
        });
        
      } else if (!building.damaged && building.body) {
        // Si el edificio está intacto, actualizar su posición
        building.visual.position.copy(building.body.position);
        building.visual.quaternion.copy(building.body.quaternion);
      }
    });
  }

  /**
   * Cerrar menú
   */
  closeMenu() {
    if (this.contextMenu) {
      this.contextMenu.remove();
      this.contextMenu = null;
    }
  }

  /**
   * Destruir el sistema
   */
  destroy() {
    this.closeMenu();
    Object.values(this.slotVisuals).forEach((slot) => {
      this.scene.remove(slot.visual);
      // Solo remover body si existe
      if (slot.body) {
        this.physicsWorld.removeBody(slot.body);
      }
    });
  }
}
