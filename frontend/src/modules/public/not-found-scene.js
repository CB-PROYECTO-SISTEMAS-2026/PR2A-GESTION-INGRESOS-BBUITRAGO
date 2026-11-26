import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'

const FONT_URL =
  'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/fonts/helvetiker_bold.typeface.json'

const FLOOR_Y = 0
const GRAVITY = -22
const PAVEMENT = 0x8f8a84
const CONCERT_BLUE = 0x3b82f6
const CONCERT_BLUE_SOFT = 0x60a5fa

const SCALE = {
  amp: 1,
  par: 0.92,
  beam: 0.88,
  mic: 1,
  case: 0.96,
}

let pavementTexture
let scratchTexture
const labelTextures = new Map()

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function randomIn(min, max) {
  return min + Math.random() * (max - min)
}

function makePavementTexture() {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const slab = 128
  for (let y = 0; y < size; y += slab) {
    for (let x = 0; x < size; x += slab) {
      const tone = 132 + Math.floor(Math.random() * 18)
      ctx.fillStyle = `rgb(${tone}, ${tone - 3}, ${tone - 6})`
      ctx.fillRect(x, y, slab, slab)
      for (let n = 0; n < 80; n += 1) {
        const g = tone - 20 + Math.floor(Math.random() * 28)
        ctx.fillStyle = `rgba(${g}, ${g}, ${g}, 0.35)`
        ctx.fillRect(x + Math.random() * slab, y + Math.random() * slab, 2, 2)
      }
    }
  }
  ctx.strokeStyle = '#5c5954'
  ctx.lineWidth = 4
  for (let i = 0; i <= size; i += slab) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i, size)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i)
    ctx.lineTo(size, i)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(14, 14)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function makeScratchTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#141416'
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = 'rgba(210, 214, 220, 0.16)'
  ctx.lineWidth = 1
  for (let i = 0; i < 90; i += 1) {
    ctx.beginPath()
    const y = Math.random() * size
    ctx.moveTo(0, y)
    ctx.lineTo(size, y + randomIn(-6, 6))
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(2, 2)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeLabelTexture(word) {
  const cached = labelTextures.get(word)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f4f1ea'
  ctx.fillRect(0, 0, 256, 128)
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = 6
  ctx.strokeRect(8, 8, 240, 112)
  ctx.fillStyle = '#111111'
  ctx.font = '700 42px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(word, 128, 64)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  labelTextures.set(word, tex)
  return tex
}

function blackMetal(roughness = 0.34) {
  return new THREE.MeshPhysicalMaterial({
    color: 0x121214,
    metalness: 0.82,
    roughness,
    clearcoat: 0.25,
    clearcoatRoughness: 0.4,
  })
}

function silverMetal() {
  return new THREE.MeshStandardMaterial({ color: 0xc5c8ce, metalness: 0.95, roughness: 0.22 })
}

function tolex() {
  return new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.78, metalness: 0.04 })
}

function createAmp() {
  const group = new THREE.Group()
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.95, 0.52), tolex())
  cab.position.y = 0.5
  const grille = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.62, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x2a241c, roughness: 0.9, metalness: 0.02 }),
  )
  grille.position.set(0, 0.42, 0.26)
  const logo = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.1, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xd6b25e, metalness: 0.7, roughness: 0.32 }),
  )
  logo.position.set(0, 0.82, 0.27)
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.08, 0.16), blackMetal(0.4))
  panel.position.set(0, 0.99, 0.08)
  group.add(cab, grille, logo, panel)
  for (let i = 0; i < 4; i += 1) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.04, 12), silverMetal())
    knob.position.set(-0.3 + i * 0.2, 1.04, 0.08)
    group.add(knob)
  }
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 8, 16, Math.PI), silverMetal())
  handle.rotation.z = Math.PI
  handle.position.set(0, 0.98, -0.1)
  group.add(handle)
  group.scale.setScalar(SCALE.amp)
  return group
}

function attachBeam(group, aim) {
  const spot = new THREE.SpotLight(CONCERT_BLUE_SOFT, 240, 9, 0.3, 0.5, 1.5)
  aim.add(spot)
  const target = new THREE.Object3D()
  spot.target = target
  group.userData.beam = { aim, target, spot }
  return group
}

