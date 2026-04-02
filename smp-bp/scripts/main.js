import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

// ============================================================================
//  SMP QUEST SYSTEM — CONFIGURATION
// ============================================================================

// --- Quest Reward (edit here) ---
const QUEST_REWARD_ITEM  = "minecraft:diamond";
const QUEST_REWARD_COUNT = 10;

// --- Quest Pools (edit quests here) ---
// type "collect" → player must have X of an item in their inventory
// type "kill"    → player must kill players or mobs (tracked via death events)
// type "place"   → player must place specific blocks (tracked via block place)
const QUEST_POOLS = {
  farmer: [
    { id: "apples",    description: "Collect 10 Apples",       type: "collect", target: "minecraft:apple",      goal: 10 },
    { id: "wheat",     description: "Collect 32 Wheat",        type: "collect", target: "minecraft:wheat",      goal: 32 },
    { id: "carrots",   description: "Collect 16 Carrots",      type: "collect", target: "minecraft:carrot",     goal: 16 },
    { id: "potatoes",  description: "Collect 16 Potatoes",     type: "collect", target: "minecraft:potato",     goal: 16 },
    { id: "melons",    description: "Collect 20 Melon Slices", type: "collect", target: "minecraft:melon_slice", goal: 20 },
    { id: "beetroot",  description: "Collect 16 Beetroot",     type: "collect", target: "minecraft:beetroot",   goal: 16 },
    { id: "sugarcane", description: "Collect 24 Sugar Cane",   type: "collect", target: "minecraft:sugar_cane", goal: 24 },
    { id: "pumpkins",  description: "Collect 8 Pumpkins",      type: "collect", target: "minecraft:pumpkin",    goal: 8  },
    { id: "eggs",      description: "Collect 16 Eggs",         type: "collect", target: "minecraft:egg",        goal: 16 },
    { id: "bread",     description: "Collect 20 Bread",        type: "collect", target: "minecraft:bread",      goal: 20 },
  ],
  fighter: [
    { id: "slay1",     description: "Kill 1 Player",           type: "kill", target: "player",              goal: 1  },
    { id: "slay2",     description: "Kill 2 Players",          type: "kill", target: "player",              goal: 2  },
    { id: "slay3",     description: "Kill 3 Players",          type: "kill", target: "player",              goal: 3  },
    { id: "zombies",   description: "Kill 10 Zombies",         type: "kill", target: "minecraft:zombie",    goal: 10 },
    { id: "skeletons", description: "Kill 10 Skeletons",       type: "kill", target: "minecraft:skeleton",  goal: 10 },
    { id: "creepers",  description: "Kill 5 Creepers",         type: "kill", target: "minecraft:creeper",   goal: 5  },
    { id: "spiders",   description: "Kill 8 Spiders",          type: "kill", target: "minecraft:spider",    goal: 8  },
    { id: "endermen",  description: "Kill 3 Endermen",         type: "kill", target: "minecraft:enderman",  goal: 3  },
  ],
  trapper: [
    { id: "tripwire",   description: "Place 5 Tripwire Hooks", type: "place", target: "minecraft:tripwire_hook", goal: 5  },
    { id: "cobweb",     description: "Place 10 Cobwebs",       type: "place", target: "minecraft:web",          goal: 10 },
    { id: "trapdoors",  description: "Place 8 Trapdoors",      type: "place", target: "minecraft:trapdoor",     goal: 8  },
    { id: "tnt",        description: "Place 5 TNT",            type: "place", target: "minecraft:tnt",          goal: 5  },
    { id: "pistons",    description: "Place 6 Pistons",        type: "place", target: "minecraft:piston",       goal: 6  },
    { id: "observers",  description: "Place 4 Observers",      type: "place", target: "minecraft:observer",     goal: 4  },
    { id: "trap_kill",  description: "Kill 1 Player",          type: "kill",  target: "player",                 goal: 1  },
    { id: "trap_kill2", description: "Kill 2 Players",         type: "kill",  target: "player",                 goal: 2  },
  ],
};

// ============================================================================
//  HELPERS
// ============================================================================

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Current UTC day number — used to rotate quests once per real day. */
function getCurrentDay() {
  return Math.floor(Date.now() / 86400000);
}

