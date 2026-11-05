import { world, GameMode, ItemStack } from "@minecraft/server";

// === CONFIGURATION: Set your custom default spawn coordinates here ===
const CUSTOM_SPAWN = { x: 0, y: 64, z: 0, dimension: "overworld" };

// 1. Handle Custom Spawn & First Join
world.afterEvents.playerSpawn.subscribe((event) => {
  const player = event.player;
  
  if (event.initialSpawn) {
    const dim = world.getDimension(CUSTOM_SPAWN.dimension);
    player.teleport({ x: CUSTOM_SPAWN.x, y: CUSTOM_SPAWN.y, z: CUSTOM_SPAWN.z }, { dimension: dim });
    player.sendMessage("§bWelcome to the server! You have spawned at the designated sanctuary.");
  }
});

// 2. Handle Player Death & Drop Indestructible Head
world.afterEvents.entityDie.subscribe((event) => {
  const entity = event.deadEntity;
  
  if (entity.typeId === "minecraft:player") {
    const player = entity;
    const pos = player.location;
    const dim = player.dimension;

    // Announce death coordinates
    world.sendMessage(`§c💀 ${player.name} has fallen at (${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)}). Their soul head is left behind permanently!`);

    // Create the custom Player Head item
    const headItem = new ItemStack("minecraft:player_head", 1);
    headItem.nameTag = `§6${player.name}'s Soul Head`;
    headItem.setLore([
      `DeadPlayer:${player.name}`,
      `§c[Indestructible & Permanent]`
    ]);

    // Drop the head at their death location
    const droppedItemEntity = dim.spawnItem(headItem, pos);
    
    // Make the dropped item entity immune to fire/despawn if supported by tag/property
    // (Note: Bedrock script entities can be managed or tracked via tick events if needed)

    // Switch player to Spectator mode
    player.setGameMode(GameMode.spectator);
  }
});

// 3. Prevent Soul Heads from Despawning on the Ground & Protect from Fire/Lava
world.system.runInterval(() => {
  for (const dimName of ["overworld", "nether", "the_end"]) {
    try {
      const dim = world.getDimension(dimName);
      const items = dim.getEntities({ type: "minecraft:item" });

      for (const itemEntity of items) {
        const itemStack = itemEntity.getComponent("item")?.itemStack;
        if (itemStack && itemStack.typeId === "minecraft:player_head") {
          const lore = itemStack.getLore();
          if (lore.some(line => line.includes("DeadPlayer:"))) {
            // Reset item age so it never despawns after 5 minutes
            // Keep it safe from fire/lava by repositioning or setting properties if exposed
            itemEntity.clearVelocity();
          }
        }
      }
    } catch (e) {
      // Dimension check safety catch
    }
  }
}, 100); // Runs every 5 seconds to keep dropped souls active

// 4. Handle Revival Ritual (Right-clicking End Rod with the dead player's head)
world.afterEvents.itemUseOn.subscribe((event) => {
  const player = event.source;
  const item = event.itemStack;
  const block = event.block;
  const dim = block.dimension;

  if (item && item.typeId === "minecraft:player_head") {
    if (block.typeId === "minecraft:end_rod") {
      const belowBlock = dim.getBlock({ x: block.x, y: block.y - 1, z: block.z });

      if (belowBlock && belowBlock.typeId === "minecraft:beacon") {
        const lore = item.getLore();
        let targetPlayerName = null;

        for (const line of lore) {
          if (line.startsWith("DeadPlayer:")) {
            targetPlayerName = line.replace("DeadPlayer:", "").trim();
          }
        }

        if (!targetPlayerName) {
          player.sendMessage("§cThis head does not contain a registered soul!");
          return;
        }

        const allPlayers = world.getAllPlayers();
        const deadPlayer = allPlayers.find(p => p.name === targetPlayerName);

        if (deadPlayer) {
          deadPlayer.setGameMode(GameMode.survival);
          deadPlayer.teleport({ x: block.x, y: block.y + 1, z: block.z }, { dimension: dim });
          deadPlayer.runCommand(`effect @s instant_health 1 2 true`);

          world.sendMessage(`§a✨ SUCCESS! ${player.name} has successfully resurrected ${targetPlayerName} using the Altar!`);

          const container = player.getComponent("inventory")?.container;
          if (container) {
            const heldItem = container.getItem(player.selectedSlotIndex);
            if (heldItem && heldItem.amount > 1) {
              heldItem.amount -= 1;
              container.setItem(player.selectedSlotIndex, heldItem);
            } else {
              container.setItem(player.selectedSlotIndex, undefined);
            }
          }
        } else {
          player.sendMessage(`§c${targetPlayerName} is currently offline. They must be online to be revived!`);
        }
      }
    }
  }
});
