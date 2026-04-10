import { sha256 } from "../utils/sha256.js";

// ========== 技能定义 ==========

// 攻击技能
export const ATTACK_SKILLS = {
    // 物理技能
    double_hit: {
        name: "连击",
        type: "attack",
        attr: "physical",
        basePower: 75,
        hits: [2, 3],
        desc: "连续多次攻击，若击中同一目标，后续伤害下降15%",
        effect: (state, attacker, target, rng) => {
            const hits = Math.floor(rng() * 2) + 2; // 2-3次
            let totalDmg = 0;
            let lastTarget = null;
            let dmgMultiplier = 1.0;
            let effects = [];
            
            for (let i = 0; i < hits; i++) {
                const currentTarget = (i === 0 || rng() < 0.5) ? target : state.getRandomEnemy(attacker);
                
                // 使用原有的伤害公式
                let derdmg = attacker.atk * 0.4 * dmgMultiplier;
                let objdmg = attacker.atk * 0.6 * dmgMultiplier;
                let def = currentTarget.def * 0.6;
                
                if (currentTarget === lastTarget) {
                    derdmg *= 0.85;
                    objdmg *= 0.85;
                }
                
                let dmg = Math.floor(derdmg + Math.max(0, objdmg - def));
                dmg = Math.max(1, dmg);
                currentTarget.hp = Math.max(0, currentTarget.hp - dmg);
                totalDmg += dmg;
                lastTarget = currentTarget;
                dmgMultiplier *= 0.85;
            }
            
            effects.push(`连击${hits}次`);
            return { dmg: totalDmg, effects };
        }
    },
    
    critical_hit: {
        name: "会心一击",
        type: "attack",
        attr: "physical",
        basePower: 145,
        hits: [1, 1],
        desc: "稳定输出伤害，随机性低",
        effect: (state, attacker, target, rng) => {
            let derdmg = attacker.atk * 0.4 * 1.45;
            let objdmg = attacker.atk * 0.6 * 1.45;
            let def = target.def * 0.6;
            
            let dmg = Math.floor(derdmg + Math.max(0, objdmg - def));
            dmg = Math.max(1, dmg);
            target.hp = Math.max(0, target.hp - dmg);
            
            return { dmg, effects: [] };
        }
    },
    
    // 魔法技能
    fireball: {
        name: "火球术",
        type: "attack",
        attr: "magical",
        basePower: 137,
        hits: [1, 1],
        desc: "若多次受到火系伤害，每次伤害增加25%",
        effect: (state, attacker, target, rng) => {
            const fireStacks = target.fireStacks || 0;
            const multiplier = 1 + fireStacks * 0.25;
            
            let derdmg = attacker.mag * 0.4 * 1.37 * multiplier;
            let objdmg = attacker.mag * 0.6 * 1.37 * multiplier;
            let def = target.res * 0.6;
            
            let dmg = Math.floor(derdmg + Math.max(0, objdmg - def));
            dmg = Math.max(1, dmg);
            target.hp = Math.max(0, target.hp - dmg);
            target.fireStacks = fireStacks + 1;
            
            return { dmg, effects: fireStacks > 0 ? [`🔥火伤层数${fireStacks + 1}`] : [] };
        }
    },
    
    ice_bolt: {
        name: "冰冻术",
        type: "attack",
        attr: "magical",
        basePower: 70,
        hits: [1, 1],
        desc: "命中后冰冻对手半回合",
        effect: (state, attacker, target, rng) => {
            let derdmg = attacker.mag * 0.4 * 0.70;
            let objdmg = attacker.mag * 0.6 * 0.70;
            let def = target.res * 0.6;
            
            let dmg = Math.floor(derdmg + Math.max(0, objdmg - def));
            dmg = Math.max(1, dmg);
            target.hp = Math.max(0, target.hp - dmg);
            target.frozen = 0.5;
            
            return { dmg, effects: ["❄️冰冻"] };
        }
    },
    
    thunder: {
        name: "雷击术",
        type: "attack",
        attr: "magical",
        basePower: 35,
        hits: [3, 6],
        desc: "对单一目标多次伤害",
        effect: (state, attacker, target, rng) => {
            const hits = Math.floor(rng() * 4) + 3; // 3-6次
            let totalDmg = 0;
            
            for (let i = 0; i < hits; i++) {
                let derdmg = attacker.mag * 0.4 * 0.35;
                let objdmg = attacker.mag * 0.6 * 0.35;
                let def = target.res * 0.6;
                
                let dmg = Math.floor(derdmg + Math.max(0, objdmg - def));
                dmg = Math.max(1, dmg);
                target.hp = Math.max(0, target.hp - dmg);
                totalDmg += dmg;
            }
            
            return { dmg: totalDmg, effects: [`⚡${hits}连击`] };
        }
    },
    
    earthquake: {
        name: "地裂术",
        type: "attack",
        attr: "magical",
        basePower: 140,
        hits: [1, 5],
        desc: "将伤害平分给多个目标，人数越多总伤害越大",
        effect: (state, attacker, target, rng) => {
            const targetCount = Math.min(Math.floor(rng() * 5) + 1, state.getAliveEnemies(attacker).length);
            const totalPower = 140 + targetCount * 15;
            const powerPerTarget = totalPower / targetCount / 100;
            
            const targets = state.getRandomEnemies(attacker, targetCount);
            let totalDmg = 0;
            
            targets.forEach(t => {
                let derdmg = attacker.mag * 0.4 * powerPerTarget;
                let objdmg = attacker.mag * 0.6 * powerPerTarget;
                let def = t.res * 0.6;
                
                let dmg = Math.floor(derdmg + Math.max(0, objdmg - def));
                dmg = Math.max(1, dmg);
                t.hp = Math.max(0, t.hp - dmg);
                totalDmg += dmg;
            });
            
            return { dmg: totalDmg, effects: [`分裂${targetCount}个目标`] };
        }
    },
    
    drain_life: {
        name: "吸血攻击",
        type: "attack",
        attr: "magical",
        basePower: 115,
        hits: [1, 1],
        desc: "命中后吸收一半体力",
        effect: (state, attacker, target, rng) => {
            let derdmg = attacker.mag * 0.4 * 1.15;
            let objdmg = attacker.mag * 0.6 * 1.15;
            let def = target.res * 0.6;
            
            let dmg = Math.floor(derdmg + Math.max(0, objdmg - def));
            dmg = Math.max(1, dmg);
            target.hp = Math.max(0, target.hp - dmg);
            
            const heal = Math.floor(dmg / 2);
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
            
            return { dmg, effects: [`💚吸血+${heal}`] };
        }
    },
    
    frenzy: {
        name: "狂暴术",
        type: "attack",
        attr: "magical",
        basePower: 80,
        hits: [1, 1],
        desc: "命中后施加狂暴状态，下回合敌我不分",
        effect: (state, attacker, target, rng) => {
            let derdmg = attacker.mag * 0.4 * 0.80;
            let objdmg = attacker.mag * 0.6 * 0.80;
            let def = target.res * 0.6;
            
            let dmg = Math.floor(derdmg + Math.max(0, objdmg - def));
            dmg = Math.max(1, dmg);
            target.hp = Math.max(0, target.hp - dmg);
            target.frenzy = 1;
            
            return { dmg, effects: ["😠狂暴"] };
        }
    },
    
    curse: {
        name: "诅咒",
        type: "attack",
        attr: "magical",
        basePower: 100,
        hits: [1, 1],
        desc: "施加诅咒状态，受到攻击随机伤害加倍",
        effect: (state, attacker, target, rng) => {
            let derdmg = attacker.mag * 0.4 * 1.0;
            let objdmg = attacker.mag * 0.6 * 1.0;
            let def = target.res * 0.6;
            
            let dmg = Math.floor(derdmg + Math.max(0, objdmg - def));
            dmg = Math.max(1, dmg);
            target.hp = Math.max(0, target.hp - dmg);
            target.cursed = 3;
            
            return { dmg, effects: ["👁️诅咒"] };
        }
    },
    
    purify: {
        name: "净化",
        type: "attack",
        attr: "magical",
        basePower: 100,
        hits: [1, 1],
        desc: "去除目标所有有益效果，对召唤兽伤害加倍",
        effect: (state, attacker, target, rng) => {
            let multiplier = 1.0;
            if (target.isSummon) multiplier = 2.0;
            
            let derdmg = attacker.mag * 0.4 * 1.0 * multiplier;
            let objdmg = attacker.mag * 0.6 * 1.0 * multiplier;
            let def = target.res * 0.6;
            
            let dmg = Math.floor(derdmg + Math.max(0, objdmg - def));
            dmg = Math.max(1, dmg);
            target.hp = Math.max(0, target.hp - dmg);
            
            target.buffs = {};
            
            return { dmg, effects: ["✨净化"] };
        }
    },
    
    poison: {
        name: "投毒",
        type: "attack",
        attr: "magical",
        basePower: 90,
        hits: [1, 1],
        desc: "施加中毒状态，每回合损失体力",
        effect: (state, attacker, target, rng) => {
            let derdmg = attacker.mag * 0.4 * 0.90;
            let objdmg = attacker.mag * 0.6 * 0.90;
            let def = target.res * 0.6;
            
            let dmg = Math.floor(derdmg + Math.max(0, objdmg - def));
            dmg = Math.max(1, dmg);
            target.hp = Math.max(0, target.hp - dmg);
            target.poisoned = 3;
            
            return { dmg, effects: ["☠️中毒"] };
        }
    },
    
    stealth: {
        name: "潜行",
        type: "attack",
        attr: "magical",
        basePower: 500,
        hits: [1, 1],
        desc: "两回合潜行后背刺，中途受伤则打断",
        effect: (state, attacker, target, rng) => {
            if (!attacker.stealthed) {
                attacker.stealthed = 2;
                return { dmg: 0, effects: ["🌫️开始潜行"] };
            } else {
                let derdmg = attacker.mag * 0.4 * 5.0;
                let objdmg = attacker.mag * 0.6 * 5.0;
                let def = target.res * 0.6;
                
                let dmg = Math.floor(derdmg + Math.max(0, objdmg - def));
                dmg = Math.max(1, dmg);
                target.hp = Math.max(0, target.hp - dmg);
                attacker.stealthed = 0;
                
                return { dmg, effects: ["🗡️背刺"] };
            }
        }
    },
    
    plague: {
        name: "瘟疫",
        type: "attack",
        attr: "magical",
        basePower: 0,
        hits: [1, 1],
        desc: "目标按比例损失体力50% ~ 99%",
        effect: (state, attacker, target, rng) => {
            const percent = 50 + Math.floor(rng() * 50); // 50-99%
            const dmg = Math.floor(target.hp * percent / 100);
            target.hp = Math.max(0, target.hp - dmg);
            
            return { dmg, effects: [`🦠${percent}%生命流失`] };
        }
    },
    
    life_swap: {
        name: "生命之轮",
        type: "attack",
        attr: "magical",
        basePower: 0,
        hits: [1, 1],
        desc: "和目标体力值互换",
        effect: (state, attacker, target, rng) => {
            const attackerHp = attacker.hp;
            attacker.hp = target.hp;
            target.hp = attackerHp;
            
            return { dmg: 0, effects: ["🔄生命互换"] };
        }
    }
};

