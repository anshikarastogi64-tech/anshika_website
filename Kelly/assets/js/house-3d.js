/**
 * 3D House Walkthrough using Three.js
 * Full architectural visualization with real-time navigation
 */

(function() {
  'use strict';

  // Three.js core
  let scene, camera, renderer, controls;
  let house, rooms = [];
  let clock, mixer;
  let autoTourActive = false;
  let currentWaypoint = 0;

  // Waypoints for auto tour
  const tourWaypoints = [
    { position: [0, 2, 25], target: [0, 2, 0], name: 'Exterior View', description: 'A modern farmhouse design blending luxury with nature' },
    { position: [0, 2, 15], target: [0, 2, 0], name: 'Approaching', description: 'Notice the Vastu-compliant entrance facing East' },
    { position: [0, 2, 5], target: [0, 2, -5], name: 'Entrance Hall', description: 'The heart of positive energy flow' },
    { position: [-8, 2, -5], target: [0, 2, -5], name: 'Living Room', description: 'North-facing for career growth and opportunities' },
    { position: [8, 2, -5], target: [0, 2, -5], name: 'Kitchen', description: 'South-East placement harnesses the fire element' },
    { position: [0, 2, -15], target: [0, 2, -10], name: 'Master Bedroom', description: 'South-West for stability and restful sleep' }
  ];

  /**
   * Initialize everything
   */
  function init() {
    initScene();
    initLights();
    buildHouse();
    initControls();
    initUI();
    animate();

    // Simulate loading
    simulateLoading();
  }

  /**
   * Simulate loading progress
   */
  function simulateLoading() {
    let progress = 0;
    const progressBar = document.getElementById('loading-progress');
    const loadingScreen = document.getElementById('loading');

    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(() => {
          loadingScreen.classList.add('loaded');
          showSceneInfo(0);
        }, 500);
      }
      progressBar.style.width = progress + '%';
    }, 100);
  }

  /**
   * Initialize Three.js scene
   */
  function initScene() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    scene.fog = new THREE.Fog(0x87CEEB, 40, 100);

    // Camera
    camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 2, 25);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Clock for animations
    clock = new THREE.Clock();

    // Window resize handler
    window.addEventListener('resize', onWindowResize, false);
  }

  /**
   * Initialize lighting
   */
  function initLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Directional light (sun)
    const sunLight = new THREE.DirectionalLight(0xfff5e1, 0.8);
    sunLight.position.set(20, 30, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.camera.left = -30;
    sunLight.shadow.camera.right = 30;
    sunLight.shadow.camera.top = 30;
    sunLight.shadow.camera.bottom = -30;
    scene.add(sunLight);

    // Point lights inside rooms
    addRoomLight(-8, 3, -5, 0xfff8dc); // Living room
    addRoomLight(8, 3, -5, 0xfff8dc);  // Kitchen
    addRoomLight(0, 3, -15, 0xffe4b5); // Bedroom
  }

  /**
   * Add point light for room
   */
  function addRoomLight(x, y, z, color) {
    const light = new THREE.PointLight(color, 0.5, 20);
    light.position.set(x, y, z);
    scene.add(light);
  }

  /**
   * Build the 3D house
   */
  function buildHouse() {
    house = new THREE.Group();

    // Ground
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d5016,
      roughness: 0.8
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Exterior walls
    buildExterior();

    // Interior rooms
    buildEntrance();
    buildLivingRoom();
    buildKitchen();
    buildBedroom();

    // Decorative elements
    addTrees();
    addFurniture();

    scene.add(house);
  }

  /**
   * Build exterior structure
   */
  function buildExterior() {
    // Main house body
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5f2ed,
      roughness: 0.7
    });

    // Front wall
    const frontWall = createWall(20, 8, 0.5, wallMaterial);
    frontWall.position.set(0, 4, 0);
    house.add(frontWall);

    // Back wall
    const backWall = createWall(20, 8, 0.5, wallMaterial);
    backWall.position.set(0, 4, -20);
    house.add(backWall);

    // Left wall
    const leftWall = createWall(0.5, 8, 20, wallMaterial);
    leftWall.position.set(-10, 4, -10);
    house.add(leftWall);

    // Right wall
    const rightWall = createWall(0.5, 8, 20, wallMaterial);
    rightWall.position.set(10, 4, -10);
    house.add(rightWall);

    // Roof
    const roofGeometry = new THREE.ConeGeometry(14, 4, 4);
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.9
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.set(0, 10, -10);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    house.add(roof);

    // Entrance door
    const doorGeometry = new THREE.BoxGeometry(2, 4, 0.2);
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0x6d4c41,
      roughness: 0.6
    });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(0, 2, 0.1);
    house.add(door);

    // Door handle
    const handleGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const handleMaterial = new THREE.MeshStandardMaterial({
      color: 0xc9a96e,
      metalness: 0.8,
      roughness: 0.2
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.set(0.7, 2, 0.3);
    house.add(handle);

    // Windows
    addWindow(-6, 4, 0.1, 2, 2);
    addWindow(6, 4, 0.1, 2, 2);
    addWindow(-9.9, 4, -5, 2, 2);
    addWindow(9.9, 4, -5, 2, 2);
  }

  /**
   * Create wall helper
   */
  function createWall(width, height, depth, material) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const wall = new THREE.Mesh(geometry, material);
    wall.castShadow = true;
    wall.receiveShadow = true;
    return wall;
  }

  /**
   * Add window
   */
  function addWindow(x, y, z, width, height) {
    const windowGeometry = new THREE.PlaneGeometry(width, height);
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x87ceeb,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    const window = new THREE.Mesh(windowGeometry, windowMaterial);
    window.position.set(x, y, z);

    if (Math.abs(z) < 1) {
      // Do nothing, already facing forward
    } else {
      window.rotation.y = Math.PI / 2;
    }

    house.add(window);

    // Window frame
    const frameGeometry = new THREE.BoxGeometry(width + 0.2, height + 0.2, 0.1);
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x8b7355 });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.position.copy(window.position);
    frame.rotation.copy(window.rotation);
    house.add(frame);
  }

  /**
   * Build entrance hall
   */
  function buildEntrance() {
    // Floor
    const floorGeometry = new THREE.BoxGeometry(20, 0.1, 8);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0xd2b48c,
      roughness: 0.8
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.set(0, 0, -4);
    floor.receiveShadow = true;
    house.add(floor);

    // Chandelier
    const chandelierGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const chandelierMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffd700,
      emissiveIntensity: 0.5,
      metalness: 0.8
    });
    const chandelier = new THREE.Mesh(chandelierGeometry, chandelierMaterial);
    chandelier.position.set(0, 6, -4);
    house.add(chandelier);

    // Chandelier light
    const chandelierLight = new THREE.PointLight(0xffd700, 1, 15);
    chandelierLight.position.copy(chandelier.position);
    house.add(chandelierLight);
  }

  /**
   * Build living room
   */
  function buildLivingRoom() {
    // Interior wall dividers
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8e4dd,
      roughness: 0.8
    });

    // Living room floor
    const floorGeometry = new THREE.BoxGeometry(8, 0.1, 8);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0xdeb887,
      roughness: 0.7
    });
    const livingFloor = new THREE.Mesh(floorGeometry, floorMaterial);
    livingFloor.position.set(-5, 0, -8);
    livingFloor.receiveShadow = true;
    house.add(livingFloor);

    // Vastu marker - North direction indicator
    const markerGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.05, 32);
    const markerMaterial = new THREE.MeshStandardMaterial({
      color: 0xc9a96e,
      emissive: 0xc9a96e,
      emissiveIntensity: 0.3
    });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(-5, 0.1, -12);
    marker.rotation.x = Math.PI / 2;
    house.add(marker);
  }

  /**
   * Build kitchen
   */
  function buildKitchen() {
    // Kitchen floor
    const floorGeometry = new THREE.BoxGeometry(8, 0.1, 8);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff8dc,
      roughness: 0.6
    });
    const kitchenFloor = new THREE.Mesh(floorGeometry, floorMaterial);
    kitchenFloor.position.set(5, 0, -8);
    kitchenFloor.receiveShadow = true;
    house.add(kitchenFloor);

    // Kitchen island
    const islandGeometry = new THREE.BoxGeometry(3, 1, 1.5);
    const islandMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.5
    });
    const island = new THREE.Mesh(islandGeometry, islandMaterial);
    island.position.set(5, 0.5, -8);
    island.castShadow = true;
    house.add(island);
  }

  /**
   * Build bedroom
   */
  function buildBedroom() {
    // Bedroom floor
    const floorGeometry = new THREE.BoxGeometry(12, 0.1, 8);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0xe6e6fa,
      roughness: 0.8
    });
    const bedroomFloor = new THREE.Mesh(floorGeometry, floorMaterial);
    bedroomFloor.position.set(0, 0, -16);
    bedroomFloor.receiveShadow = true;
    house.add(bedroomFloor);

    // Bed
    const bedFrameGeometry = new THREE.BoxGeometry(4, 0.5, 3);
    const bedMaterial = new THREE.MeshStandardMaterial({
      color: 0x4169e1,
      roughness: 0.7
    });
    const bed = new THREE.Mesh(bedFrameGeometry, bedMaterial);
    bed.position.set(0, 0.25, -16);
    bed.castShadow = true;
    house.add(bed);

    // Mattress
    const mattressGeometry = new THREE.BoxGeometry(3.8, 0.3, 2.8);
    const mattressMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9
    });
    const mattress = new THREE.Mesh(mattressGeometry, mattressMaterial);
    mattress.position.set(0, 0.65, -16);
    mattress.castShadow = true;
    house.add(mattress);
  }

  /**
   * Add trees for environment
   */
  function addTrees() {
    addTree(-15, 0, 10);
    addTree(15, 0, 10);
    addTree(-15, 0, -25);
    addTree(15, 0, -25);
  }

  /**
   * Create single tree
   */
  function addTree(x, y, z) {
    // Trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 4, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.set(x, y + 2, z);
    trunk.castShadow = true;
    scene.add(trunk);

    // Foliage
    const foliageGeometry = new THREE.SphereGeometry(2, 8, 8);
    const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 });
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.set(x, y + 5, z);
    foliage.castShadow = true;
    scene.add(foliage);
  }

  /**
   * Add furniture details
   */
  function addFurniture() {
    // Living room sofa
    const sofaGeometry = new THREE.BoxGeometry(3, 0.8, 1.5);
    const sofaMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const sofa = new THREE.Mesh(sofaGeometry, sofaMaterial);
    sofa.position.set(-5, 0.4, -6);
    sofa.castShadow = true;
    house.add(sofa);

    // Coffee table
    const tableGeometry = new THREE.BoxGeometry(1.5, 0.5, 1);
    const tableMaterial = new THREE.MeshStandardMaterial({ color: 0xdeb887 });
    const table = new THREE.Mesh(tableGeometry, tableMaterial);
    table.position.set(-5, 0.25, -8.5);
    table.castShadow = true;
    house.add(table);
  }

  /**
   * Initialize controls
   */
  function initControls() {
    // OrbitControls for manual navigation
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI / 2;
    controls.target.set(0, 2, 0);

    // Keyboard controls
    document.addEventListener('keydown', onKeyDown, false);
  }

  /**
   * Keyboard navigation
   */
  function onKeyDown(event) {
    const moveSpeed = 0.5;

    switch(event.key.toLowerCase()) {
      case 'w':
        camera.position.z -= moveSpeed;
        controls.target.z -= moveSpeed;
        break;
      case 's':
        camera.position.z += moveSpeed;
        controls.target.z += moveSpeed;
        break;
      case 'a':
        camera.position.x -= moveSpeed;
        controls.target.x -= moveSpeed;
        break;
      case 'd':
        camera.position.x += moveSpeed;
        controls.target.x += moveSpeed;
        break;
    }

    updateMinimap();
  }

  /**
   * Initialize UI controls
   */
  function initUI() {
    // Auto tour button
    document.getElementById('btn-auto').addEventListener('click', () => {
      autoTourActive = !autoTourActive;
      document.getElementById('btn-auto').classList.toggle('active');
      document.getElementById('btn-manual').classList.toggle('active');

      if (autoTourActive) {
        startAutoTour();
      }
    });

    // Reset button
    document.getElementById('btn-reset').addEventListener('click', () => {
      gsap.to(camera.position, {
        x: 0, y: 2, z: 25,
        duration: 2,
        onUpdate: () => controls.update()
      });
      gsap.to(controls.target, {
        x: 0, y: 2, z: 0,
        duration: 2
      });
    });

    // Fullscreen button
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });
  }

  /**
   * Start auto tour
   */
  function startAutoTour() {
    currentWaypoint = 0;
    moveToNextWaypoint();
  }

  /**
   * Move to next waypoint in tour
   */
  function moveToNextWaypoint() {
    if (!autoTourActive || currentWaypoint >= tourWaypoints.length) {
      autoTourActive = false;
      document.getElementById('btn-auto').classList.remove('active');
      document.getElementById('btn-manual').classList.add('active');
      return;
    }

    const waypoint = tourWaypoints[currentWaypoint];

    // Show info
    showSceneInfo(currentWaypoint);

    // Animate camera
    gsap.to(camera.position, {
      x: waypoint.position[0],
      y: waypoint.position[1],
      z: waypoint.position[2],
      duration: 3,
      ease: 'power2.inOut',
      onUpdate: () => controls.update()
    });

    gsap.to(controls.target, {
      x: waypoint.target[0],
      y: waypoint.target[1],
      z: waypoint.target[2],
      duration: 3,
      ease: 'power2.inOut',
      onComplete: () => {
        setTimeout(() => {
          currentWaypoint++;
          moveToNextWaypoint();
        }, 3000);
      }
    });
  }

  /**
   * Show scene information
   */
  function showSceneInfo(waypointIndex) {
    const waypoint = tourWaypoints[waypointIndex];
    document.getElementById('current-room').textContent = waypoint.name;
    document.getElementById('info-title').textContent = waypoint.name;
    document.getElementById('info-description').textContent = waypoint.description;

    const sceneInfo = document.getElementById('scene-info');
    sceneInfo.classList.add('visible');

    setTimeout(() => {
      sceneInfo.classList.remove('visible');
    }, 4000);
  }

  /**
   * Update minimap camera position
   */
  function updateMinimap() {
    const cameraDot = document.getElementById('camera-dot');

    // Map camera position to minimap
    const mapX = ((camera.position.x + 10) / 20) * 200;
    const mapY = ((camera.position.z + 25) / 50) * 200;

    cameraDot.style.left = mapX + 'px';
    cameraDot.style.top = mapY + 'px';
  }

  /**
   * Animation loop
   */
  function animate() {
    requestAnimationFrame(animate);

    controls.update();
    updateMinimap();

    renderer.render(scene, camera);
  }

  /**
   * Handle window resize
   */
  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
