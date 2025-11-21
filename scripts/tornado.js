import * as THREE from "three";

const dummy = new THREE.Object3D();

export class Tornado {
  particleCount = 100000;
  maxHeight = 90;
  maxRadius = 50;
  coreRadius = 5.0;
  position = new THREE.Vector3(0, 0, 0); // Centro del tornado
  tornadoForceStrength = 150000; // Fuerza del tornado (ajusta según necesites)

  constructor(scene) {
    const geometry = new THREE.SphereGeometry(0.08, 6, 6);
    const material = new THREE.MeshStandardMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, this.particleCount);
    
    // --- OPTIMIZACIÓN ---
    // ¡NO le pedimos al tornado que proyecte sombras!
    // this.mesh.castShadow = true; // (Línea eliminada)

    scene.add(this.mesh);

    this.particles = [];

    for (let i = 0; i < this.particleCount; i++) {
      const randomHeight = Math.pow(Math.random(), 1.5) * this.maxHeight;
      
      const particle = {
        angle: Math.random() * 2 * Math.PI,
        height: randomHeight,
        targetRadiusFactor: 0.7 + Math.random() * 0.3,
        spinSpeed: 2.0 + Math.random() * 2.5,
        upwardSpeed: 3.0 + Math.random() * 3.0, 
        phase: Math.random() * Math.PI * 2,
        turbulenceOffset: Math.random() * 10,
        radialOscillation: Math.random() * 0.5,
        radialPhase: Math.random() * Math.PI * 2,
        chaosInitial: Math.random() * 5,
        chaosFactor: 2.0,

        // --- OPTIMIZACIÓN ---
        // Pre-calculamos los factores aleatorios para el 'update'
        chaosXFactor: Math.random() - 0.5,
        chaosZFactor: Math.random() - 0.5,
        chaosYFactor: Math.random() - 0.5
      };

      this.particles.push(particle);

      // POSICIÓN INICIAL
      const y = particle.height;
      const baseRadius = this.calculateMaxRadius(y);
      
      const initialChaosX = (Math.random() - 0.5) * particle.chaosInitial;
      const initialChaosZ = (Math.random() - 0.5) * particle.chaosInitial;
      
      const radius = baseRadius * particle.targetRadiusFactor;
      const x = radius * Math.cos(particle.angle) + initialChaosX;
      const z = radius * Math.sin(particle.angle) + initialChaosZ;

      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }

