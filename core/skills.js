// ========== 攻击技能 ==========
export const ATTACK_SKILLS = {
    normal: {
        name: "攻击",
        type: "attack",
        attr: "physical",
        basePower: 100,
        desc: "普通攻击"
    },
    double_hit: {
        name: "连击",
        type: "attack",
        attr: "physical",
        basePower: 75,
        desc: "攻击两次，可攻击不同目标"
    },
    critical_hit: {
        name: "会心一击",
        type: "attack",
        attr: "physical",
        basePower: 145,
        desc: "稳定高伤害"
    },
    fireball: {
        name: "火球术",
        type: "attack",
        attr: "magical",
        basePower: 137,
        desc: "火焰伤害"
    },
    ice_bolt: {
        name: "冰冻术",
        type: "attack",
        attr: "magical",
        basePower: 70,
        desc: "冰冻对手"
    },
    thunder: {
        name: "雷击术",
        type: "attack",
        attr: "magical",
        basePower: 120,
        desc: "雷电伤害"
    },
    drain_life: {
        name: "吸血攻击",
        type: "attack",
        attr: "magical",
        basePower: 115,
        desc: "吸收体力"
    },
    poison: {
        name: "投毒",
        type: "attack",
        attr: "magical",
        basePower: 90,
        desc: "施加中毒"
    },
    curse: {
        name: "诅咒",
        type: "attack",
        attr: "magical",
        basePower: 100,
        desc: "施加诅咒"
    }
};

// ========== 辅助技能 ==========
export const SUPPORT_SKILLS = {
    heal: {
        name: "治愈术",
        type: "support",
        desc: "回复体力"
    },
    haste: {
        name: "加速术",
        type: "support",
        desc: "速度上升"
    },
    iron_wall: {
        name: "铁壁",
        type: "support",
        desc: "防御上升"
    },
    focus: {
        name: "聚气",
        type: "support",
        desc: "攻击上升"
    }
};

// ========== 被动技能 ==========
export const PASSIVE_SKILLS = {
    counter: {
        name: "反击",
        type: "passive",
        trigger: "afterDamage",
        desc: "受到伤害后反击"
    },
    shield: {
        name: "护盾",
        type: "passive",
        trigger: "onTurnStart",
        desc: "获得护盾"
    }
};

// ========== 技能效果处理器 ==========
export const SkillHandlers = {
    // 攻击技能
    normal: (attacker, target, state) => {
        const dmg = calculateDamage(attacker, target, 100, "physical");
        return { dmg, effects: [] };
    },
    
    double_hit: (attacker, targets, state) => {
        const results = [];
        const enemies = state.getEnemies(attacker);
        
        // 第一次攻击
        const target1 = targets[0];
        const dmg1 = calculateDamage(attacker, target1, 75, "physical");
        target1.hp = Math.max(0, target1.hp - dmg1);
        results.push({ target: target1.name, dmg: dmg1 });
        
        // 第二次攻击，可能换目标
        if (enemies.length > 1 && state.rng() < 0.5) {
            const otherEnemies = enemies.filter(e => e.name !== target1.name);
            const target2 = otherEnemies[Math.floor(state.rng() * otherEnemies.length)];
            const dmg2 = Math.floor(calculateDamage(attacker, target2, 75, "physical") * 0.85);
            target2.hp = Math.max(0, target2.hp - dmg2);
            results.push({ target: target2.name, dmg: dmg2 });
        } else {
            const dmg2 = Math.floor(dmg1 * 0.85);
            target1.hp = Math.max(0, target1.hp - dmg2);
            results.push({ target: target1.name, dmg: dmg2 });
        }
        
        return { results, effects: [] };
    },
    
    critical_hit: (attacker, target, state) => {
        const dmg = calculateDamage(attacker, target, 145, "physical");
        return { dmg, effects: [] };
    },
    
    fireball: (attacker, target, state) => {
        const dmg = calculateDamage(attacker, target, 137, "magical");
        return { dmg, effects: [] };
    },
    
    ice_bolt: (attacker, target, state) => {
        const dmg = calculateDamage(attacker, target, 70, "magical");
        target.frozen = 1;
        return { dmg, effects: ["❄️冰冻"] };
    },
    
    thunder: (attacker, target, state) => {
        const dmg = calculateDamage(attacker, target, 120, "magical");
        return { dmg, effects: [] };
    },
    
    drain_life: (attacker, target, state) => {
        const dmg = calculateDamage(attacker, target, 115, "magical");
        const heal = Math.floor(dmg / 2);
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
        return { dmg, effects: [`💚吸血${heal}`] };
    },
    
    poison: (attacker, target, state) => {
        const dmg = calculateDamage(attacker, target, 90, "magical");
        target.poisoned = 3;
        return { dmg, effects: ["☠️中毒"] };
    },
    
    curse: (attacker, target, state) => {
        const dmg = calculateDamage(attacker, target, 100, "magical");
        target.cursed = 3;
        return { dmg, effects: ["👁️诅咒"] };
    },
    
    // 辅助技能
    heal: (caster, target, state) => {
        const healAmount = Math.floor(caster.mag * 1.5);
        target.hp = Math.min(target.maxHp, target.hp + healAmount);
        return { effects: [`💚回复${healAmount}`] };
    },
    
    haste: (caster, target, state) => {
        target.buffs = target.buffs || {};
        target.buffs.spd = 3;
        return { effects: ["💨加速"] };
    },
    
    iron_wall: (caster, target, state) => {
        target.buffs = target.buffs || {};
        target.buffs.def = 2;
        target.buffs.res = 2;
        return { effects: ["🛡️铁壁"] };
    },
    
    focus: (caster, target, state) => {
        target.buffs = target.buffs || {};
        target.buffs.atk = 3;
        return { effects: ["💪聚气"] };
    },
    
    // 被动技能
    counter: (owner, attacker, state) => {
        const dmg = Math.floor(owner.atk * 0.5);
        attacker.hp = Math.max(0, attacker.hp - dmg);
        return { effects: [`⚔️反击-${dmg}`] };
    },
    
    shield: (owner, state) => {
        const shieldAmount = Math.floor(owner.maxHp * 0.1);
        owner.shield = (owner.shield || 0) + shieldAmount;
        return { effects: [`🛡️护盾${shieldAmount}`] };
    }
};

