import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

// ============================================================================
//  AIRDROP SYSTEM — CONFIGURATION
// ============================================================================

// --- Loot Pool (edit items here) ---
const LOOT_POOL = [
  { itemId: "minecraft:diamond",                minCount: 1, maxCount: 4,  weight: 10 },
  { itemId: "minecraft:netherite_ingot",        minCount: 1, maxCount: 2,  weight: 3  },
  { itemId: "minecraft:golden_apple",           minCount: 1, maxCount: 3,  weight: 8  },
  { itemId: "minecraft:enchanted_golden_apple", minCount: 1, maxCount: 1,  weight: 2  },
  { itemId: "minecraft:ender_pearl",            minCount: 2, maxCount: 8,  weight: 12 },
  { itemId: "minecraft:diamond_sword",          minCount: 1, maxCount: 1,  weight: 5  },
  { itemId: "minecraft:diamond_chestplate",     minCount: 1, maxCount: 1,  weight: 4  },
  { itemId: "minecraft:diamond_helmet",         minCount: 1, maxCount: 1,  weight: 4  },
  { itemId: "minecraft:diamond_leggings",       minCount: 1, maxCount: 1,  weight: 4  },
  { itemId: "minecraft:diamond_boots",          minCount: 1, maxCount: 1,  weight: 4  },
  { itemId: "minecraft:totem_of_undying",       minCount: 1, maxCount: 1,  weight: 2  },
  { itemId: "minecraft:experience_bottle",      minCount: 4, maxCount: 16, weight: 10 },
  { itemId: "minecraft:tnt",                    minCount: 2, maxCount: 8,  weight: 6  },
  { itemId: "minecraft:arrow",                  minCount: 8, maxCount: 32, weight: 12 },
  { itemId: "minecraft:iron_ingot",             minCount: 4, maxCount: 16, weight: 15 },
  { itemId: "minecraft:gold_ingot",             minCount: 2, maxCount: 8,  weight: 12 },
  { itemId: "minecraft:obsidian",               minCount: 2, maxCount: 6,  weight: 8  },
];

// --- Timer & Radius (Minecraft runs at 20 ticks/second) ---
// 20 minutes = 20 × 60 × 20 = 24,000 ticks
//  5 minutes =  5 × 60 × 20 =  6,000 ticks
const AIRDROP_INTERVAL_TICKS = 24000;
const DESPAWN_DELAY_TICKS    = 6000;
const AIRDROP_RADIUS         = 500;
const LOOT_SLOT_COUNT        = 7;
const OVERWORLD_DIMENSION    = "overworld";

// ============================================================================
//  SMP QUEST SYSTEM — CONFIGURATION
// ============================================================================

// --- Quest Reward ---
const QUEST_REWARD_ITEM  = "minecraft:diamond";
const QUEST_REWARD_COUNT = 10;

// --- Quest Pools (edit quests here) ---
// type "collect"  → player must have X of an item in their inventory
// type "kill"     → player must kill players (tracked via death events)
// type "place"    → player must place specific blocks (tracked via block place)
const QUEST_POOLS = {
  farmer: [
    { id: "apples",    description: "Collect 10 Apples",     type: "collect", target: "minecraft:apple",     goal: 10 },
    { id: "wheat",     description: "Collect 32 Wheat",      type: "collect", target: "minecraft:wheat",     goal: 32 },
    { id: "carrots",   description: "Collect 16 Carrots",    type: "collect", target: "minecraft:carrot",    goal: 16 },
    { id: "potatoes",  description: "Collect 16 Potatoes",   type: "collect", target: "minecraft:potato",    goal: 16 },
    { id: "melons",    description: "Collect 20 Melon Slices", type: "collect", target: "minecraft:melon_slice", goal: 20 },
    { id: "beetroot",  description: "Collect 16 Beetroot",   type: "collect", target: "minecraft:beetroot",  goal: 16 },
    { id: "sugarcane", description: "Collect 24 Sugar Cane", type: "collect", target: "minecraft:sugar_cane", goal: 24 },
    { id: "pumpkins",  description: "Collect 8 Pumpkins",    type: "collect", target: "minecraft:pumpkin",   goal: 8  },
    { id: "eggs",      description: "Collect 16 Eggs",       type: "collect", target: "minecraft:egg",       goal: 16 },
    { id: "bread",     description: "Collect 20 Bread",      type: "collect", target: "minecraft:bread",     goal: 20 },
  ],
  fighter: [
    { id: "slay1",     description: "Kill 1 Player",         type: "kill",    target: "player",              goal: 1 },
    { id: "slay2",     description: "Kill 2 Players",        type: "kill",    target: "player",              goal: 2 },
    { id: "slay3",     description: "Kill 3 Players",        type: "kill",    target: "player",              goal: 3 },
    { id: "zombies",   description: "Kill 10 Zombies",       type: "kill",    target: "minecraft:zombie",    goal: 10 },
    { id: "skeletons", description: "Kill 10 Skeletons",     type: "kill",    target: "minecraft:skeleton",  goal: 10 },
    { id: "creepers",  description: "Kill 5 Creepers",       type: "kill",    target: "minecraft:creeper",   goal: 5  },
    { id: "spiders",   description: "Kill 8 Spiders",        type: "kill",    target: "minecraft:spider",    goal: 8  },
    { id: "endermen",  description: "Kill 3 Endermen",       type: "kill",    target: "minecraft:enderman",  goal: 3  },
  ],
  trapper: [
    { id: "tripwire",  description: "Place 5 Tripwire Hooks",  type: "place", target: "minecraft:tripwire_hook", goal: 5 },
    { id: "cobweb",    description: "Place 10 Cobwebs",        type: "place", target: "minecraft:web",          goal: 10 },
    { id: "trapdoors", description: "Place 8 Trapdoors",       type: "place", target: "minecraft:trapdoor",     goal: 8 },
    { id: "tnt",       description: "Place 5 TNT",             type: "place", target: "minecraft:tnt",          goal: 5 },
    { id: "pistons",   description: "Place 6 Pistons",         type: "place", target: "minecraft:piston",       goal: 6 },
    { id: "observers", description: "Place 4 Observers",       type: "place", target: "minecraft:observer",     goal: 4 },
    { id: "trap_kill",  description: "Kill 1 Player",          type: "kill",  target: "player",                 goal: 1 },
    { id: "trap_kill2", description: "Kill 2 Players",         type: "kill",  target: "player",                 goal: 2 },
  ],
};

