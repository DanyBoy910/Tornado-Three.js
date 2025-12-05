import * as THREE from "three";

export class Tornado {
  particleCount = 10000;
  maxHeight = 50;
  maxRadius = 30;
  coreRadius = 5.0;
  position = new THREE.Vector3(0, 0, 80); 
  velocity = new THREE.Vector3(0, 0, 0); 
  tornadoForceStrength = 1500; 

  constructor(scene) {
    this.scene = scene;

    // Tiempos
    this.time = 0;
    this.formationTime = 0; // Empezamos en 0
    this.formationDuration = 0.01; // Tardará 4 segundos en crecer por completo

    // Generar partículas
    this.createGeometryAndMesh();
  }

  createGeometryAndMesh() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    
    this.particles = [];

    for (let i = 0; i < this.particleCount; i++) {
      // CORRECCIÓN: Volvemos a generar alturas aleatorias. 
      // El "truco" del crecimiento lo haremos en el update.
      const randomHeight = Math.pow(Math.random(), 1.5) * this.maxHeight;
      
      const particle = {
        angle: Math.random() * 2 * Math.PI,
        height: randomHeight, // Usamos la altura aleatoria, no 0
        targetRadiusFactor: 0.7 + Math.random() * 0.3,
        spinSpeed: 2.0 + Math.random() * 2.5,
        upwardSpeed: 3.0 + Math.random() * 3.0, 
        phase: Math.random() * Math.PI * 2,
        turbulenceOffset: Math.random() * 10,
        radialOscillation: Math.random() * 0.5,
        radialPhase: Math.random() * Math.PI * 2,
        chaosInitial: Math.random() * 5,
        chaosFactor: 2.0,
        chaosXFactor: Math.random() - 0.5,
        chaosZFactor: Math.random() - 0.5,
        chaosYFactor: Math.random() - 0.5
      };

      this.particles.push(particle);

      // Posición inicial basada en la altura generada
      const y = particle.height; 
      const baseRadius = this.calculateMaxRadius(y);
      
      const initialChaosX = (Math.random() - 0.5) * particle.chaosInitial;
      const initialChaosZ = (Math.random() - 0.5) * particle.chaosInitial;
      
      const radius = baseRadius * particle.targetRadiusFactor;
      const x = radius * Math.cos(particle.angle) + initialChaosX;
      const z = radius * Math.sin(particle.angle) + initialChaosZ;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.3,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false
    });

    this.mesh = new THREE.Points(geometry, material);
    this.geometry = geometry;
    
    this.scene.add(this.mesh);
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
    
    this.position.addScaledVector(this.velocity, delta);
    
    // Calcular progreso (0.0 a 1.0)
    const progress = Math.min(this.formationTime / this.formationDuration, 1.0);
    
    // NUEVA LÓGICA: El "Techo Actual". El tornado solo puede ser tan alto como este valor.
    // Si progress es 0.5, el techo está a la mitad de la altura máxima.
    const currentCeiling = this.maxHeight * progress;

    const globalChaosFactor = 1 - progress;
    const positions = this.geometry.attributes.position.array;

    for (let i = 0; i < this.particleCount; i++) {
      const p = this.particles[i];

      p.chaosFactor = globalChaosFactor;
      p.height += p.upwardSpeed * delta;

      // ---------------------------------------------------------
      // LÓGICA DE REINICIO MEJORADA
      // Reiniciamos si supera la altura máxima GLOBAL 
      // O si supera el "TECHO DE FORMACIÓN" actual.
      // Esto fuerza a las partículas altas a volver al suelo al inicio,
      // creando el efecto de que el tornado crece desde abajo.
      // ---------------------------------------------------------
      if (p.height > this.maxHeight || p.height > currentCeiling) {
        p.height = 0; 
        p.angle = Math.random() * 2 * Math.PI;
        // Resetear fases para que no se vea repetitivo
        p.phase = Math.random() * Math.PI * 2;
        p.radialPhase = Math.random() * Math.PI * 2;
      }

      // Cálculos normales de posición (igual que antes)
      const maxRadiusAtHeight = this.calculateMaxRadius(p.height);
      const oscillation = Math.sin(this.time * 2 + p.radialPhase) * p.radialOscillation;
      const targetRadius = maxRadiusAtHeight * (p.targetRadiusFactor + oscillation * 0.1);

      const angularVel = this.calculateAngularVelocity(targetRadius, maxRadiusAtHeight, p.spinSpeed);
      p.angle += angularVel * delta;

      const turbStrength = 0.08;
      const turbFreq = 2.5;
      const turbulenceX = Math.sin(this.time * turbFreq + p.turbulenceOffset) * turbStrength;
      const turbulenceZ = Math.cos(this.time * turbFreq * 1.3 + p.turbulenceOffset) * turbStrength;

      const chaosStrength = 2.0 * p.chaosFactor; 
      const chaosX = p.chaosXFactor * chaosStrength;
      const chaosZ = p.chaosZFactor * chaosStrength;
      const chaosY = p.chaosYFactor * chaosStrength * 0.5;

      const helixAmp = 0.5;
      const helixFreq = 10;
      const helixOffset = Math.sin(p.angle * helixFreq + p.phase) * helixAmp;

      const x = targetRadius * Math.cos(p.angle) + turbulenceX + chaosX + this.position.x;
      const z = targetRadius * Math.sin(p.angle) + turbulenceZ + chaosZ + this.position.z;
      const y = p.height + helixOffset + chaosY + this.position.y;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }

    this.geometry.attributes.position.needsUpdate = true;
  }

  setParticleCount(newCount) {
    if (newCount === this.particleCount) return; 

    if (this.mesh) {
        this.scene.remove(this.mesh);
        this.geometry.dispose();
        this.mesh.material.dispose();
    }

    this.particleCount = newCount;
    this.createGeometryAndMesh();

    this.formationTime = 0;
    this.time = 0;
  }

  calculateForceOnObject(objectPos, mass) {
    const force = new THREE.Vector3();
    const torque = new THREE.Vector3();
    
    const tornadoCenter = this.position.clone();
    tornadoCenter.y = objectPos.y; 
    
    const dirToCenter = tornadoCenter.clone().sub(objectPos);
    const distance = dirToCenter.length();
    
    if (distance < this.maxRadius && distance > 0.1) {
      dirToCenter.normalize();
      
      const normalizedDistance = distance / this.maxRadius;
      const falloff = Math.pow(1 - normalizedDistance, 2);
      
      const baseForce = (this.tornadoForceStrength * falloff) / mass;
      
      force.addScaledVector(dirToCenter, baseForce * 0.7);
      
      const liftForce = (200 * falloff) / mass;
      force.y += liftForce;
      
      const tangential = new THREE.Vector3(-dirToCenter.z, 0, dirToCenter.x);
      force.addScaledVector(tangential, baseForce * 0.5);
      
      torque.y = baseForce * 1.2;
      torque.x = Math.sin(this.time * 2) * baseForce * 0.3;
      torque.z = Math.cos(this.time * 2) * baseForce * 0.3;
    }
    
    return { force, torque };
  }
}