/** Safe dynamic-property getters (return defaults when unset). */
function getPropStr(player, key) { return player.getDynamicProperty(key) ?? ""; }
function getPropNum(player, key) { return player.getDynamicProperty(key) ?? 0; }

// ============================================================================
//  ARCHETYPE SELECTION GUI
// ============================================================================

function showArchetypeForm(player, isChange) {
  const form = new ActionFormData()
    .title("§l§eChoose Your Archetype")
    .body(
      isChange
        ? "§7Select a new role. Your current quest will be replaced."
        : "§7Welcome to the server! Pick a role to get started."
    )
    .button("§l§2Farmer\n§r§7Gather crops & resources")
    .button("§l§cFighter\n§r§7Combat & PvP")
    .button("§l§5Trapper\n§r§7Set traps & ambush");

  form.show(player).then((response) => {
    if (response.canceled) {
      if (!isChange) {
        // First join — force them to choose, re-show after 1 second (20 ticks)
        system.runTimeout(() => showArchetypeForm(player, false), 20);
      }
      return;
    }

    const archetypes = ["farmer", "fighter", "trapper"];
    const labels     = ["§2Farmer", "§cFighter", "§5Trapper"];
    const chosen     = archetypes[response.selection];

    player.setDynamicProperty("smp:archetype", chosen);
    player.setDynamicProperty("smp:quest_day", 0);
    player.setDynamicProperty("smp:quest_progress", 0);
    player.setDynamicProperty("smp:quest_complete", 0);

    player.sendMessage(`§aYou are now a ${labels[response.selection]}§a!`);
    assignDailyQuest(player);
  });
}

// ============================================================================
//  QUEST ASSIGNMENT
// ============================================================================

function assignDailyQuest(player) {
  const archetype = getPropStr(player, "smp:archetype");
  if (!archetype) return;

  const pool = QUEST_POOLS[archetype];
  if (!pool || pool.length === 0) return;

  const quest = pool[randomInt(0, pool.length - 1)];
  const today = getCurrentDay();

  player.setDynamicProperty("smp:quest_id",       quest.id);
  player.setDynamicProperty("smp:quest_type",     quest.type);
  player.setDynamicProperty("smp:quest_target",   quest.target);
  player.setDynamicProperty("smp:quest_goal",     quest.goal);
  player.setDynamicProperty("smp:quest_desc",     quest.description);
  player.setDynamicProperty("smp:quest_progress", 0);
  player.setDynamicProperty("smp:quest_day",      today);
  player.setDynamicProperty("smp:quest_complete", 0);

  player.sendMessage(`§6§l[Daily Quest] §r§e${quest.description}`);
  player.sendMessage(`§7Reward: §b${QUEST_REWARD_COUNT}x Diamond`);
}

/** Assign a new quest if the UTC day has rolled over. */
function ensureDailyQuest(player) {
  const archetype = getPropStr(player, "smp:archetype");
  if (!archetype) return;
  if (getPropNum(player, "smp:quest_day") !== getCurrentDay()) {
    assignDailyQuest(player);
  }
}

// ============================================================================
//  QUEST COMPLETION & REWARD
// ============================================================================

function completeQuest(player) {
  if (getPropNum(player, "smp:quest_complete") === 1) return;
  player.setDynamicProperty("smp:quest_complete", 1);

  const desc = getPropStr(player, "smp:quest_desc");
  player.sendMessage(`§a§l[Quest Complete] §r§a${desc}`);
  player.sendMessage(`§7You received §b${QUEST_REWARD_COUNT}x Diamond§7!`);

  try {
    const inventory = player.getComponent("inventory")?.container;
    if (inventory) {
      inventory.addItem(new ItemStack(QUEST_REWARD_ITEM, QUEST_REWARD_COUNT));
    }
  } catch {
    try { player.runCommandAsync(`give @s ${QUEST_REWARD_ITEM} ${QUEST_REWARD_COUNT}`); }
    catch { /* nothing we can do */ }
  }
}

/** Increment kill/place progress and check for completion. */
function addQuestProgress(player, amount) {
  if (getPropNum(player, "smp:quest_complete") === 1) return;
  const progress = getPropNum(player, "smp:quest_progress") + amount;
  player.setDynamicProperty("smp:quest_progress", progress);
  if (progress >= getPropNum(player, "smp:quest_goal")) {
    completeQuest(player);
  }
}

