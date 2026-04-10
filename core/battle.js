import { sha256 } from "../utils/sha256.js";
import { createBattleRNG } from "../utils/random.js";
import { generateStats } from "./stats.js";
import { generateSkills, checkSkillTrigger, getDefaultAttack } from "./skills.js";

export async function battle(teams, options = {}) {
    const { silent = false, returnResults = false } = options;

    const allNames = teams.flatMap(t => t.members);

    // 生成角色
    const fighters = [];
    for (const name of allNames) {
        const hash = await sha256(name);
        const fighter = generateStats(name, hash);
        fighter.team = teams.findIndex(t => t.members.includes(name));
        fighter.skills = generateSkills(name, hash);
        fighter.maxHp = fighter.hp;
        fighter.alive = true;
        fighter.buffs = {};
        fighter.debuffs = {};
        fighter.statusEffects = [];
        fighters.push(fighter);
    }

    const rng = await createBattleRNG(allNames);
    
    let log = "";
    if (!silent) {
        log = `SHA256 名字竞技场\n`;
        teams.forEach((team, idx) => {
            log += `队伍${idx + 1} (${team.members.join(", ")})\n`;
            const teamFighters = fighters.filter(f => f.team === idx);
            teamFighters.forEach(f => {
                log += `\t${f.name}: 血${f.hp} 攻${f.atk} 防${f.def} 速${f.spd} 敏${f.agi} 魔${f.mag} 抗${f.res} 智${f.int}\n`;
                const attackNames = f.skills.attacks.map(s => `${s.name}(${s.proficiency}%)`).join(", ");
                const supportNames = f.skills.supports.map(s => `${s.name}(${s.proficiency}%)`).join(", ");
                const passiveNames = f.skills.passives.map(s => s.name).join(", ");
                log += `\t  攻击: ${attackNames}\n`;
                if (supportNames) log += `\t  辅助: ${supportNames}\n`;
                if (passiveNames) log += `\t  被动: ${passiveNames}\n`;
            });
        });
        log += `\n`;
    }

    const alive = new Set(fighters.map(f => f.name));
    const deadSet = new Set();
    
    // 初始化行动条
    const actionBars = new Map();
    fighters.forEach(f => {
        actionBars.set(f.name, rng() * 50);
    });
    
    let actionCount = 0;
    const maxActions = 500;
    
    const getAliveTeams = () => {
        const teams = new Set();
        fighters.filter(f => alive.has(f.name)).forEach(f => teams.add(f.team));
        return teams;
    };

    while (alive.size > 1 && getAliveTeams().size > 1 && actionCount < maxActions) {
        
        // 增加行动条
        for (const f of fighters) {
            if (!alive.has(f.name)) continue;
            const oldBar = actionBars.get(f.name) || 0;
            let speedMultiplier = 1.0;
            if (f.buffs.spd) speedMultiplier *= 1.5;
            if (f.debuffs.spd) speedMultiplier *= 0.5;
            const gain = 15 + f.spd * 0.3 * speedMultiplier + f.agi * 0.2;
            actionBars.set(f.name, oldBar + gain);
        }
        
        // 找到行动条最高者
        let maxBar = -1;
        let attacker = null;
        
        for (const f of fighters) {
            if (!alive.has(f.name)) continue;
            const bar = actionBars.get(f.name) || 0;
            if (bar > maxBar) {
                maxBar = bar;
                attacker = f;
            }
        }
        
        if (maxBar < 100) continue;
        
        // 重要：无论是否有目标，都要消耗行动条
        actionBars.set(attacker.name, maxBar - 100);
        actionCount++;
        
        // 回合开始触发被动
        for (const passive of attacker.skills.passives) {
            if (passive.trigger === "onTurnStart" && checkSkillTrigger(passive, rng)) {
                if (!silent) log += `\n✨ ${attacker.name} 触发 ${passive.name}`;
                if (passive.id === "shield") {
                    attacker.shield = (attacker.shield || 0) + Math.floor(attacker.maxHp * 0.1);
                }
            }
        }
        
        // 选择目标
        const targets = fighters.filter(f => 
            alive.has(f.name) && f.team !== attacker.team
        );
        
        // 如果没有目标，跳过本次行动（战斗可能已结束）
        if (targets.length === 0) {
            // 检查战斗是否结束
            if (getAliveTeams().size <= 1) break;
            continue;
        }
        
        const target = targets[Math.floor(rng() * targets.length)];
        if (!target) continue;
        
        // 决定使用攻击还是辅助
        const useSupport = attacker.skills.supports.length > 0 && rng() < 0.3;
        
        if (useSupport) {
            // 使用辅助技能
            const supportSkill = attacker.skills.supports[Math.floor(rng() * attacker.skills.supports.length)];
            if (checkSkillTrigger(supportSkill, rng)) {
                if (!silent) log += `\n🔮 ${attacker.name} 使用 ${supportSkill.name}`;
                
                // 辅助技能效果
                if (supportSkill.id === "heal") {
                    const allies = fighters.filter(f => alive.has(f.name) && f.team === attacker.team);
                    const healTarget = allies.length > 0 ? 
                        (rng() < 0.5 ? attacker : allies[Math.floor(rng() * allies.length)]) : 
                        attacker;
                    const healAmount = Math.floor(attacker.mag * 1.5);
                    healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + healAmount);
                    if (!silent) log += ` → ${healTarget.name} 回复 ${healAmount}`;
                } else if (supportSkill.id === "haste") {
                    attacker.buffs.spd = 3;
                    if (!silent) log += ` → 速度上升`;
                } else if (supportSkill.id === "iron_wall") {
                    attacker.buffs.def = 2;
                    attacker.buffs.res = 2;
                    if (!silent) log += ` → 防御上升`;
                } else if (supportSkill.id === "focus") {
                    attacker.buffs.atk = 3;
                    if (!silent) log += ` → 攻击上升`;
                } else if (supportSkill.id === "charge") {
                    attacker.charged = 1;
                    if (!silent) log += ` → 蓄力`;
                }
            }
        } else {
            // 使用攻击技能
            const attackSkill = attacker.skills.attacks.length > 0 ? 
                attacker.skills.attacks[Math.floor(rng() * attacker.skills.attacks.length)] : 
                getDefaultAttack(attacker);
            
            const useSkill = checkSkillTrigger(attackSkill, rng);
            const skill = useSkill ? attackSkill : getDefaultAttack(attacker);
            
            // 命中判定
            const hitBase = 70 + (attacker.agi - target.agi) * 0.5;
            const hitRate = Math.min(95, Math.max(5, hitBase));
            const hitRoll = Math.floor(rng() * 100);
            
            if (!silent) {
                log += `\n${attacker.name} 对 ${target.name} 发动攻击`;
                if (useSkill) log += ` (${skill.name})`;
            }
            
            if (hitRoll >= hitRate) {
                if (!silent) log += `\n\t${target.name} 闪避了攻击`;
                continue;
            }
            
            // 伤害计算
            let derdmg, objdmg, def;
            const power = skill.basePower / 100;
            
            if (skill.attr === "magical") {
                derdmg = attacker.mag * 0.4 * power;
                objdmg = attacker.mag * 0.6 * power;
                def = target.res * 0.6;
            } else {
                derdmg = attacker.atk * 0.4 * power;
                objdmg = attacker.atk * 0.6 * power;
                def = target.def * 0.6;
            }
            
            let effects = [];
            
            // 蓄力
            if (attacker.charged) {
                derdmg *= 3;
                objdmg *= 3;
                attacker.charged = 0;
                effects.push("⚡蓄力");
            }
            
            // 暴击
            if (rng() * 100 < Math.min(60, Math.max(5, 10 + (attacker.agi - target.agi) * 0.2))) {
                derdmg = derdmg * 2;
                objdmg = objdmg * 1.5;
                effects.push("💥暴击");
            }
            
            // 偷袭
            if (rng() * 100 < Math.min(40, Math.max(0, 15 + (attacker.int - target.int) * 0.5))) {
                def = def * 0.2;
                effects.push("✨偷袭");
            }
            
            let dmg = Math.floor(derdmg + Math.max(0, objdmg - def));
            
            // 护盾
            if (target.shield > 0) {
                const absorbed = Math.min(target.shield, dmg);
                dmg -= absorbed;
                target.shield -= absorbed;
                effects.push(`🛡️护盾-${absorbed}`);
            }
            
            dmg = Math.max(1, dmg);
            target.hp = Math.max(0, target.hp - dmg);
            
            if (!silent) {
                if (effects.length > 0) log += `\n\t${attacker.name} 发动了 ${effects.join(" ")}`;
                log += `\n\t${target.name} 受到了 ${dmg} 点伤害`;
            }
            
            // 吸血
            if (skill.id === "drain_life") {
                const heal = Math.floor(dmg / 2);
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
                if (!silent) log += `\n\t${attacker.name} 吸收了 ${heal} 点体力`;
            }
            
            // 中毒
            if (skill.id === "poison") {
                target.poisoned = 3;
            }
            
            // 冰冻
            if (skill.id === "ice_bolt") {
                target.frozen = 1;
            }
            
            // 诅咒
            if (skill.id === "curse") {
                target.cursed = 3;
            }
            
            // 生命互换
            if (skill.id === "life_swap") {
                const temp = attacker.hp;
                attacker.hp = target.hp;
                target.hp = temp;
                if (!silent) log += `\n\t生命值互换了!`;
            }
            
            // 瘟疫
            if (skill.id === "plague") {
                const percent = 50 + Math.floor(rng() * 50);
                dmg = Math.floor(target.hp * percent / 100);
                target.hp = Math.max(0, target.hp - dmg);
                if (!silent) log += `\n\t瘟疫造成了 ${dmg} 点伤害 (${percent}%)`;
            }
            
            // 检查死亡
            if (target.hp <= 0) {
                alive.delete(target.name);
                deadSet.add(target.name);
                target.alive = false;
                if (!silent) log += `\n${target.name} 被击倒了!`;
                
                // 击杀被动
                for (const passive of attacker.skills.passives) {
                    if (passive.trigger === "onKill" && checkSkillTrigger(passive, rng)) {
                        if (!silent) log += `\n✨ ${attacker.name} 触发 ${passive.name}`;
                    }
                }
            }
            
            // 反击
            for (const passive of target.skills.passives) {
                if (passive.trigger === "afterDamage" && passive.id === "counter" && target.alive && checkSkillTrigger(passive, rng)) {
                    const counterDmg = Math.floor(target.atk * 0.5);
                    attacker.hp = Math.max(0, attacker.hp - counterDmg);
                    if (!silent) log += `\n\t${target.name} 反击造成 ${counterDmg} 点伤害`;
                }
            }
        }
        
        // 检查战斗是否结束
        if (getAliveTeams().size <= 1) break;
        
        // 中毒伤害（每轮结束时触发一次）
        if (actionCount % 5 === 0) {
            for (const f of fighters) {
                if (!alive.has(f.name)) continue;
                if (f.poisoned > 0) {
                    const poisonDmg = Math.floor(f.maxHp * 0.05);
                    f.hp = Math.max(0, f.hp - poisonDmg);
                    f.poisoned--;
                    if (!silent && poisonDmg > 0) {
                        log += `\n☠️ ${f.name} 中毒损失 ${poisonDmg} 点体力`;
                    }
                    if (f.hp <= 0) {
                        alive.delete(f.name);
                        deadSet.add(f.name);
                        f.alive = false;
                        if (!silent) log += ` → ${f.name} 被毒倒了!`;
                    }
                }
            }
        }
    }
    
    const aliveFighters = fighters.filter(f => alive.has(f.name));
    const winnerTeamIdx = aliveFighters.length > 0 ? aliveFighters[0].team : 0;
    const winnerTeam = teams[winnerTeamIdx];
    const winner = aliveFighters.find(f => f.team === winnerTeamIdx);
    
    if (!silent) {
        log += `\n\n🏆 胜者队伍: 队伍${winnerTeamIdx + 1} (${winnerTeam.members.join(", ")})`;
    }
    
    if (returnResults) {
        return { winner: winner ? winner.name : null, winnerTeam: winnerTeamIdx, fighters };
    }
    return { log, winner, winnerTeam: winnerTeamIdx, fighters, deadSet, teams };
}
