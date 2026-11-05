import { world, system } from "@minecraft/server";

// Definitions of Ranks, Colors, and Display Names
const RANKS = {
  owner: { title: "§9[Owner]", tag: "rank:owner" },
  admin: { title: "§c[Admin]", tag: "rank:admin" },
  member: { title: "§e[Member]", tag: "rank:member" },
  visitor: { title: "§a[Visitor]", tag: "rank:visitor" }
};

// Auto-assign default rank on join & update name tags
world.afterEvents.playerSpawn.subscribe((event) => {
  const player = event.player;

  if (event.initialSpawn) {
    const tags = player.getTags();
    const hasRank = tags.some(tag => tag.startsWith("rank:"));

    // Default to 'member' if player has no rank tag assigned yet
    if (!hasRank) {
      player.addTag(RANKS.member.tag);
      player.sendMessage("§e[Server] You have been assigned the rank of §eMember§r!");
    }
  }
});

// Continuously sync player head tags and permissions every 10 ticks (0.5s)
system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    const tags = player.getTags();

    // 1. Check current assigned rank tag
    if (tags.includes(RANKS.owner.tag)) {
      player.nameTag = `${RANKS.owner.title} §f${player.name}`;
      player.runCommandAsync("op @s").catch(() => {});
    } 
    else if (tags.includes(RANKS.admin.tag)) {
      player.nameTag = `${RANKS.admin.title} §f${player.name}`;
      player.runCommandAsync("op @s").catch(() => {}); // Grants op; command access restricted in-game by rules
    } 
    else if (tags.includes(RANKS.visitor.tag)) {
      player.nameTag = `${RANKS.visitor.title} §f${player.name}`;
      player.runCommandAsync("deop @s").catch(() => {});
      player.runCommandAsync("ability @s worldbuilder false").catch(() => {});
    } 
    else {
      // Default / Member Rank
      player.nameTag = `${RANKS.member.title} §f${player.name}`;
      player.runCommandAsync("deop @s").catch(() => {});
    }
  }
}, 10);

// Admin Command to change player ranks in-game
// Usage: /tag <player> add rank:owner (or rank:admin, rank:member, rank:visitor)
