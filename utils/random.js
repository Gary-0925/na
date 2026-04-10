import { sha256 } from "./sha256.js";

export async function generateRandomName(index) {
    const hash = await sha256(`RANDOM_SEED_${index}_${Date.now()}`);
    return "RANDOM_" + hash.slice(0, 8);
}

export async function createBattleRNG(names) {
    const sorted = [...names].sort();
    const seedHash = await sha256(sorted.join(", "));
    let state = parseInt(seedHash.slice(0, 8), 16);
    return () => {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        return state / 0x7fffffff;
    };
}