    this.time = 0;
    this.formationTime = 0; 
    this.formationDuration = 3; 
  }

  calculateMaxRadius(height) {
    const normalized = height / this.maxHeight;
    const profile = 0.15 + Math.pow(normalized, 0.7) * 0.85;
    return this.maxRadius * profile;
  }

  calculateAngularVelocity(radius, maxRadiusAtHeight, baseSpeed) {
    const normalized = radius / maxRadiusAtHeight;
    const velocityProfile = Math.exp(-Math.pow((normalized - 0.8) * 3, 2));
    return baseSpeed * (0.3 + velocityProfile * 2);
  }

  update(delta) {
    this.time += delta;
    this.formationTime += delta;
    
    const formationProgress = Math.min(this.formationTime / this.formationDuration, 1);
    const globalChaosFactor = 1 - formationProgress; 

    for (let i = 0; i < this.particleCount; i++) {
      const p = this.particles[i];

      p.chaosFactor = globalChaosFactor;

      // 1. Ascenso
      p.height += p.upwardSpeed * delta;

      // 2. Calcular radio base
      const maxRadiusAtHeight = this.calculateMaxRadius(p.height);

      // 3. Radio objetivo con oscilación
      const oscillation =
        Math.sin(this.time * 2 + p.radialPhase) * p.radialOscillation;
      const targetRadius =
        maxRadiusAtHeight * (p.targetRadiusFactor + oscillation * 0.1);

      // 4. Velocidad angular
      const angularVel = this.calculateAngularVelocity(
        targetRadius,
        maxRadiusAtHeight,
        p.spinSpeed
      );
      p.angle += angularVel * delta;

      // 5. Turbulencia BASE
      const turbStrength = 0.08;
      const turbFreq = 2.5;
      const turbulenceX =
        Math.sin(this.time * turbFreq + p.turbulenceOffset) * turbStrength;
      const turbulenceZ =
        Math.cos(this.time * turbFreq * 1.3 + p.turbulenceOffset) * turbStrength;

      // --- OPTIMIZACIÓN ---
      // (CAMBIO 5: Usamos los factores pre-calculados)
      const chaosStrength = 2.0 * p.chaosFactor; 
      const chaosX = p.chaosXFactor * chaosStrength; // ¡No usamos Math.random()!
      const chaosZ = p.chaosZFactor * chaosStrength; // ¡No usamos Math.random()!
      const chaosY = p.chaosYFactor * chaosStrength * 0.5; // ¡No usamos Math.random()!

      // 6. Movimiento helicoidal
      const helixAmp = 0.5;
      const helixFreq = 10;
      const helixOffset = Math.sin(p.angle * helixFreq + p.phase) * helixAmp;

      // 7. Posición final
      const x = targetRadius * Math.cos(p.angle) + turbulenceX + chaosX;
      const z = targetRadius * Math.sin(p.angle) + turbulenceZ + chaosZ;
      const y = p.height + helixOffset + chaosY;

      // 8. Reiniciar
      if (p.height > this.maxHeight) {
        p.height = 0; 
        p.angle = Math.random() * 2 * Math.PI;
        p.phase = Math.random() * Math.PI * 2;
        p.radialPhase = Math.random() * Math.PI * 2;
      }

      // 9. Actualizar matriz
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  // Calcula la fuerza que el tornado ejercería sobre un objeto en una posición dada
  calculateForceOnObject(objectPos, mass) {
    const force = new THREE.Vector3();
    const torque = new THREE.Vector3(); // Rotación angular
    
    // Vector desde el objeto hacia el centro del tornado (solo horizontalmente)
    const tornadoCenter = this.position.clone();
    tornadoCenter.y = objectPos.y; // Atraemos horizontalmente, ignorando altura
    
    const dirToCenter = tornadoCenter.clone().sub(objectPos);
    const distance = dirToCenter.length();
    
    // Solo aplica fuerza si está dentro del radio del tornado
    if (distance < this.maxRadius && distance > 0.1) {
      dirToCenter.normalize();
      
      // Factor de falloff (disminuye con la distancia)
      // Cuadrado para que sea más notorio el cambio según distancia
      const normalizedDistance = distance / this.maxRadius;
      const falloff = Math.pow(1 - normalizedDistance, 2); // Falloff cuadrático
      
      // Fuerza base inversamente proporcional a la masa
      const baseForce = (this.tornadoForceStrength * falloff) / mass;
      
      // Componente de atracción hacia el centro (horizontal)
      force.addScaledVector(dirToCenter, baseForce * 0.7);
      
      // Componente de elevación (vertical) - mucho más fuerte para que se levante
      const liftForce = (200 * falloff) / mass;
      force.y += liftForce;
      
      // Componente rotatoria (tornada alrededor del eje Y)
      const tangential = new THREE.Vector3(-dirToCenter.z, 0, dirToCenter.x);
      force.addScaledVector(tangential, baseForce * 0.5);
      
      // Torque (rotación angular) SOLO dentro del tornado
      // El tornado gira alrededor de su eje vertical
      torque.y = baseForce * 1.2; // Rotación principal alrededor del eje Y
      
      // Pequeña rotación oscilante en X y Z para efecto caótico (SOLO dentro del tornado)
      torque.x = Math.sin(this.time * 2) * baseForce * 0.3;
      torque.z = Math.cos(this.time * 2) * baseForce * 0.3;
    }
    // Si está fuera del tornado, NO hay torque (force y torque siguen siendo 0)
    
    return { force, torque };
  }
}