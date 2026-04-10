import { sha256 } from "../utils/sha256.js";
import { createBattleRNG } from "../utils/random.js";
import { generateStats } from "./stats.js";
import { generateSkills, checkSkillTrigger, ATTACK_SKILLS, SUPPORT_SKILLS, PASSIVE_SKILLS } from "./skills.js";

// 战斗状态管理
class BattleState {
    constructor(fighters, teams) {
        this.fighters = fighters;
        this.teams = teams;
        this.alive = new Set(fighters.map(f => f.name));
        this.deadSet = new Set();
        this.actionTimers = new Map();
        this.turnCount = 0;
        
        fighters.forEach(f => {
            f.maxHp = f.hp;
            f.alive = true;
            f.buffs = {};
            f.debuffs = {};
            this.actionTimers.set(f.name, f.spd * 1.5);
        });
    }
    
    getAliveEnemies(attacker) {
        return this.fighters.filter(f => 
            this.alive.has(f.name) && f.team !== attacker.team
        );
    }
    
    getAliveAllies(attacker) {
        return this.fighters.filter(f => 
            this.alive.has(f.name) && f.team === attacker.team && f.name !== attacker.name
        );
    }
    
    getRandomEnemy(attacker) {
        const enemies = this.getAliveEnemies(attacker);
        if (enemies.length === 0) return null;
        return enemies[Math.floor(Math.random() * enemies.length)];
    }
    