function createPar(lit) {
  const group = new THREE.Group()
  const yokeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.06), blackMetal())
  yokeL.position.set(-0.28, 0.28, -0.05)
  const yokeR = yokeL.clone()
  yokeR.position.x = 0.28
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.58, 20), blackMetal(0.3))
  can.rotation.x = Math.PI / 2
  can.position.set(0, 0.42, 0.08)
  const lensMat = new THREE.MeshStandardMaterial({
    color: lit ? 0xdbeafe : 0x1e293b,
    emissive: lit ? CONCERT_BLUE : 0x000000,
    emissiveIntensity: lit ? 0.85 : 0,
    metalness: 0.2,
    roughness: 0.25,
  })
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), lensMat)
  lens.position.set(0, 0.42, 0.38)
  group.add(yokeL, yokeR, can, lens)
  if (lit) {
    const aim = new THREE.Object3D()
    aim.position.copy(lens.position)
    group.add(aim)
    attachBeam(group, aim)
  }
  group.scale.setScalar(SCALE.par)
  return group
}

function createBeam(lit) {
  const group = new THREE.Group()
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.36), blackMetal(0.4))
  base.position.y = 0.08
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.05), silverMetal())
  armL.position.set(-0.16, 0.32, 0)
  const armR = armL.clone()
  armR.position.x = 0.16
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.34), blackMetal(0.28))
  head.position.set(0, 0.46, 0.02)
  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(0.08, 16),
    new THREE.MeshStandardMaterial({
      color: lit ? 0xe0f2fe : 0x0f172a,
      emissive: lit ? CONCERT_BLUE_SOFT : 0x000000,
      emissiveIntensity: lit ? 1.1 : 0,
      roughness: 0.2,
    }),
  )
  lens.position.set(0, 0.46, 0.2)
  group.add(base, armL, armR, head, lens)
  if (lit) {
    const aim = new THREE.Object3D()
    aim.position.copy(lens.position)
    group.add(aim)
    attachBeam(group, aim)
  }
  group.scale.setScalar(SCALE.beam)
  return group
}

function createMicStand() {
  const group = new THREE.Group()
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 20), blackMetal(0.45))
  base.position.y = 0.02
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 1.7, 10), silverMetal())
  pole.position.y = 0.88
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 8), silverMetal())
  boom.rotation.z = Math.PI / 2.2
  boom.position.set(0.2, 1.62, 0)
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.04), blackMetal())
  clip.position.set(0.46, 1.68, 0)
  group.add(base, pole, boom, clip)
  group.userData.collider = 'pole'
  group.scale.setScalar(SCALE.mic)
  return group
}

function createFlightCase(label) {
  const group = new THREE.Group()
  const shell = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.62, 0.7), blackMetal(0.46))
  shell.position.y = 0.34
  group.add(shell)
  const corners = [
    [-1, -1, -1],
    [1, -1, -1],
    [-1, 1, -1],
    [1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [-1, 1, 1],
    [1, 1, 1],
  ]
  corners.forEach(([x, y, z]) => {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.12), silverMetal())
    cap.position.set(x * 0.48, 0.34 + y * 0.26, z * 0.3)
    group.add(cap)
  })
  const tag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.46, 0.22),
    new THREE.MeshStandardMaterial({ map: makeLabelTexture(label), roughness: 0.6, metalness: 0.05 }),
  )
  tag.position.set(0, 0.36, 0.36)
  group.add(tag)
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 14, Math.PI), silverMetal())
  handle.position.set(0, 0.66, 0)
  handle.rotation.z = Math.PI
  group.add(handle)
  group.scale.setScalar(SCALE.case)
  return group
}

function createProp(spec) {
  if (spec.type === 'amp') return createAmp()
  if (spec.type === 'par') return createPar(spec.lit)
  if (spec.type === 'beam') return createBeam(spec.lit)
  if (spec.type === 'mic') return createMicStand()
  return createFlightCase(spec.label || 'TOUR')
}

