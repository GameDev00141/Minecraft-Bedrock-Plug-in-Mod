import { world, system } from "@minecraft/server";

// Track player fall tracking states for the Superhero Landing
const playerFallData = new Map();

// --- CROSSHAIR TARGET HELPER FOR BOOMERANG ---
function getCrosshairTarget(player, maxDist = 40) {
  const headLoc = player.getHeadLocation();
  const viewVec = player.getViewVector();
  const candidates = player.dimension.getPlayers({ location: headLoc, maxDistance: maxDist, excludeNames: [player.name] });

  let bestTarget = null;
  let smallestAngle = 0.85;

  for (const target of candidates) {
    const dx = target.location.x - headLoc.x;
    const dy = target.location.y - headLoc.y;
    const dz = target.location.z - headLoc.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (dist === 0) continue;

    const dot = (viewVec.x * (dx/dist)) + (viewVec.y * (dy/dist)) + (viewVec.z * (dz/dist));
    if (dot > smallestAngle) {
      smallestAngle = dot;
      bestTarget = target;
    }
  }
  return bestTarget;
}

// --- THOR'S BOOMERANG THROW & HOMING LOGIC ---
world.afterEvents.itemUse.subscribe((event) => {
  const player = event.source;
  const item = event.itemStack;

  // Checks if holding a Mace or an item named Thor
  if (item && (item.typeId === "minecraft:mace" || item.nameTag?.includes("Thor"))) {
    const container = player.getComponent("inventory")?.container;
    const slot = player.selectedSlotIndex;

    if (container) container.setItem(slot, undefined);

    player.sendMessage("⚡ §eThor's Boomerang launched!");
    player.dimension.playSound("item.trident.throw", player.location);

    let currentPos = player.getHeadLocation();
    const hitList = new Set();
    let flightTicks = 0;

    const boomerangTask = system.runInterval(() => {
      flightTicks++;
      const nextTarget = getCrosshairTarget(player);

      if (nextTarget && !hitList.has(nextTarget.name)) {
        const targetPos = nextTarget.location;
        const dx = targetPos.x - currentPos.x;
        const dy = (targetPos.y + 1.0) - currentPos.y;
        const dz = targetPos.z - currentPos.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

        if (dist < 2.0) {
          const dim = nextTarget.dimension;
          dim.spawnEntity("minecraft:lightning_bolt", targetPos);
          dim.createExplosion(targetPos, 4.0, { breaksBlocks: false, causeFire: true });
          dim.playSound("item.mace.smash_air", targetPos);

          // Guaranteed one-shot bypasses protection/netherite
          try {
            nextTarget.applyDamage(99999, { cause: "override", damagingEntity: player });
          } catch (e) {
            nextTarget.runCommand(`kill @s`);
          }

          world.sendMessage(`§c⚡ BOOMERANG SMASHED ${nextTarget.name}!`);
          hitList.add(nextTarget.name);
        } else {
          currentPos.x += (dx / dist) * 1.8;
          currentPos.y += (dy / dist) * 1.8;
          currentPos.z += (dz / dist) * 1.8;
        }
      } else {
        const returnPos = player.getHeadLocation();
        const dx = returnPos.x - currentPos.x;
        const dy = returnPos.y - currentPos.y;
        const dz = returnPos.z - currentPos.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

        if (dist < 2.0 || flightTicks >= 100) {
          if (container && player.isValid()) {
            container.setItem(slot, item);
            player.dimension.playSound("item.trident.return", player.location);
            player.sendMessage("⚡ §bThe Hammer returned!");
          }
          system.clearRun(boomerangTask);
          return;
        }

        currentPos.x += (dx / dist) * 1.5;
        currentPos.y += (dy / dist) * 1.5;
        currentPos.z += (dz / dist) * 1.5;
      }

      try {
        player.dimension.spawnParticle("minecraft:critical_hit_emitter", currentPos);
      } catch(e){}
    }, 1);
  }
});

// --- SUPERHERO LANDING DETECTOR (Asgardian Fall Effect) ---
world.system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    const container = player.getComponent("inventory")?.container;
    const heldItem = container?.getItem(player.selectedSlotIndex);
    const isHoldingThorHammer = heldItem && (heldItem.typeId === "minecraft:mace" || heldItem.nameTag?.includes("Thor"));

    const velocity = player.getVelocity();
    const playerName = player.name;
    let data = playerFallData.get(playerName) || { wasFalling: false, fallStartY: player.location.y };

    if (isHoldingThorHammer) {
      if (velocity.y < -0.5) {
        data.wasFalling = true;
        if (player.location.y > data.fallStartY) {
          data.fallStartY = player.location.y;
        }
      } 
      else if (data.wasFalling && velocity.y >= 0 && Math.abs(velocity.y) < 0.05) {
        const fallHeight = data.fallStartY - player.location.y;
        
        if (fallHeight > 4.0) {
          const dim = player.dimension;
          const pos = player.location;

          dim.spawnEntity("minecraft:lightning_bolt", pos);
          dim.createExplosion(pos, 5.0, { breaksBlocks: false, causeFire: false });
          dim.playSound("entity.lightning_bolt.thunder", pos);
          dim.playSound("item.mace.smash_air", pos);

          world.sendMessage(`⚡ §b[ASGARD] REAL THOR HAS ARRIVED! ${player.name} landed with thunder!`);
        }
        data.wasFalling = false;
        data.fallStartY = player.location.y;
      }
    } else {
      data.wasFalling = false;
      data.fallStartY = player.location.y;
    }
    playerFallData.set(playerName, data);
  }
}, 2);