// 伤害计算
function calculateDamage(attacker, target, power, attr) {
    const powerRatio = power / 100;
    let derdmg, objdmg, def;
    
    if (attr === "magical") {
        derdmg = attacker.mag * 0.4 * powerRatio;
        objdmg = attacker.mag * 0.6 * powerRatio;
        def = target.res * 0.6;
    } else {
        derdmg = attacker.atk * 0.4 * powerRatio;
        objdmg = attacker.atk * 0.6 * powerRatio;
        def = target.def * 0.6;
    }
    
    let dmg = Math.floor(derdmg + Math.max(0, objdmg - def));
    
    if (target.shield > 0) {
        const absorbed = Math.min(target.shield, dmg);
        dmg -= absorbed;
        target.shield -= absorbed;
    }
    
    return Math.max(1, dmg);
}

// ========== 从哈希生成技能 ==========
export function generateSkills(name, hash) {
    const bytes = [];
    for (let i = 0; i < hash.length; i += 2) {
        bytes.push(parseInt(hash.substr(i, 2), 16));
    }
    
    const skills = {
        attacks: [],
        supports: [],
        passives: []
    };
    
    // 普通攻击
    skills.attacks.push({
        ...ATTACK_SKILLS.normal,
        id: "normal",
        proficiency: 100
    });
    
    // 额外攻击技能 (1-2个)
    const attackKeys = Object.keys(ATTACK_SKILLS).filter(k => k !== "normal");
    const attackCount = 1 + (bytes[0] % 2);
    const usedAttackIndices = new Set();
    
    for (let i = 0; i < attackCount && i < attackKeys.length; i++) {
        let idx;
        do {
            idx = (bytes[i * 3] * 7919 + bytes[i * 3 + 1]) % attackKeys.length;
        } while (usedAttackIndices.has(idx));
        usedAttackIndices.add(idx);
        
        skills.attacks.push({
            ...ATTACK_SKILLS[attackKeys[idx]],
            id: attackKeys[idx],
            proficiency: 50 + (bytes[i * 5 + 2] % 40)
        });
    }
    
    // 辅助技能 (1个)
    const supportKeys = Object.keys(SUPPORT_SKILLS);
    const supportIdx = bytes[10] % supportKeys.length;
    skills.supports.push({
        ...SUPPORT_SKILLS[supportKeys[supportIdx]],
        id: supportKeys[supportIdx],
        proficiency: 50 + (bytes[11] % 40)
    });
    
    // 被动技能 (0-1个)
    if (bytes[12] % 2 === 0) {
        const passiveKeys = Object.keys(PASSIVE_SKILLS);
        const passiveIdx = bytes[13] % passiveKeys.length;
        skills.passives.push({
            ...PASSIVE_SKILLS[passiveKeys[passiveIdx]],
            id: passiveKeys[passiveIdx],
            proficiency: 40 + (bytes[14] % 40)
        });
    }
    
    return skills;
}

export function checkSkillTrigger(skill, rng) {
    return rng() * 100 < skill.proficiency;
}