// ============================================================================
//  SHARED HELPERS
// ============================================================================

/** Random integer in [min, max] (inclusive). */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Weighted random pick from the loot pool. */
function pickWeightedItem() {
  const totalWeight = LOOT_POOL.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of LOOT_POOL) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return LOOT_POOL[LOOT_POOL.length - 1];
}

/** Get the current real-world day number (UTC). Used to rotate daily quests. */
function getCurrentDay() {
  return Math.floor(Date.now() / 86400000);
}

// ============================================================================
//  AIRDROP SYSTEM — LOGIC
// ============================================================================

/** Scan downward to find the surface Y at a given X/Z column. */
function getSurfaceY(dimension, x, z) {
  const MAX_Y = 319;
  const MIN_Y = -64;
  for (let y = MAX_Y; y >= MIN_Y; y--) {
    try {
      const block = dimension.getBlock({ x, y, z });
      if (block && block.typeId !== "minecraft:air") return y + 1;
    } catch { continue; }
  }
  return 64;
}

/** Fill a chest at (x, y, z) with random loot. */
function fillChestWithLoot(dimension, x, y, z) {
  try {
    const block = dimension.getBlock({ x, y, z });
    if (!block || block.typeId !== "minecraft:chest") return;
    const container = block.getComponent("inventory")?.container;
    if (!container) return;

    const usedSlots = new Set();
    for (let i = 0; i < LOOT_SLOT_COUNT; i++) {
      let slot, attempts = 0;
      do { slot = randomInt(0, container.size - 1); attempts++; }
      while (usedSlots.has(slot) && attempts < container.size);
      usedSlots.add(slot);

      const loot = pickWeightedItem();
      try { container.setItem(slot, new ItemStack(loot.itemId, randomInt(loot.minCount, loot.maxCount))); }
      catch { /* skip slot */ }
    }
  } catch { /* chest gone — ignore */ }
}

/** Core airdrop: pick random coords, place chest, fill loot, schedule despawn. */
function spawnAirdrop() {
  const dimension = world.getDimension(OVERWORLD_DIMENSION);
  const x = randomInt(-AIRDROP_RADIUS, AIRDROP_RADIUS);
  const z = randomInt(-AIRDROP_RADIUS, AIRDROP_RADIUS);
  const y = getSurfaceY(dimension, x, z);

  try {
    const block = dimension.getBlock({ x, y, z });
    if (!block) {
      world.sendMessage("§cAirdrop failed — target area not loaded. Retrying next cycle.");
      return;
    }
    block.setType("minecraft:chest");
  } catch {
    world.sendMessage("§cAirdrop failed — target area not loaded. Retrying next cycle.");
    return;
  }

  // Fill loot 1 tick later so the block entity is ready
  system.runTimeout(() => fillChestWithLoot(dimension, x, y, z), 1);

  world.sendMessage(`§aAirdrop deployed at X: ${x} Z: ${z}! You have 5 minutes to get it!`);

  // Despawn after 5 minutes if unclaimed
  system.runTimeout(() => {
    try {
      const block = dimension.getBlock({ x, y, z });
      if (block && block.typeId === "minecraft:chest") {
        block.setType("minecraft:air");
        world.sendMessage("§cThe airdrop has disappeared!");
      }
    } catch { /* chunk unloaded — ignore */ }
  }, DESPAWN_DELAY_TICKS);
}