// ============================================================================
//  EVENT — First Join & Returning Players
// ============================================================================

world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn) return;
  const player = event.player;

  // 2-second delay so the client is ready to receive forms
  system.runTimeout(() => {
    const archetype = getPropStr(player, "smp:archetype");

    if (!archetype) {
      // Brand-new player — open archetype picker
      showArchetypeForm(player, false);
    } else {
      // Returning player — check quest status
      ensureDailyQuest(player);

      if (getPropNum(player, "smp:quest_complete") === 1) {
        player.sendMessage("§aYou already completed today's quest. Come back tomorrow!");
      } else {
        const desc     = getPropStr(player, "smp:quest_desc");
        const progress = getPropNum(player, "smp:quest_progress");
        const goal     = getPropNum(player, "smp:quest_goal");
        const qtype    = getPropStr(player, "smp:quest_type");

        player.sendMessage(`§6§l[Daily Quest] §r§e${desc}`);
        if (qtype !== "collect") {
          player.sendMessage(`§7Progress: §f${progress}§7/§f${goal}`);
        }
      }
    }
  }, 40);
});

// ============================================================================
//  EVENT — /rolechange Chat Command
// ============================================================================

world.beforeEvents.chatSend.subscribe((event) => {
  if (event.message.trim().toLowerCase() === "/rolechange") {
    event.cancel = true;
    const player = event.sender;
    system.run(() => showArchetypeForm(player, true));
  }
});

// ============================================================================
//  EVENT — Kill Tracking (fighter & trapper kill quests)
// ============================================================================

world.afterEvents.entityDie.subscribe((event) => {
  const killer = event.damageSource?.damagingEntity;
  if (!killer || killer.typeId !== "minecraft:player") return;
  if (getPropNum(killer, "smp:quest_complete") === 1) return;
  if (getPropStr(killer, "smp:quest_type") !== "kill") return;

  const target = getPropStr(killer, "smp:quest_target");
  const dead   = event.deadEntity;

  if (target === "player" && dead.typeId === "minecraft:player") {
    addQuestProgress(killer, 1);
  } else if (target !== "player" && dead.typeId === target) {
    addQuestProgress(killer, 1);
  }
});

// ============================================================================
//  EVENT — Block Place Tracking (trapper place quests)
// ============================================================================

world.afterEvents.playerPlaceBlock.subscribe((event) => {
  const player = event.player;
  if (!player) return;
  if (getPropNum(player, "smp:quest_complete") === 1) return;
  if (getPropStr(player, "smp:quest_type") !== "place") return;

  if (event.block.typeId === getPropStr(player, "smp:quest_target")) {
    addQuestProgress(player, 1);
  }
});

// ============================================================================
//  POLLING — Farmer Collect Quests (inventory scan every 3 seconds)
// ============================================================================
// 60 ticks = 3 seconds at 20 TPS

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      if (getPropNum(player, "smp:quest_complete") === 1) continue;
      if (getPropStr(player, "smp:quest_type") !== "collect") continue;
      ensureDailyQuest(player);

      const target    = getPropStr(player, "smp:quest_target");
      const goal      = getPropNum(player, "smp:quest_goal");
      const inventory = player.getComponent("inventory")?.container;
      if (!inventory) continue;

      let count = 0;
      for (let s = 0; s < inventory.size; s++) {
        const item = inventory.getItem(s);
        if (item && item.typeId === target) count += item.amount;
      }
      if (count >= goal) completeQuest(player);
    } catch { /* player may have disconnected */ }
  }
}, 60);

// ============================================================================
//  POLLING — Daily Quest Rotation (check every 5 minutes)
// ============================================================================
// 6000 ticks = 5 minutes at 20 TPS

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try { ensureDailyQuest(player); }
    catch { /* ignore */ }
  }
}, 6000);

// ============================================================================
//  STARTUP
// ============================================================================

world.afterEvents.worldInitialize.subscribe(() => {
  world.sendMessage("§e[SMP] Quest system loaded — Daily quests active.");
});
