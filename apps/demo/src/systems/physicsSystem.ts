import { EntityWith } from "miniplex"
import { Quaternion, Vector3 } from "three"
import { BOUNDS, ECS, Entity } from "../state"
import { getEntitiesInRadius } from "./spatialHashingSystem"

const SUBSTEPS = 5

const { entities } = ECS.world.archetype("transform", "physics")

const cubes = ECS.world.archetype("isCube")

const gravity = new Vector3(0, -20, 0)

const tmpVec3 = new Vector3()
const tmpQuat = new Quaternion()

export function physicsSystem(dt: number) {
  /* Determine gravity */
  gravity.set(0, -20, 0)

  const [cube] = cubes
  tmpQuat.copy(cube.transform!.quaternion).invert()
  gravity.applyQuaternion(tmpQuat)

  for (const entity of entities) {
    const { transform, physics } = entity

    const stepTime = dt / SUBSTEPS
    for (let i = 0; i < SUBSTEPS; i++) {
      /* Apply gravity */
      physics.velocity.addScaledVector(gravity, stepTime)

      /* Apply velocity */
      transform.position.addScaledVector(physics.velocity, stepTime)

      /* Check bounds collision */
      handleWallCollision(entity)

      /* Ball collisions */
      const neighbors = getEntitiesInRadius(
        transform.position,
        physics.radius * 2
      ) as EntityWith<Entity, "transform" | "physics">[]

      for (const neighbor of neighbors) {
        if (!neighbor.physics) continue
        if (neighbor === entity) continue
        handleBallCollision(entity, neighbor)
      }
    }
  }
}

function handleWallCollision({
  physics,
  transform
}: EntityWith<Entity, "transform" | "physics">) {
  const B = BOUNDS - physics.radius
  if (transform.position.y < -B) {
    transform.position.y = -B
    physics.velocity.y *= -physics.restitution
  }

  if (transform.position.y > B) {
    transform.position.y = B
    physics.velocity.y *= -physics.restitution
  }

  if (transform.position.x < -B) {
    transform.position.x = -B
    physics.velocity.x *= -physics.restitution
  }

  if (transform.position.x > B) {
    transform.position.x = B
    physics.velocity.x *= -physics.restitution
  }

  if (transform.position.z < -B) {
    transform.position.z = -B
    physics.velocity.z *= -physics.restitution
  }

  if (transform.position.z > B) {
    transform.position.z = B
    physics.velocity.z *= -physics.restitution
  }
}

function handleBallCollision(
  a: EntityWith<Entity, "transform" | "physics">,
  b: EntityWith<Entity, "transform" | "physics">
) {
  const diff = tmpVec3.subVectors(a.transform.position, b.transform.position)
  const distance = diff.length()
  const penetration = (a.physics.radius + b.physics.radius - distance) / 2.0

  if (penetration <= 0) return

  const normal = diff.normalize()

  /* Shift objects */
  a.transform.position.addScaledVector(normal, penetration)
  b.transform.position.addScaledVector(normal, -penetration)

  /* Adjust velocities */
  const aVel = a.physics.velocity.dot(normal)
  const bVel = b.physics.velocity.dot(normal)

  const aMass = a.physics.mass
  const bMass = b.physics.mass

  const aNewVel = (aVel * (aMass - bMass) + 2 * bMass * bVel) / (aMass + bMass)
  const bNewVel = (bVel * (bMass - aMass) + 2 * aMass * aVel) / (aMass + bMass)

  a.physics.velocity.addScaledVector(normal, aNewVel - aVel)
  b.physics.velocity.addScaledVector(normal, bNewVel - bVel)
}