function add404Typography(scene, font) {
  if (!scratchTexture) scratchTexture = makeScratchTexture()
  const faceMat = new THREE.MeshPhysicalMaterial({
    map: scratchTexture,
    roughnessMap: scratchTexture,
    color: 0x0c0c0e,
    metalness: 0.94,
    roughness: 0.28,
    clearcoat: 0.45,
    clearcoatRoughness: 0.32,
  })
  const glyphs = [
    { char: '4', x: -2.45 },
    { char: '0', x: 0 },
    { char: '4', x: 2.45 },
  ]
  const group = new THREE.Group()
  glyphs.forEach(({ char, x }) => {
    const geometry = new TextGeometry(char, {
      font,
      size: 2.85,
      depth: 0.32,
      curveSegments: 8,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.022,
      bevelSegments: 2,
    })
    geometry.center()
    const digit = new THREE.Mesh(geometry, faceMat)
    digit.position.x = x
    digit.castShadow = true
    digit.receiveShadow = true
    group.add(digit)
  })
  group.rotation.x = -Math.PI / 2 + 0.06
  group.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(group)
  group.position.y = FLOOR_Y - bounds.min.y + 0.02
  group.updateMatrixWorld(true)
  scene.add(group)
  return group
}

function addTrimeshBody(world, mesh) {
  mesh.updateWorldMatrix(true, true)
  const geom = mesh.geometry
  const pos = geom.getAttribute('position')
  const verts = new Float32Array(pos.count * 3)
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
    verts[i * 3] = v.x
    verts[i * 3 + 1] = v.y
    verts[i * 3 + 2] = v.z
  }
  let indices
  if (geom.index) {
    indices = Uint32Array.from(geom.index.array)
  } else {
    indices = new Uint32Array(pos.count)
    for (let i = 0; i < pos.count; i += 1) indices[i] = i
  }
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  world.createCollider(RAPIER.ColliderDesc.trimesh(verts, indices), body)
}

function addConcertLights(scene, digits) {
  const floorTarget = new THREE.Object3D()
  floorTarget.position.set(0, FLOOR_Y, 0.2)
  scene.add(floorTarget)
  const digitTarget = new THREE.Object3D()
  digits.add(digitTarget)
  digitTarget.position.set(0, 0.2, 0.15)

  const created = [floorTarget, digitTarget]
  const rigs = [
    { pos: [-2.4, 6.4, 8.6], color: CONCERT_BLUE, intensity: 560, angle: 0.52, target: floorTarget, shadow: true },
    { pos: [2.6, 6.1, 8.4], color: CONCERT_BLUE_SOFT, intensity: 520, angle: 0.46, target: digitTarget, shadow: false },
    { pos: [0.2, 5.2, 9.6], color: CONCERT_BLUE, intensity: 480, angle: 0.58, target: digitTarget, shadow: false },
  ]
  rigs.forEach(({ pos, color, intensity, angle, target, shadow }) => {
    const light = new THREE.SpotLight(color, intensity, 36, angle, 0.35, 1.15)
    light.position.set(pos[0], pos[1], pos[2])
    light.target = target
    light.castShadow = shadow
    if (shadow) light.shadow.mapSize.set(1024, 1024)
    scene.add(light)
    created.push(light)
  })
  return created
}

function computeBoxColliderSize(mesh) {
  const box = new THREE.Box3().setFromObject(mesh)
  const size = box.getSize(new THREE.Vector3())
  size.x = Math.max(size.x, 0.08)
  size.y = Math.max(size.y, 0.08)
  size.z = Math.max(size.z, 0.08)
  return size.multiplyScalar(0.48)
}

function addDynamicBody(world, mesh, position, spin) {
  mesh.position.set(0, 0, 0)
  mesh.rotation.set(0, 0, 0)
  mesh.updateMatrixWorld(true)
  const euler = new THREE.Euler(randomIn(0, Math.PI), randomIn(0, Math.PI), randomIn(0, Math.PI))
  const quat = new THREE.Quaternion().setFromEuler(euler)
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      .setLinvel(0, 0, 0)
      .setAngvel({
        x: spin ? randomIn(-3.2, 3.2) : randomIn(-1.4, 1.4),
        y: randomIn(-1.2, 1.2),
        z: spin ? randomIn(-3.2, 3.2) : randomIn(-1.4, 1.4),
      })
      .setLinearDamping(0.22)
      .setAngularDamping(0.38),
  )
  const scale = mesh.scale.x || 1
  const half = computeBoxColliderSize(mesh)
  const collider =
    mesh.userData.collider === 'pole'
      ? RAPIER.ColliderDesc.cuboid(0.045 * scale, 0.86 * scale, 0.045 * scale).setTranslation(0, 0.86 * scale, 0)
      : RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
  collider.setRestitution(0.06).setFriction(0.92).setDensity(mesh.userData.collider === 'pole' ? 0.45 : 0.85)
  world.createCollider(collider, body)
  return body
}

