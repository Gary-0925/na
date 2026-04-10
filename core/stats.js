function normalFromHashBytes(bytes, offset) {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        const idx = (offset + i) % bytes.length;
        sum += bytes[idx];
    }
    const z = (sum - 1530) / 255.97;
    return z;
}

function normalFromHash(hash, index) {
    const bytes = [];
    for (let i = 0; i < hash.length; i += 2) {
        bytes.push(parseInt(hash.substr(i, 2), 16));
    }
    const z = normalFromHashBytes(bytes, index * 12);
    let result = Math.round(60 + z * 15);
    return Math.max(0, Math.min(500, result));
}

export function generateStats(name, hash) {
    const stats = { name, hash };
    const keys = ["atk", "def", "spd", "agi", "mag", "res", "int", "hp"];
    for (let i = 0; i < 8; i++) {
        stats[keys[i]] = normalFromHash(hash, i);
    }
    stats.total = Math.floor((stats.hp + stats.atk + stats.def + stats.spd + stats.agi + stats.mag + stats.res + stats.int) / 8);
    stats.hp = Math.max(1, 80 + stats.hp * 3);
    return stats;
}