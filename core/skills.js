import { sha256 } from "../utils/sha256.js";

// ========== 攻击技能 ==========
export const ATTACK_SKILLS = {
    double_hit: {
        name: "连击",
        type: "attack",
        attr: "physical",
        basePower: 75,
        hits: [2, 3],
        desc: "连续多次攻击，若击中同一目标，后续伤害下降15%"
    },
    critical_hit: {
        name: "会心一击",
        type: "attack",
        attr: "physical",
        basePower: 145,
        hits: [1, 1],
        desc: "稳定输出伤害，随机性低"
    },
    fireball: {
        name: "火球术",
        type: "attack",
        attr: "magical",
        basePower: 137,
        hits: [1, 1],
        desc: "若多次受到火系伤害，每次伤害增加25%"
    },
    ice_bolt: {
        name: "冰冻术",
        type: "attack",
        attr: "magical",
        basePower: 70,
        hits: [1, 1],
        desc: "命中后冰冻对手半回合"
    },
    thunder: {
        name: "雷击术",
        type: "attack",
        attr: "magical",
        basePower: 35,
        hits: [3, 6],
        desc: "对单一目标多次伤害"
    },
    earthquake: {
        name: "地裂术",
        type: "attack",
        attr: "magical",
        basePower: 140,
        hits: [1, 5],
        desc: "将伤害平分给1~5个目标"
    },
    drain_life: {
        name: "吸血攻击",
        type: "attack",
        attr: "magical",
        basePower: 115,
        hits: [1, 1],
        desc: "命中后吸收一半体力"
    },
    frenzy: {
        name: "狂暴术",
        type: "attack",
        attr: "magical",
        basePower: 80,
        hits: [1, 1],
        desc: "命中后施加狂暴状态"
    },
    curse: {
        name: "诅咒",
        type: "attack",
        attr: "magical",
        basePower: 100,
        hits: [1, 1],
        desc: "施加诅咒状态，受到攻击随机伤害加倍"
    },
    purify: {
        name: "净化",
        type: "attack",
        attr: "magical",
        basePower: 100,
        hits: [1, 1],
        desc: "去除目标所有有益效果"
    },
    poison: {
        name: "投毒",
        type: "attack",
        attr: "magical",
        basePower: 90,
        hits: [1, 1],
        desc: "施加中毒状态，每回合损失体力"
    },
    stealth: {
        name: "潜行",
        type: "attack",
        attr: "magical",
        basePower: 500,
        hits: [1, 1],
        desc: "两回合潜行后背刺"
    },
    plague: {
        name: "瘟疫",
        type: "attack",
        attr: "magical",
        basePower: 0,
        hits: [1, 1],
        desc: "目标按比例损失体力50%~99%"
    },
    life_swap: {
        name: "生命之轮",
        type: "attack",
        attr: "magical",
        basePower: 0,
        hits: [1, 1],
        desc: "和目标体力值互换"
    }
};

// ========== 辅助技能 ==========
export const SUPPORT_SKILLS = {
    focus: {
        name: "聚气",
        type: "support",
        desc: "攻击力提高60%"
    },
    charge: {
        name: "蓄力",
        type: "support",
        desc: "下回合伤害提升到300%"
    },
    charm: {
        name: "魅惑",
        type: "support",
        desc: "目标下回合将施法者视作队友"
    },
    haste: {
        name: "加速术",
        type: "support",
        desc: "自己或队友速度加倍，持续3回合"
    },
    slow: {
        name: "减速术",
        type: "support",
        desc: "目标速度减半，持续2回合"
    },
    iron_wall: {
        name: "铁壁",
        type: "support",
        desc: "两回合内防御大幅上升"
    },
    heal: {
        name: "治愈术",
        type: "support",
        desc: "回复体力并去除异常状态"
    },
    revive: {
        name: "苏生术",
        type: "support",
        desc: "复活一名被击倒的队友"
    },
    blood_sacrifice: {
        name: "血祭",
        type: "support",
        desc: "召唤使魔"
    },
    phantom: {
        name: "幻影",
        type: "support",
        desc: "召唤幻影"
    },
    clone: {
        name: "分身",
        type: "support",
        desc: "分成两人，属性下降"
    }
};

