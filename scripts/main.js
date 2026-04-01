import { world, system, ItemStack } from "@minecraft/server";

// ============================================================================
// LOOT POOL CONFIGURATION
// ----------------------------------------------------------------------------
// Edit this array to customize what items appear in airdrop chests.
// Each entry: { itemId, minCount, maxCount, weight }
//   - itemId:   Minecraft item identifier (e.g. "minecraft:diamond")
//   - minCount: minimum stack size when this item is selected
//   - maxCount: maximum stack size when this item is selected
//   - weight:   relative chance of being picked (higher = more common)
// ============================================================================
const LOOT_POOL = [
  { itemId: "minecraft:diamond",           minCount: 1, maxCount: 4,  weight: 10 },
  { itemId: "minecraft:netherite_ingot",   minCount: 1, maxCount: 2,  weight: 3  },
  { itemId: "minecraft:golden_apple",      minCount: 1, maxCount: 3,  weight: 8  },
  { itemId: "minecraft:enchanted_golden_apple", minCount: 1, maxCount: 1, weight: 2 },
  { itemId: "minecraft:ender_pearl",       minCount: 2, maxCount: 8,  weight: 12 },
  { itemId: "minecraft:diamond_sword",     minCount: 1, maxCount: 1,  weight: 5  },
  { itemId: "minecraft:diamond_chestplate",minCount: 1, maxCount: 1,  weight: 4  },
  { itemId: "minecraft:diamond_helmet",    minCount: 1, maxCount: 1,  weight: 4  },
  { itemId: "minecraft:diamond_leggings",  minCount: 1, maxCount: 1,  weight: 4  },
  { itemId: "minecraft:diamond_boots",     minCount: 1, maxCount: 1,  weight: 4  },
  { itemId: "minecraft:totem_of_undying",  minCount: 1, maxCount: 1,  weight: 2  },
  { itemId: "minecraft:experience_bottle", minCount: 4, maxCount: 16, weight: 10 },
  { itemId: "minecraft:tnt",               minCount: 2, maxCount: 8,  weight: 6  },
  { itemId: "minecraft:arrow",             minCount: 8, maxCount: 32, weight: 12 },
  { itemId: "minecraft:iron_ingot",        minCount: 4, maxCount: 16, weight: 15 },
  { itemId: "minecraft:gold_ingot",        minCount: 2, maxCount: 8,  weight: 12 },
  { itemId: "minecraft:obsidian",          minCount: 2, maxCount: 6,  weight: 8  },
];

// ============================================================================
// TIMER & RADIUS SETTINGS
// ----------------------------------------------------------------------------
// Minecraft runs at 20 ticks per second.
//   20 minutes = 20 * 60 * 20 = 24,000 ticks
//    5 minutes =  5 * 60 * 20 =  6,000 ticks
// ============================================================================
const AIRDROP_INTERVAL_TICKS = 24000; // 20 minutes between airdrops
const DESPAWN_DELAY_TICKS    = 6000;  // 5 minutes before unclaimed chests vanish
const AIRDROP_RADIUS         = 500;   // random coords chosen in [-500, 500]
const LOOT_SLOT_COUNT        = 7;     // how many item stacks to place in the chest
const OVERWORLD_DIMENSION    = "overworld";

// ============================================================================
// HELPER — Weighted random selection from the loot pool
// ============================================================================
function pickWeightedItem() {
  const totalWeight = LOOT_POOL.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of LOOT_POOL) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  // Fallback (should never happen, but just in case of float rounding)
  return LOOT_POOL[LOOT_POOL.length - 1];
}

// ============================================================================
// HELPER — Random integer in [min, max] (inclusive)
// ============================================================================
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============================================================================
// HELPER — Find the highest solid (non-air) block at a given X/Z column
// ----------------------------------------------------------------------------
// Scans downward from the world build limit to find the first non-air block.
// Returns the Y coordinate one above the surface so the chest sits on top.
// If the entire column is air (unlikely), defaults to Y 64.
// ============================================================================
function getSurfaceY(dimension, x, z) {
  const MAX_Y = 319;  // top of the build range (1.18+ overworld)
  const MIN_Y = -64;  // bottom of the build range

  for (let y = MAX_Y; y >= MIN_Y; y--) {
    try {
      const block = dimension.getBlock({ x, y, z });
      // block can be undefined if the chunk isn't loaded at that position
      if (block && block.typeId !== "minecraft:air") {
        // Return one above the surface so the chest doesn't replace terrain
        return y + 1;
      }
    } catch {
      // Chunk may be unloaded or out of range — keep scanning
      continue;
    }
  }

  // Fallback: no solid block found, place at sea-level equivalent
  return 64;
}