// Start the airdrop loop — fires every 24,000 ticks (20 minutes)
system.runInterval(() => spawnAirdrop(), AIRDROP_INTERVAL_TICKS);

// ============================================================================
//  SMP QUEST SYSTEM — LOGIC
// ============================================================================

// --- Dynamic Property Keys ---
// "smp:archetype"       → "farmer" | "fighter" | "trapper" | "" (none yet)
// "smp:quest_id"        → quest id string (e.g. "apples")
// "smp:quest_progress"  → number of kills/placements tracked so far
// "smp:quest_goal"      → total needed to complete the quest
// "smp:quest_type"      → "collect" | "kill" | "place"
// "smp:quest_target"    → item/entity/block id the quest tracks
// "smp:quest_desc"      → human-readable quest description
// "smp:quest_day"       → the UTC day number the quest was assigned
// "smp:quest_complete"  → 1 if already rewarded today, 0 otherwise

/** Safe getter — returns "" or 0 if property not set. */
function getPropStr(player, key)  { return player.getDynamicProperty(key) ?? ""; }
function getPropNum(player, key)  { return player.getDynamicProperty(key) ?? 0; }

// -------------------------------------------------------------------------
//  Archetype Selection GUI
// -------------------------------------------------------------------------

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

  // Forms must be shown outside of read-only event callbacks.
  // We use system.run() to push it to the next tick if needed.
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
    // Reset quest state so a new quest is assigned immediately
    player.setDynamicProperty("smp:quest_day", 0);
    player.setDynamicProperty("smp:quest_progress", 0);
    player.setDynamicProperty("smp:quest_complete", 0);

    player.sendMessage(`§aYou are now a ${labels[response.selection]}§a!`);
    assignDailyQuest(player);
  });
}

// -------------------------------------------------------------------------
//  Quest Assignment
// -------------------------------------------------------------------------

function assignDailyQuest(player) {
  const archetype = getPropStr(player, "smp:archetype");
  if (!archetype) return; // no archetype chosen yet

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

/** Check whether a player needs a new quest today and assign one if so. */
function ensureDailyQuest(player) {
  const archetype = getPropStr(player, "smp:archetype");
  if (!archetype) return;
  const today    = getCurrentDay();
  const questDay = getPropNum(player, "smp:quest_day");
  if (questDay !== today) {
    assignDailyQuest(player);
  }
}

// -------------------------------------------------------------------------
//  Quest Completion & Reward
// -------------------------------------------------------------------------

function completeQuest(player) {
  if (getPropNum(player, "smp:quest_complete") === 1) return; // already done

  player.setDynamicProperty("smp:quest_complete", 1);

  const desc = getPropStr(player, "smp:quest_desc");
  player.sendMessage(`§a§l[Quest Complete] §r§a${desc}`);
  player.sendMessage(`§7You received §b${QUEST_REWARD_COUNT}x Diamond§7!`);

  // Give reward — try to add to inventory, drop if full
  try {
    const inventory = player.getComponent("inventory")?.container;
    if (inventory) {
      const reward = new ItemStack(QUEST_REWARD_ITEM, QUEST_REWARD_COUNT);
      const leftover = inventory.addItem(reward);
      // addItem returns undefined on success in newer APIs
    }
  } catch {
    // Fallback: run a /give command if direct inventory fails
    try {
      player.runCommandAsync(`give @s ${QUEST_REWARD_ITEM} ${QUEST_REWARD_COUNT}`);
    } catch { /* nothing we can do */ }
  }
}

/** Add progress toward a kill/place quest and check for completion. */
function addQuestProgress(player, amount) {
  if (getPropNum(player, "smp:quest_complete") === 1) return;
  const progress = getPropNum(player, "smp:quest_progress") + amount;
  player.setDynamicProperty("smp:quest_progress", progress);
  const goal = getPropNum(player, "smp:quest_goal");
  if (progress >= goal) {
    completeQuest(player);
  }
}

// -------------------------------------------------------------------------
//  Event Listeners — First Join & /rolechange
// -------------------------------------------------------------------------

// Detect first join (or rejoin after data wipe) and show the archetype GUI.
world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn) return; // only on first spawn after (re)joining
  const player = event.player;

  // Small delay so the player's client is ready to receive forms
  system.runTimeout(() => {
    const archetype = getPropStr(player, "smp:archetype");
    if (!archetype) {
      // First time — show selection GUI
      showArchetypeForm(player, false);
    } else {
      // Returning player — make sure they have today's quest
      ensureDailyQuest(player);
      const complete = getPropNum(player, "smp:quest_complete");
      if (complete !== 1) {
        const desc = getPropStr(player, "smp:quest_desc");
        player.sendMessage(`§6§l[Daily Quest] §r§e${desc}`);
        const progress = getPropNum(player, "smp:quest_progress");
        const goal     = getPropNum(player, "smp:quest_goal");
        const qtype    = getPropStr(player, "smp:quest_type");
        if (qtype !== "collect") {
          player.sendMessage(`§7Progress: §f${progress}§7/§f${goal}`);
        }
      } else {
        player.sendMessage("§aYou already completed today's quest. Come back tomorrow!");
      }
    }
  }, 40); // 2-second delay for client readiness
});

