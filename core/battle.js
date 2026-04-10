import { sha256 } from "../utils/sha256.js";
import { createBattleRNG } from "../utils/random.js";
import { generateStats } from "./stats.js";
import { generateSkills, checkSkillTrigger, SkillHandlers } from "./skills.js";

// ========== 战斗状态管理类 ==========
class BattleState {
    constructor(fighters, teams, rng) {
        this.fighters = fighters;
        this.teams = teams;
        this.rng = rng;
        this.alive = new Set(fighters.map(f => f.name));
        this.deadSet = new Set();
        this.actionBars = new Map();
        this.actionCount = 0;
        
        fighters.forEach(f => {
            this.actionBars.set(f.name, rng() * 30 + 70);
        });
    }
    
    getAliveTeams() {
        const teams = new Set();
        this.fighters.filter(f => this.alive.has(f.name)).forEach(f => teams.add(f.team));
        return teams;
    }
    
    getAliveFighters() {
        return this.fighters.filter(f => this.alive.has(f.name));
    }
    
    getEnemies(attacker) {
        return this.fighters.filter(f => 
            this.alive.has(f.name) && f.team !== attacker.team
        );
    }
    
    getAllies(attacker) {
        return this.fighters.filter(f => 
            this.alive.has(f.name) && f.team === attacker.team && f.name !== attacker.name
        );
    }
    
    isBattleOver() {
        return this.alive.size <= 1 || this.getAliveTeams().size <= 1;
    }
    
    removeFighter(name) {
        this.alive.delete(name);
        this.deadSet.add(name);
        const fighter = this.fighters.find(f => f.name === name);
        if (fighter) fighter.alive = false;
    }
}

// ========== 行动条系统 ==========
function updateActionBars(state) {
    for (const f of state.fighters) {
        if (!state.alive.has(f.name)) continue;
        const oldBar = state.actionBars.get(f.name) || 0;
        let speedMultiplier = 1.0;
        if (f.buffs?.spd) speedMultiplier *= 1.5;
        if (f.debuffs?.spd) speedMultiplier *= 0.5;
        const gain = 10 + f.spd * 0.4 * speedMultiplier;
        state.actionBars.set(f.name, oldBar + gain);
    }
}

function getNextAttacker(state) {
    let maxBar = -1;
    let attacker = null;
    
    for (const f of state.fighters) {
        if (!state.alive.has(f.name)) continue;
        const bar = state.actionBars.get(f.name) || 0;
        if (bar > maxBar) {
            maxBar = bar;
            attacker = f;
        }
    }
    
    if (maxBar < 100) return null;
    
    state.actionBars.set(attacker.name, maxBar - 100);
    state.actionCount++;
    return attacker;
}

// ========== 状态效果处理 ==========
function applyPoisonDamage(state, silent, log) {
    for (const f of state.fighters) {
        if (!state.alive.has(f.name)) continue;
        if (f.poisoned > 0) {
            const poisonDmg = Math.floor(f.maxHp * 0.05);
            f.hp = Math.max(0, f.hp - poisonDmg);
            f.poisoned--;
            if (!silent) log.push(`${f.name} 中毒损失 ${poisonDmg} 点体力`);
            if (f.hp <= 0) {
                state.removeFighter(f.name);
                if (!silent) log.push(`${f.name} 被毒倒!`);
            }
        }
    }
}

function applyFrozenEffect(state) {
    for (const f of state.fighters) {
        if (f.frozen > 0) {
            f.frozen--;
        }
    }
}

function triggerTurnStartPassives(attacker, state, silent, log) {
    for (const passive of attacker.skills.passives) {
        if (passive.trigger === "onTurnStart" && checkSkillTrigger(passive, state.rng)) {
            if (!silent) log.push(`${attacker.name} 触发 ${passive.name}`);
            const handler = SkillHandlers[passive.id];
            if (handler) {
                const result = handler(attacker, null, state);
                if (result.effects && !silent) {
                    log.push(`\t${result.effects.join(" ")}`);
                }
            }
        }
    }
}

// ========== 技能执行 ==========
function executeAttack(attacker, enemies, skill, state, silent, log) {
    const target = enemies[Math.floor(state.rng() * enemies.length)];
    
    // 冰冻检查
    if (attacker.frozen > 0) {
        if (!silent) log.push(`${attacker.name} 被冰冻，无法行动`);
        return;
    }
    
    // 命中判定
    const hitBase = 70 + (attacker.agi - target.agi) * 0.5;
    const hitRate = Math.min(95, Math.max(5, hitBase));
    const hitRoll = Math.floor(state.rng() * 100);
    
    if (!silent) {
        let attackStr = `${attacker.name} 对 ${target.name}`;
        if (skill.id !== "normal") {
            attackStr += ` 使用 ${skill.name}`;
        } else {
            attackStr += ` 发动攻击`;
        }
        log.push(attackStr);
    }
    
    if (hitRoll >= hitRate) {
        if (!silent) log.push(`\t${target.name} 闪避了攻击`);
        return;
    }
    
    // 执行技能效果
    const handler = SkillHandlers[skill.id];
    if (!handler) return;
    
    const result = handler(attacker, target, state);
    
    // 处理伤害
    if (result.results) {
        result.results.forEach(r => {
            const targetFighter = state.fighters.find(f => f.name === r.target);
            if (targetFighter) {
                targetFighter.hp = Math.max(0, targetFighter.hp - r.dmg);
                if (!silent) log.push(`\t${r.target} 受到 ${r.dmg} 点伤害`);
                
                if (targetFighter.hp <= 0) {
                    state.removeFighter(targetFighter.name);
                    if (!silent) log.push(`${targetFighter.name} 被击倒了!`);
                }
            }
        });
    } else if (result.dmg) {
        target.hp = Math.max(0, target.hp - result.dmg);
        if (!silent) log.push(`\t${target.name} 受到 ${result.dmg} 点伤害`);
    }
    
    // 显示效果
    if (result.effects && result.effects.length > 0 && !silent) {
        log.push(`\t${result.effects.join(" ")}`);
    }
    
    // 检查目标死亡
    if (target.hp <= 0) {
        state.removeFighter(target.name);
        if (!silent) log.push(`${target.name} 被击倒了!`);
        return;
    }
    
    // 反击
    for (const passive of target.skills.passives) {
        if (passive.trigger === "afterDamage" && passive.id === "counter" && target.alive && checkSkillTrigger(passive, state.rng)) {
            const handler = SkillHandlers.counter;
            const result = handler(target, attacker, state);
            if (!silent) log.push(`\t${result.effects[0]}`);
            if (attacker.hp <= 0) {
                state.removeFighter(attacker.name);
                if (!silent) log.push(`${attacker.name} 被反击击倒!`);
            }
        }
    }
}

