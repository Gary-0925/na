import { sha256 } from "../utils/sha256.js";

// 攻击技能
export const ATTACK_SKILLS = {
    double_hit: { name: "连击", type: "attack", attr: "physical", basePower: 75 },
    critical_hit: { name: "会心一击", type: "attack", attr: "physical", basePower: 145 },
    fireball: { name: "火球术", type: "attack", attr: "magical", basePower: 137 },
    ice_bolt: { name: "冰冻术", type: "attack", attr: "magical", basePower: 70 },
    thunder: { name: "雷击术", type: "attack", attr: "magical", basePower: 35 },
    drain_life: { name: "吸血攻击", type: "attack", attr: "magical", basePower: 115 },
    curse: { name: "诅咒", type: "attack", attr: "magical", basePower: 100 },
    poison: { name: "投毒", type: "attack", attr: "magical", basePower: 90 }
};

// 辅助技能
export const SUPPORT_SKILLS = {
    focus: { name: "聚气", type: "support" },
    heal: { name: "治愈术", type: "support" },
    haste: { name: "加速术", type: "support" },
    iron_wall: { name: "铁壁", type: "support" }
};

// 从哈希生成技能
export function generateSkills(name, hash) {
    const proficiencySeed = parseInt(hash.slice(0, 8), 16);
    
    // 选择攻击技能
    const attackKeys = Object.keys(ATTACK_SKILLS);
    const attackIdx = proficiencySeed % attackKeys.length;
    const attack = {
        ...ATTACK_SKILLS[attackKeys[attackIdx]],
        id: attackKeys[attackIdx],
        proficiency: 50 + (proficiencySeed % 50)
    };
    
    // 选择辅助技能
    const supportKeys = Object.keys(SUPPORT_SKILLS);
    const supportIdx = (proficiencySeed >> 8) % supportKeys.length;
    const support = {
        ...SUPPORT_SKILLS[supportKeys[supportIdx]],
        id: supportKeys[supportIdx],
        proficiency: 50 + ((proficiencySeed >> 16) % 50)
    };
    
    return { attack, support, passives: [] };
}

// 检查技能是否触发
export function checkSkillTrigger(skill, rng) {
    return rng() < skill.proficiency / 100;
}