// 辅助技能
export const SUPPORT_SKILLS = {
    focus: {
        name: "聚气",
        type: "support",
        desc: "攻击力提高60%",
        effect: (state, caster, target, rng) => {
            target.atk = Math.floor(target.atk * 1.6);
            target.buffs = target.buffs || {};
            target.buffs.atk = 3;
            return { effects: ["💪攻击上升"] };
        }
    },
    
    charge: {
        name: "蓄力",
        type: "support",
        desc: "下回合伤害提升到300%",
        effect: (state, caster, target, rng) => {
            target.charged = 1;
            return { effects: ["⚡蓄力"] };
        }
    },
    
    charm: {
        name: "魅惑",
        type: "support",
        desc: "目标下回合将施法者视作队友",
        effect: (state, caster, target, rng) => {
            target.charmed = caster.team;
            target.charmedBy = caster.name;
            return { effects: ["💕魅惑"] };
        }
    },
    
    haste: {
        name: "加速术",
        type: "support",
        desc: "速度加倍，持续3回合",
        effect: (state, caster, target, rng) => {
            target.spd = Math.floor(target.spd * 2);
            target.buffs = target.buffs || {};
            target.buffs.spd = 3;
            return { effects: ["💨加速"] };
        }
    },
    
    slow: {
        name: "减速术",
        type: "support",
        desc: "目标速度减半，持续2回合",
        effect: (state, caster, target, rng) => {
            target.spd = Math.floor(target.spd / 2);
            target.debuffs = target.debuffs || {};
            target.debuffs.spd = 2;
            return { effects: ["🐢减速"] };
        }
    },
    
    iron_wall: {
        name: "铁壁",
        type: "support",
        desc: "两回合内防御大幅上升",
        effect: (state, caster, target, rng) => {
            target.def = Math.floor(target.def * 2.5);
            target.res = Math.floor(target.res * 2.5);
            target.buffs = target.buffs || {};
            target.buffs.def = 2;
            return { effects: ["🛡️铁壁"] };
        }
    },
    
    heal: {
        name: "治愈术",
        type: "support",
        desc: "回复体力并去除异常状态",
        effect: (state, caster, target, rng) => {
            const heal = Math.floor(caster.mag * 1.5);
            target.hp = Math.min(target.maxHp, target.hp + heal);
            
            // 清除负面状态
            target.poisoned = 0;
            target.cursed = 0;
            target.frozen = 0;
            target.debuffs = {};
            
            return { effects: [`💚治愈+${heal}`] };
        }
    },
    
    revive: {
        name: "苏生术",
        type: "support",
        desc: "复活一名被击倒的队友",
        effect: (state, caster, target, rng) => {
            const deadAllies = state.getDeadAllies(caster);
            if (deadAllies.length > 0) {
                const revived = deadAllies[Math.floor(rng() * deadAllies.length)];
                revived.hp = Math.floor(revived.maxHp / 2);
                state.reviveFighter(revived);
                return { effects: [`✨复活${revived.name}`] };
            }
            return { effects: [] };
        }
    }
};