// ============================================================================
// CORE — Fill a placed chest with random loot from the pool
// ============================================================================
function fillChestWithLoot(dimension, x, y, z) {
  try {
    const block = dimension.getBlock({ x, y, z });
    if (!block || block.typeId !== "minecraft:chest") return;

    const inventory = block.getComponent("inventory");
    if (!inventory) return;

    const container = inventory.container;
    if (!container) return;

    // Pick LOOT_SLOT_COUNT random items and scatter them into random slots
    const usedSlots = new Set();
    for (let i = 0; i < LOOT_SLOT_COUNT; i++) {
      // Choose a random empty slot
      let slot;
      let attempts = 0;
      do {
        slot = randomInt(0, container.size - 1);
        attempts++;
      } while (usedSlots.has(slot) && attempts < container.size);
      usedSlots.add(slot);

      const loot = pickWeightedItem();
      const count = randomInt(loot.minCount, loot.maxCount);

      try {
        container.setItem(slot, new ItemStack(loot.itemId, count));
      } catch {
        // If anything goes wrong with one slot, skip it silently
      }
    }
  } catch {
    // Chest may have been broken between placement and loot fill — ignore
  }
}

// ============================================================================
// CORE — Spawn an airdrop chest at a random location
// ============================================================================
function spawnAirdrop() {
  const dimension = world.getDimension(OVERWORLD_DIMENSION);

  // Pick random X/Z within the configured radius
  const x = randomInt(-AIRDROP_RADIUS, AIRDROP_RADIUS);
  const z = randomInt(-AIRDROP_RADIUS, AIRDROP_RADIUS);

  // Find the surface
  const y = getSurfaceY(dimension, x, z);

  // Place the chest
  try {
    const block = dimension.getBlock({ x, y, z });
    if (!block) {
      world.sendMessage("§cAirdrop failed — target area not loaded. Retrying next cycle.");
      return;
    }
    block.setType("minecraft:chest");
  } catch {
    // If we can't place the chest (unloaded chunk, etc.), abort this drop
    world.sendMessage("§cAirdrop failed — target area not loaded. Retrying next cycle.");
    return;
  }

  // Fill it with loot (run 1 tick later so the block entity is initialized)
  system.runTimeout(() => {
    fillChestWithLoot(dimension, x, y, z);
  }, 1);

  // Notify all players
  world.sendMessage(
    `§aAirdrop deployed at X: ${x} Z: ${z}! You have 5 minutes to get it!`
  );

  // --- Despawn timer: remove the chest after 5 minutes if still present ---
  // 5 minutes = 6,000 ticks (see timer settings above)
  system.runTimeout(() => {
    try {
      const block = dimension.getBlock({ x, y, z });

      // Only remove if the chest is still there — a player may have broken it
      if (block && block.typeId === "minecraft:chest") {
        block.setType("minecraft:air");
        world.sendMessage("§cThe airdrop has disappeared!");
      }
      // If the block isn't a chest (player broke it, chunk unloaded, etc.)
      // we simply do nothing — no error, no message.
    } catch {
      // Chunk unloaded or other edge case — fail silently
    }
  }, DESPAWN_DELAY_TICKS);
}

// ============================================================================
// ENTRY POINT — Start the recurring airdrop loop
// ----------------------------------------------------------------------------
// system.runInterval fires the callback every N ticks.
// 24,000 ticks = 20 minutes at 20 TPS.
// ============================================================================
system.runInterval(() => {
  spawnAirdrop();
}, AIRDROP_INTERVAL_TICKS);

// Log a startup confirmation so server operators know the addon loaded
world.afterEvents.worldInitialize.subscribe(() => {
  world.sendMessage("§e[Airdrop] Addon loaded — drops every 20 minutes.");
});
