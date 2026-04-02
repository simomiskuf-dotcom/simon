import { world, system, ItemStack } from "@minecraft/server";

// Import the SMP archetype & quest system (runs on load)
import "./smp.js";

// ============================================================================
//  AIRDROP SYSTEM — LOOT POOL (edit items here)
// ============================================================================
// Each entry: { itemId, minCount, maxCount, weight }
//   weight = relative chance of being picked (higher = more common)

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

// ============================================================================
//  AIRDROP SYSTEM — TIMER & RADIUS SETTINGS
// ============================================================================
// Minecraft runs at 20 ticks per second.
//   20 minutes = 20 × 60 × 20 = 24,000 ticks
//    5 minutes =  5 × 60 × 20 =  6,000 ticks

const AIRDROP_INTERVAL_TICKS = 24000; // 20 min between airdrops
const DESPAWN_DELAY_TICKS    = 6000;  // 5 min before unclaimed chests vanish
const AIRDROP_RADIUS         = 500;   // random coords in [-500, 500]
const LOOT_SLOT_COUNT        = 7;     // item stacks per chest
const OVERWORLD_DIMENSION    = "overworld";

// ============================================================================
//  HELPERS
// ============================================================================

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeightedItem() {
  const totalWeight = LOOT_POOL.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of LOOT_POOL) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return LOOT_POOL[LOOT_POOL.length - 1];
}

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
  } catch { /* chest gone */ }
}

// ============================================================================
//  AIRDROP CORE LOGIC
// ============================================================================

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

// Airdrop loop — fires every 24,000 ticks (20 minutes)
system.runInterval(() => spawnAirdrop(), AIRDROP_INTERVAL_TICKS);

// ============================================================================
//  STARTUP
// ============================================================================

world.afterEvents.worldInitialize.subscribe(() => {
  world.sendMessage("§e[SMP] Addon loaded — Airdrops every 20 min | Daily quests active.");
});