// 被动技能
export const PASSIVE_SKILLS = {
    counter: {
        name: "反击",
        type: "passive",
        desc: "受到伤害后向对手进行物理攻击",
        trigger: "afterDamage",
        effect: (state, owner, attacker, damage, rng) => {
            if (!owner.alive) return { effects: [] };
            
            let derdmg = owner.atk * 0.4;
            let objdmg = owner.atk * 0.6;
            let def = attacker.def * 0.6;
            
            let counterDmg = Math.floor(derdmg + Math.max(0, objdmg - def));
            counterDmg = Math.max(1, counterDmg);
            attacker.hp = Math.max(0, attacker.hp - counterDmg);
            
            return { effects: [`⚔️反击-${counterDmg}`] };
        }
    },
    
    guard: {
        name: "防御",
        type: "passive",
        desc: "受到伤害时进行防御，伤害减半",
        trigger: "beforeDamage",
        effect: (state, owner, attacker, damage, rng) => {
            return { damageMultiplier: 0.5, effects: ["🛡️防御"] };
        }
    },
    
    reflect: {
        name: "伤害反弹",
        type: "passive",
        desc: "将伤害反弹到施法者",
        trigger: "afterDamage",
        effect: (state, owner, attacker, damage, rng) => {
            if (!attacker.alive) return { effects: [] };
            
            const reflectDmg = Math.floor(damage * 0.3);
            attacker.hp = Math.max(0, attacker.hp - reflectDmg);
            
            return { effects: [`🔄反弹-${reflectDmg}`] };
        }
    },
    
    protect: {
        name: "守护",
        type: "passive",
        desc: "代替队友承受伤害，伤害减半",
        trigger: "onAllyDamaged",
        effect: (state, owner, ally, attacker, damage, rng) => {
            if (owner.hp < owner.maxHp * 0.2) return { effects: [] }; // 体力过低不守护
            
            const reducedDmg = Math.floor(damage * 0.5);
            owner.hp = Math.max(0, owner.hp - reducedDmg);
            ally.hp = Math.min(ally.maxHp, ally.hp + damage); // 返还伤害
            
            return { effects: [`🤝守护-${reducedDmg}`] };
        }
    },
    
    amulet: {
        name: "护身符",
        type: "passive",
        desc: "被击倒时复活并恢复少量体力",
        trigger: "onDeath",
        effect: (state, owner, rng) => {
            if (owner.amuletUsed) return { effects: [] };
            
            owner.hp = Math.floor(owner.maxHp * 0.3);
            owner.amuletUsed = true;
            
            return { effects: ["🌟复活"] };
        }
    },
    
    desperate: {
        name: "垂死抗争",
        type: "passive",
        desc: "体力极低时所有属性上升",
        trigger: "onLowHp",
        effect: (state, owner, rng) => {
            if (owner.hp > owner.maxHp * 0.2) return { effects: [] };
            
            owner.atk = Math.floor(owner.atk * 1.5);
            owner.def = Math.floor(owner.def * 1.5);
            owner.mag = Math.floor(owner.mag * 1.5);
            owner.res = Math.floor(owner.res * 1.5);
            owner.spd = Math.floor(owner.spd * 1.5);
            
            return { effects: ["🔥垂死抗争"] };
        }
    },
    
    shield: {
        name: "护盾",
        type: "passive",
        desc: "每回合恢复少量护盾",
        trigger: "onTurnStart",
        effect: (state, owner, rng) => {
            const shieldAmount = Math.floor(owner.maxHp * 0.1);
            owner.shield = (owner.shield || 0) + shieldAmount;
            
            return { effects: [`🛡️护盾+${shieldAmount}`] };
        }
    }
};