function executeSupport(attacker, skill, state, silent, log) {
    const allies = state.getAllies(attacker);
    const target = allies.length > 0 && state.rng() < 0.5 ? 
        allies[Math.floor(state.rng() * allies.length)] : attacker;
    
    if (!silent) {
        log.push(`${attacker.name} 对 ${target.name} 使用 ${skill.name}`);
    }
    
    const handler = SkillHandlers[skill.id];
    if (handler) {
        const result = handler(attacker, target, state);
        if (result.effects && !silent) {
            log.push(`\t${result.effects.join(" ")}`);
        }
    }
}

function takeAction(attacker, state, silent, log) {
    const enemies = state.getEnemies(attacker);
    if (enemies.length === 0) return;
    
    // 触发回合开始被动
    triggerTurnStartPassives(attacker, state, silent, log);
    
    // 决定使用攻击还是辅助
    const useSupport = attacker.skills.supports.length > 0 && state.rng() < 0.3;
    
    if (useSupport) {
        const skill = attacker.skills.supports[0];
        if (checkSkillTrigger(skill, state.rng)) {
            executeSupport(attacker, skill, state, silent, log);
        }
    } else {
        const skill = attacker.skills.attacks[Math.floor(state.rng() * attacker.skills.attacks.length)];
        if (checkSkillTrigger(skill, state.rng)) {
            executeAttack(attacker, enemies, skill, state, silent, log);
        } else {
            const normalSkill = attacker.skills.attacks.find(s => s.id === "normal");
            executeAttack(attacker, enemies, normalSkill, state, silent, log);
        }
    }
}

// ========== 战斗主循环 ==========
async function battleLoop(state, silent) {
    const log = [];
    const maxActions = 500;
    
    while (!state.isBattleOver() && state.actionCount < maxActions) {
        // 中毒伤害
        applyPoisonDamage(state, silent, log);
        if (state.isBattleOver()) break;
        
        // 冰冻效果衰减
        applyFrozenEffect(state);
        
        // 更新行动条
        updateActionBars(state);
        
        // 获取下一个攻击者
        const attacker = getNextAttacker(state);
        if (!attacker) continue;
        
        // 执行行动
        takeAction(attacker, state, silent, log);
    }
    
    return log;
}

// ========== 生成角色 ==========
async function createFighters(teams) {
    const allNames = teams.flatMap(t => t.members);
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
        fighters.push(fighter);
    }
    
    return fighters;
}

// ========== 格式化输出 ==========
function formatInitialLog(teams, fighters) {
    let log = `SHA256 名字竞技场\n`;
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
    return log;
}

function formatWinnerLog(state, teams) {
    const aliveFighters = state.getAliveFighters();
    const winnerTeamIdx = aliveFighters.length > 0 ? aliveFighters[0].team : 0;
    const winnerTeam = teams[winnerTeamIdx];
    return `\n\n🏆 胜者队伍: 队伍${winnerTeamIdx + 1} (${winnerTeam.members.join(", ")})`;
}

// ========== 主入口 ==========
export async function battle(teams, options = {}) {
    const { silent = false, returnResults = false } = options;
    
    const fighters = await createFighters(teams);
    const allNames = teams.flatMap(t => t.members);
    const rng = await createBattleRNG(allNames);
    const state = new BattleState(fighters, teams, rng);
    
    let log = "";
    if (!silent) {
        log = formatInitialLog(teams, fighters);
    }
    
    const battleLogs = await battleLoop(state, silent);
    if (!silent) {
        log += battleLogs.map(l => `\n${l}`).join("");
        log += formatWinnerLog(state, teams);
    }
    
    const aliveFighters = state.getAliveFighters();
    const winnerTeamIdx = aliveFighters.length > 0 ? aliveFighters[0].team : 0;
    const winnerTeam = teams[winnerTeamIdx];
    const winner = aliveFighters.find(f => f.team === winnerTeamIdx);
    
    if (returnResults) {
        return { winner: winner ? winner.name : null, winnerTeam: winnerTeamIdx, fighters };
    }
    return { log, winner, winnerTeam: winnerTeamIdx, fighters, deadSet: state.deadSet, teams };
}