function syncBodyToMesh(body, mesh) {
  const t = body.translation()
  const r = body.rotation()
  mesh.position.set(t.x, t.y, t.z)
  mesh.quaternion.set(r.x, r.y, r.z, r.w)
}

function visibleFloorRect(camera) {
  camera.updateMatrixWorld()
  const pts = []
  const raycaster = new THREE.Raycaster()
  ;[
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ].forEach(([x, y]) => {
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
    const { origin, direction } = raycaster.ray
    if (Math.abs(direction.y) < 1e-4) return
    const t = (FLOOR_Y - origin.y) / direction.y
    if (t <= 0) return
    pts.push(origin.clone().addScaledVector(direction, t))
  })
  if (pts.length < 3) {
    return { minX: -4, maxX: 4, minZ: -3, maxZ: 3 }
  }
  const xs = pts.map((p) => p.x)
  const zs = pts.map((p) => p.z)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const padX = (maxX - minX) * 0.24
  const padZ = (maxZ - minZ) * 0.24
  return { minX: minX + padX, maxX: maxX - padX, minZ: minZ + padZ, maxZ: maxZ - padZ }
}

function clampView(x, z, view) {
  return {
    x: THREE.MathUtils.clamp(x, view.minX, view.maxX),
    z: THREE.MathUtils.clamp(z, view.minZ, view.maxZ),
  }
}

function nearDigits(box, view) {
  const cx = (box.min.x + box.max.x) / 2
  const cz = (box.min.z + box.max.z) / 2
  return clampView(cx + randomIn(-1.55, 1.55), cz + randomIn(-1.15, 1.15), view)
}

function buildDropPlan(digits, view) {
  const box = new THREE.Box3().setFromObject(digits)
  const left = new THREE.Vector3()
  const right = new THREE.Vector3()
  digits.children[0].getWorldPosition(left)
  digits.children[2].getWorldPosition(right)
  const stack = nearDigits(box, view)
  const a = nearDigits(box, view)
  const b = nearDigits(box, view)
  const c = nearDigits(box, view)
  const d = nearDigits(box, view)
  const e = nearDigits(box, view)
  const micL = clampView(left.x, left.z, view)
  const micR = clampView(right.x, right.z, view)
  return [
    { type: 'amp', x: a.x, z: a.z, y: 8.4, delay: 80 },
    { type: 'amp', x: b.x, z: b.z, y: 10.2, delay: 360 },
    { type: 'par', lit: false, x: c.x, z: c.z, y: 9.2, delay: 640 },
    { type: 'par', lit: true, x: d.x, z: d.z, y: 11.4, delay: 920 },
    { type: 'beam', lit: true, x: e.x, z: e.z, y: 10.6, delay: 1180 },
    { type: 'mic', x: micL.x, z: micL.z, y: 8.8, delay: 420, spin: true },
    { type: 'mic', x: micR.x, z: micR.z, y: 10.8, delay: 760, spin: true },
    { type: 'case', label: 'FRAGILE', x: stack.x, z: stack.z, y: 7.6, delay: 200 },
    { type: 'case', label: 'TOUR', x: stack.x + 0.08, z: stack.z, y: 9.8, delay: 520 },
    { type: 'case', label: 'FRAGILE', x: stack.x, z: stack.z + 0.06, y: 12, delay: 860 },
  ].map((spec) => ({ ...spec, mesh: null, body: null, released: false }))
}

function updateBeams(drops) {
  const origin = new THREE.Vector3()
  const dir = new THREE.Vector3()
  drops.forEach((drop) => {
    const beam = drop.mesh?.userData.beam
    if (!beam) return
    beam.aim.getWorldPosition(origin)
    beam.aim.getWorldDirection(dir)
    beam.target.position.copy(origin).addScaledVector(dir, 5)
  })
}

function disposeObject(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose()
    if (obj.material) {
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
      materials.forEach((m) => m.dispose())
    }
  })
}