    getRandomEnemies(attacker, count) {
        const enemies = this.getAliveEnemies(attacker);
        const shuffled = [...enemies].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(count, enemies.length));
    }
    
    getDeadAllies(attacker) {
        return this.fighters.filter(f => 
            !this.alive.has(f.name) && f.team === attacker.team
        );
    }
    
    reviveFighter(fighter) {
        this.alive.add(fighter.name);
        this.deadSet.delete(fighter.name);
        fighter.alive = true;
    }
    
    getAliveTeams() {
        const aliveTeams = new Set();
        this.fighters.filter(f => this.alive.has(f.name)).forEach(f => aliveTeams.add(f.team));
        return aliveTeams;
    }
    
    applyDotDamage(rng) {
        const log = [];
        this.fighters.forEach(f => {
            if (!this.alive.has(f.name)) return;
            
            // 中毒伤害
            if (f.poisoned > 0) {
                const poisonDmg = Math.floor(f.maxHp * 0.05);
                f.hp = Math.max(0, f.hp - poisonDmg);
                f.poisoned--;
                log.push(`☠️ ${f.name} 中毒损失 ${poisonDmg} 点体力`);
            }
            
            // 诅咒可能触发额外伤害
            if (f.cursed > 0 && rng() < 0.3) {
                const curseDmg = Math.floor(f.hp * 0.1);
                f.hp = Math.max(0, f.hp - curseDmg);
                log.push(`👁️ ${f.name} 诅咒发作损失 ${curseDmg} 点体力`);
                f.cursed--;
            }
            
            // 检查是否死亡
            if (f.hp <= 0) {
                this.alive.delete(f.name);
                this.deadSet.add(f.name);
                f.alive = false;
                log.push(`💀 ${f.name} 被持续伤害击倒了!`);
            }
        });
        return log;
    }
    
    updateBuffsAndDebuffs() {
        this.fighters.forEach(f => {
            // 更新增益
            if (f.buffs) {
                Object.keys(f.buffs).forEach(key => {
                    f.buffs[key]--;
                    if (f.buffs[key] <= 0) {
                        // 恢复原值（这里简化处理）
                        delete f.buffs[key];
                    }
                });
            }
            
            // 更新减益
            if (f.debuffs) {
                Object.keys(f.debuffs).forEach(key => {
                    f.debuffs[key]--;
                    if (f.debuffs[key] <= 0) {
                        delete f.debuffs[key];
                    }
                });
            }
            
            // 冰冻状态消耗
            if (f.frozen > 0) {
                f.frozen -= 0.5;
            }
            
            // 狂暴状态消耗
            if (f.frenzy > 0) {
                f.frenzy--;
            }
            
            // 潜行状态
            if (f.stealthed > 0) {
                f.stealthed--;
            }
        });
    }
}

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
        fighters.push(fighter);
    }

    const rng = await createBattleRNG(allNames);
    const state = new BattleState(fighters, teams);
    
    let log = "";
    if (!silent) {
        log = `SHA256 名字竞技场\n`;
        teams.forEach((team, idx) => {
            log += `队伍${idx + 1} (${team.members.join(", ")})\n`;
            const teamFighters = fighters.filter(f => f.team === idx);
            teamFighters.forEach(f => {
                log += `\t${f.name}: 血${f.hp} 攻${f.atk} 防${f.def} 速${f.spd} 敏${f.agi} 魔${f.mag} 抗${f.res} 智${f.int}\n`;
                log += `\t  技能: ${f.skills.attack.name}(${f.skills.attack.proficiency}%) / ${f.skills.support.name}(${f.skills.support.proficiency}%)\n`;
                if (f.skills.passives.length > 0) {
                    log += `\t  被动: ${f.skills.passives.map(p => p.name).join(", ")}\n`;
                }
            });
        });
        log += `\n`;
    }

    let actionCount = 0;
    const maxActions = 5000;

    while (state.getAliveTeams().size > 1 && actionCount < maxActions) {
        state.turnCount++;
        
        // 回合开始被动触发
        fighters.forEach(f => {
            if (!state.alive.has(f.name)) return;
            f.skills.passives.forEach(passive => {
                if (passive.trigger === "onTurnStart" && checkSkillTrigger(passive, rng)) {
                    const result = passive.effect(state, f, null, 0, rng);
                    if (!silent && result.effects.length > 0) {
                        log += `\n✨ ${f.name} 触发被动: ${passive.name} ${result.effects.join(" ")}`;
                    }
                }
            });
        });
        
        // 护盾恢复
        fighters.forEach(f => {
            if (!state.alive.has(f.name)) return;
            if (f.skills.passives.some(p => p.id === "shield") && checkSkillTrigger(f.skills.passives.find(p => p.id === "shield"), rng)) {
                const shieldAmount = Math.floor(f.maxHp * 0.1);
                f.shield = (f.shield || 0) + shieldAmount;
            }
        });
        
        // 持续伤害
        const dotLogs = state.applyDotDamage(rng);
        if (!silent) dotLogs.forEach(l => log += `\n${l}`);
        
        if (state.getAliveTeams().size <= 1) break;

        // 增加行动进度
        for (const f of fighters) {
            if (!state.alive.has(f.name)) continue;
            if (f.frozen > 0) {
                f.frozen -= 0.5;
                continue; // 冰冻跳过行动
            }
            const old = state.actionTimers.get(f.name);
            const gain = 5 + f.spd * 0.8;
            state.actionTimers.set(f.name, old + gain);
        }

        const ready = fighters.filter(f => 
            state.alive.has(f.name) && 
            state.actionTimers.get(f.name) >= 100 &&
            f.frozen <= 0
        );
        
        if (ready.length === 0) continue;

        ready.sort((a, b) => state.actionTimers.get(b.name) - state.actionTimers.get(a.name));

        for (const attacker of ready) {
            if (!state.alive.has(attacker.name)) continue;
            if (state.getAliveTeams().size <= 1) break;

            const overflow = state.actionTimers.get(attacker.name) - 100;
            state.actionTimers.set(attacker.name, Math.max(0, overflow));

            // 选择行动：攻击技能或辅助技能
            const useSupport = rng() < 0.3 && attacker.skills.support; // 30%概率使用辅助技能
            
            if (useSupport && checkSkillTrigger(attacker.skills.support, rng)) {
                // 使用辅助技能
                const skill = attacker.skills.support;
                const allies = state.getAliveAllies(attacker);
                const target = allies.length > 0 ? 
                    (rng() < 0.5 ? attacker : allies[Math.floor(rng() * allies.length)]) : 
                    attacker;
                
                const result = skill.effect(state, attacker, target, rng);
                
                if (!silent) {
                    log += `\n🔮 ${attacker.name} 使用 ${skill.name} → ${target.name}`;
                    if (result.effects.length > 0) {
                        log += `\n\t${result.effects.join(" ")}`;
                    }
                }
            } else {
                // 使用攻击技能
                const skill = attacker.skills.attack;
                const targets = state.getAliveEnemies(attacker);
                if (targets.length === 0) break;
                
                // 检查是否狂暴（敌我不分）
                let actualTargets = targets;
                if (attacker.frenzy > 0) {
                    actualTargets = fighters.filter(f => 
                        state.alive.has(f.name) && f.name !== attacker.name
                    );
                }
                
                const target = actualTargets[Math.floor(rng() * actualTargets.length)];
                if (!target) continue;

                // 命中判定
                const hitBase = 70 + (attacker.agi - target.agi) * 0.5;
                const hitRate = Math.min(95, Math.max(5, hitBase));
                const hitRoll = Math.floor(rng() * 100);

                actionCount++;
                
                if (!silent) {
                    log += `\n⚔️ ${attacker.name} 对 ${target.name} 使用 ${skill.name}`;
                }

                if (hitRoll >= hitRate) {
                    if (!silent) log += `\n\t🍃 ${target.name} 闪避了攻击\n`;
                    continue;
                }

                // 检查技能是否触发
                let dmg = 0;
                let effects = [];
                
                if (checkSkillTrigger(skill, rng)) {
                    const result = skill.effect(state, attacker, target, rng);
                    dmg = result.dmg;
                    effects = result.effects;
                } else {
                    // 普通攻击
                    let derdmg = attacker.atk * 0.4;
                    let objdmg = attacker.atk * 0.6;
                    let def = target.def * 0.6;
                    
                    if (rng() * 100 < Math.min(60, Math.max(0, 20 + (attacker.mag - attacker.atk) * 0.5))) {
                        derdmg = attacker.mag * 0.4;
                        objdmg = attacker.mag * 0.6;
                        def = target.res * 0.6;
                        effects.push("🔮魔法");
                    }
                    
                    dmg = Math.floor(derdmg + Math.max(0, objdmg - def));
                }
                
                // 蓄力加成
                if (attacker.charged) {
                    dmg = Math.floor(dmg * 3);
                    attacker.charged = 0;
                    effects.push("⚡蓄力");
                }
                
                // 诅咒效果
                if (target.cursed > 0 && rng() < 0.3) {
                    dmg = Math.floor(dmg * 2);
                    effects.push("👁️诅咒加倍");
                }
                
                // 护盾抵消
                if (target.shield > 0) {
                    const absorbed = Math.min(target.shield, dmg);
                    dmg -= absorbed;
                    target.shield -= absorbed;
                    effects.push(`🛡️护盾-${absorbed}`);
                }
                
                dmg = Math.max(1, dmg);
                
                // 伤害前被动
                target.skills.passives.forEach(passive => {
                    if (passive.trigger === "beforeDamage" && checkSkillTrigger(passive, rng)) {
                        const result = passive.effect(state, target, attacker, dmg, rng);
                        if (result.damageMultiplier) {
                            dmg = Math.floor(dmg * result.damageMultiplier);
                        }
                        effects.push(...result.effects);
                    }
                });
                
                target.hp = Math.max(0, target.hp - dmg);
                
                if (!silent) {
                    if (effects.length > 0) log += `\n\t${effects.join(" ")}`;
                    log += `\n\t💔 ${target.name} 受到 ${dmg} 点伤害 (HP: ${target.hp}/${target.maxHp})\n`;
                }
                
                // 伤害后被动
                target.skills.passives.forEach(passive => {
                    if (passive.trigger === "afterDamage" && checkSkillTrigger(passive, rng)) {
                        const result = passive.effect(state, target, attacker, dmg, rng);
                        if (!silent && result.effects.length > 0) {
                            log += `\n\t${result.effects.join(" ")}`;
                        }
                    }
                });
                
                // 吸血效果（如果是吸血技能）
                if (skill.id === "drain_life") {
                    const heal = Math.floor(dmg / 2);
                    attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
                }
                
                if (target.hp <= 0) {
                    state.alive.delete(target.name);
                    state.deadSet.add(target.name);
                    target.alive = false;
                    
                    if (!silent) log += `\n☠️ ${target.name} 被击倒了!\n`;
                    
                    // 死亡被动
                    target.skills.passives.forEach(passive => {
                        if (passive.trigger === "onDeath" && checkSkillTrigger(passive, rng)) {
                            const result = passive.effect(state, target, rng);
                            if (result.effects.length > 0 && !silent) {
                                log += `\n${result.effects.join(" ")}`;
                            }
                            // 护身符复活
                            if (passive.id === "amulet" && !target.amuletUsed) {
                                state.alive.add(target.name);
                                state.deadSet.delete(target.name);
                                target.alive = true;
                            }
                        }
                    });
                }
            }
        }
        
        // 更新状态
        state.updateBuffsAndDebuffs();
    }

    const winnerTeamIdx = state.getAliveTeams().values().next().value;
    const winnerTeam = teams[winnerTeamIdx];
    const winner = fighters.find(f => f.team === winnerTeamIdx);

    if (!silent) {
        log += `\n🏆 胜者队伍: 队伍${winnerTeamIdx + 1} (${winnerTeam.members.join(", ")})`;
    }

    if (returnResults) {
        return { winner: winner ? winner.name : null, winnerTeam: winnerTeamIdx, fighters };
    }
    return { log, winner, winnerTeam: winnerTeamIdx, fighters, deadSet: state.deadSet, teams };
}