// 从哈希生成技能
export function generateSkills(name, hash) {
    const skills = {
        attack: null,
        support: null,
        passives: []
    };
    
    // 生成熟练度种子
    const proficiencySeed = parseInt(hash.slice(0, 8), 16);
    
    // 选择攻击技能
    const attackKeys = Object.keys(ATTACK_SKILLS);
    const attackIdx = proficiencySeed % attackKeys.length;
    skills.attack = {
        ...ATTACK_SKILLS[attackKeys[attackIdx]],
        id: attackKeys[attackIdx],
        proficiency: 50 + (proficiencySeed % 50) // 50-99
    };
    
    // 选择辅助技能
    const supportKeys = Object.keys(SUPPORT_SKILLS);
    const supportIdx = (proficiencySeed >> 8) % supportKeys.length;
    skills.support = {
        ...SUPPORT_SKILLS[supportKeys[supportIdx]],
        id: supportKeys[supportIdx],
        proficiency: 50 + ((proficiencySeed >> 16) % 50)
    };
    
    // 选择被动技能 (1-2个)
    const passiveKeys = Object.keys(PASSIVE_SKILLS);
    const passiveCount = 1 + ((proficiencySeed >> 24) % 2);
    const usedIndices = new Set();
    
    for (let i = 0; i < passiveCount; i++) {
        let idx;
        do {
            idx = ((proficiencySeed >> (i * 8)) * 7919) % passiveKeys.length;
        } while (usedIndices.has(idx));
        usedIndices.add(idx);
        
        skills.passives.push({
            ...PASSIVE_SKILLS[passiveKeys[idx]],
            id: passiveKeys[idx],
            proficiency: 50 + (((proficiencySeed >> (i * 4)) * 123) % 50)
        });
    }
    
    return skills;
}

// 检查技能是否触发（基于熟练度）
export function checkSkillTrigger(skill, rng) {
    const triggerRate = skill.proficiency / 100;
    return rng() < triggerRate;
}