/** Pavimento, 404 de metal negro y backline de concierto. La cámara no se modifica. */
export async function mountNotFoundScene(canvas) {
  await RAPIER.init()
  const reduceMotion = prefersReducedMotion()

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(PAVEMENT, 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.18
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(PAVEMENT)

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 90)
  const cameraBase = { x: 0, y: 11.5, z: 9.2 }
  camera.position.set(cameraBase.x, cameraBase.y, cameraBase.z)
  camera.lookAt(0, 0.1, 0)

  scene.add(new THREE.AmbientLight(0x1c1917, 0.28))

  if (!pavementTexture) pavementTexture = makePavementTexture()
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({
      map: pavementTexture,
      color: 0xffffff,
      roughness: 0.94,
      metalness: 0.02,
    }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = FLOOR_Y
  floor.receiveShadow = true
  scene.add(floor)

  const world = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 })
  const floorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.08, 0))
  world.createCollider(RAPIER.ColliderDesc.cuboid(80, 0.08, 80), floorBody)

  const font = await new Promise((resolve, reject) => {
    new FontLoader().load(FONT_URL, resolve, undefined, reject)
  })
  const digits = add404Typography(scene, font)
  digits.children.forEach((child) => addTrimeshBody(world, child))
  const stageLights = addConcertLights(scene, digits)

  let width = 1
  let height = 1
  let pointerX = 0
  let pointerY = 0

  function resize() {
    const parent = canvas.parentElement
    if (!parent) return
    width = parent.clientWidth
    height = parent.clientHeight
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    const narrow = width / height < 0.85
    camera.fov = narrow ? 38 : 34
    cameraBase.z = narrow ? 10.8 : 9.2
    cameraBase.y = narrow ? 12.8 : 11.5
    camera.updateProjectionMatrix()
  }

  resize()
  window.addEventListener('resize', resize)

  const view = visibleFloorRect(camera)
  const dropPlan = buildDropPlan(digits, view)
  const sceneProps = []

  if (reduceMotion) {
    dropPlan.forEach((spec) => {
      const mesh = createProp(spec)
      mesh.position.set(spec.x, FLOOR_Y + 0.02, spec.z)
      mesh.rotation.y = randomIn(-0.4, 0.4)
      scene.add(mesh)
      if (mesh.userData.beam) scene.add(mesh.userData.beam.target)
      spec.mesh = mesh
      spec.released = true
      sceneProps.push(mesh)
    })
  }

  function onPointerMove(event) {
    pointerX = (event.clientX / width - 0.5) * 1.1
    pointerY = (event.clientY / height - 0.5) * 0.55
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true })

  let raf = 0
  const clock = new THREE.Clock()
  let elapsedMs = 0
  let physicsActive = !reduceMotion

  const tick = () => {
    raf = requestAnimationFrame(tick)
    const dt = Math.min(clock.getDelta(), 0.033)
    elapsedMs += dt * 1000

    camera.position.x += (cameraBase.x + pointerX - camera.position.x) * 0.04
    camera.position.y += (cameraBase.y - pointerY - camera.position.y) * 0.04
    camera.position.z += (cameraBase.z - camera.position.z) * 0.04
    camera.lookAt(0, 0.1, 0)

    if (!reduceMotion) {
      for (const drop of dropPlan) {
        if (drop.released || elapsedMs < drop.delay) continue
        drop.mesh = createProp(drop)
        scene.add(drop.mesh)
        if (drop.mesh.userData.beam) scene.add(drop.mesh.userData.beam.target)
        drop.body = addDynamicBody(world, drop.mesh, new THREE.Vector3(drop.x, drop.y, drop.z), drop.spin)
        drop.released = true
        sceneProps.push(drop.mesh)
      }

      if (physicsActive) {
        world.step()
        let awake = 0
        for (const drop of dropPlan) {
          if (!drop.body) continue
          syncBodyToMesh(drop.body, drop.mesh)
          if (!drop.body.isSleeping()) awake += 1
        }
        if (awake === 0 && dropPlan.every((d) => d.released)) physicsActive = false
      }
    }

    updateBeams(dropPlan)
    renderer.render(scene, camera)
  }

  raf = requestAnimationFrame(tick)

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
    window.removeEventListener('pointermove', onPointerMove)
    dropPlan.forEach((drop) => {
      const target = drop.mesh?.userData.beam?.target
      if (target) scene.remove(target)
    })
    sceneProps.forEach((m) => {
      scene.remove(m)
      disposeObject(m)
    })
    disposeObject(digits)
    disposeObject(floor)
    stageLights.forEach((l) => scene.remove(l))
    scene.clear()
    world.free()
    renderer.dispose()
    if (pavementTexture) {
      pavementTexture.dispose()
      pavementTexture = undefined
    }
    if (scratchTexture) {
      scratchTexture.dispose()
      scratchTexture = undefined
    }
    labelTextures.forEach((tex) => tex.dispose())
    labelTextures.clear()
  }
}