// Intercept /rolechange chat command.
world.beforeEvents.chatSend.subscribe((event) => {
  const msg = event.message.trim().toLowerCase();
  if (msg === "/rolechange") {
    event.cancel = true;
    const player = event.sender;
    // Must show form outside the read-only beforeEvent — push to next tick
    system.run(() => showArchetypeForm(player, true));
  }
});

// -------------------------------------------------------------------------
//  Event Listeners — Kill Tracking (fighter & trapper kill quests)
// -------------------------------------------------------------------------

world.afterEvents.entityDie.subscribe((event) => {
  const dead   = event.deadEntity;
  const source = event.damageSource;

  // We only care if a player caused the kill
  const killer = source?.damagingEntity;
  if (!killer || killer.typeId !== "minecraft:player") return;

  // Make sure the killer has an active, incomplete kill quest
  if (getPropNum(killer, "smp:quest_complete") === 1) return;
  const qtype  = getPropStr(killer, "smp:quest_type");
  if (qtype !== "kill") return;

  const target = getPropStr(killer, "smp:quest_target");

  if (target === "player" && dead.typeId === "minecraft:player") {
    addQuestProgress(killer, 1);
  } else if (target !== "player" && dead.typeId === target) {
    addQuestProgress(killer, 1);
  }
});

// -------------------------------------------------------------------------
//  Event Listeners — Block Place Tracking (trapper place quests)
// -------------------------------------------------------------------------

world.afterEvents.playerPlaceBlock.subscribe((event) => {
  const player = event.player;
  if (!player) return;

  if (getPropNum(player, "smp:quest_complete") === 1) return;
  const qtype = getPropStr(player, "smp:quest_type");
  if (qtype !== "place") return;

  const target  = getPropStr(player, "smp:quest_target");
  const blockId = event.block.typeId;

  if (blockId === target) {
    addQuestProgress(player, 1);
  }
});

// -------------------------------------------------------------------------
//  Polling — Collect Quest Tracking (farmer)
// -------------------------------------------------------------------------
// Every 3 seconds (60 ticks), scan online farmers' inventories to see if
// they have enough of the required item to complete their collect quest.
// Items are NOT consumed — the quest simply checks you gathered them.

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      if (getPropNum(player, "smp:quest_complete") === 1) continue;
      const qtype = getPropStr(player, "smp:quest_type");
      if (qtype !== "collect") continue;

      ensureDailyQuest(player); // rotate if it's a new day

      const target = getPropStr(player, "smp:quest_target");
      const goal   = getPropNum(player, "smp:quest_goal");

      const inventory = player.getComponent("inventory")?.container;
      if (!inventory) continue;

      let count = 0;
      for (let s = 0; s < inventory.size; s++) {
        const item = inventory.getItem(s);
        if (item && item.typeId === target) count += item.amount;
      }

      if (count >= goal) {
        completeQuest(player);
      }
    } catch { /* player may have disconnected mid-loop */ }
  }
}, 60); // 60 ticks = 3 seconds

// -------------------------------------------------------------------------
//  Polling — Daily Quest Rotation for kill/place quests
// -------------------------------------------------------------------------
// Every 5 minutes (6000 ticks), check if the day has changed for online
// players with kill/place quests and assign a new quest if needed.

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try { ensureDailyQuest(player); }
    catch { /* ignore */ }
  }
}, 6000);

// ============================================================================
//  STARTUP MESSAGE
// ============================================================================

world.afterEvents.worldInitialize.subscribe(() => {
  world.sendMessage("§e[SMP] Addon loaded — Airdrops every 20 min | Daily quests active.");
});