// ========== 被动技能 ==========
export const PASSIVE_SKILLS = {
    counter: {
        name: "反击",
        type: "passive",
        trigger: "afterDamage",
        desc: "受到伤害后向对手进行物理攻击"
    },
    guard: {
        name: "防御",
        type: "passive",
        trigger: "beforeDamage",
        desc: "进行防御，伤害减半"
    },
    reflect: {
        name: "伤害反弹",
        type: "passive",
        trigger: "afterDamage",
        desc: "将伤害反弹到施法者"
    },
    protect: {
        name: "守护",
        type: "passive",
        trigger: "onAllyDamaged",
        desc: "代替队友承受伤害"
    },
    amulet: {
        name: "护身符",
        type: "passive",
        trigger: "onDeath",
        desc: "被击倒时复活并恢复少量体力"
    },
    desperate: {
        name: "垂死抗争",
        type: "passive",
        trigger: "onLowHp",
        desc: "体力极低时所有属性上升"
    },
    shield: {
        name: "护盾",
        type: "passive",
        trigger: "onTurnStart",
        desc: "每回合恢复少量护盾"
    },
    summon_undead: {
        name: "召唤亡灵",
        type: "passive",
        trigger: "onKill",
        desc: "将对手变成丧尸为自己战斗"
    },
    devour: {
        name: "吞噬",
        type: "passive",
        trigger: "onKill",
        desc: "吞噬对手提高属性并获得技能"
    }
};

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
    
    // 生成攻击技能 (1-3个)
    const attackKeys = Object.keys(ATTACK_SKILLS);
    const attackCount = 1 + (bytes[0] % 3);
    const usedAttackIndices = new Set();
    
    for (let i = 0; i < attackCount && i < attackKeys.length; i++) {
        let idx;
        do {
            idx = (bytes[i * 3] * 7919 + bytes[i * 3 + 1]) % attackKeys.length;
        } while (usedAttackIndices.has(idx));
        usedAttackIndices.add(idx);
        
        const proficiency = 40 + (bytes[i * 5 + 2] % 50);
        skills.attacks.push({
            ...ATTACK_SKILLS[attackKeys[idx]],
            id: attackKeys[idx],
            proficiency: proficiency
        });
    }
    
    // 生成辅助技能 (1-2个)
    const supportKeys = Object.keys(SUPPORT_SKILLS);
    const supportCount = 1 + (bytes[10] % 2);
    const usedSupportIndices = new Set();
    
    for (let i = 0; i < supportCount && i < supportKeys.length; i++) {
        let idx;
        do {
            idx = (bytes[i * 4 + 15] * 123 + bytes[i * 4 + 16]) % supportKeys.length;
        } while (usedSupportIndices.has(idx));
        usedSupportIndices.add(idx);
        
        const proficiency = 40 + (bytes[i * 3 + 20] % 50);
        skills.supports.push({
            ...SUPPORT_SKILLS[supportKeys[idx]],
            id: supportKeys[idx],
            proficiency: proficiency
        });
    }
    
    // 生成被动技能 (1-3个)
    const passiveKeys = Object.keys(PASSIVE_SKILLS);
    const passiveCount = 1 + (bytes[5] % 3);
    const usedPassiveIndices = new Set();
    
    for (let i = 0; i < passiveCount && i < passiveKeys.length; i++) {
        let idx;
        do {
            idx = (bytes[i * 7 + 8] * 456 + bytes[i * 7 + 9]) % passiveKeys.length;
        } while (usedPassiveIndices.has(idx));
        usedPassiveIndices.add(idx);
        
        const proficiency = 30 + (bytes[i * 4 + 25] % 60);
        skills.passives.push({
            ...PASSIVE_SKILLS[passiveKeys[idx]],
            id: passiveKeys[idx],
            proficiency: proficiency
        });
    }
    
    return skills;
}

// 检查技能是否触发
export function checkSkillTrigger(skill, rng) {
    return rng() * 100 < skill.proficiency;
}

// 获取默认攻击技能
export function getDefaultAttack(stats) {
    return {
        name: "攻击",
        type: "attack",
        attr: stats.mag > stats.atk ? "magical" : "physical",
        basePower: 100,
        hits: [1, 1]
    };
}