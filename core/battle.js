import { sha256 } from "../utils/sha256.js";
import { createBattleRNG } from "../utils/random.js";
import { generateStats } from "./stats.js";
import { generateSkills, checkSkillTrigger, getDefaultAttack } from "./skills.js";

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
        
        // 初始化行动条
        fighters.forEach(f => {
            this.actionBars.set(f.name, rng() * 50);
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
            this.alive.has(f.name) && f.team === attacker.team
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
        const gain = 15 + f.spd * 0.3 * speedMultiplier + f.agi * 0.2;
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
    const fightersArray = [...state.fighters];
    for (const f of fightersArray) {
        if (!state.alive.has(f.name)) continue;
        if (f.poisoned > 0) {
            const poisonDmg = Math.floor(f.maxHp * 0.05);
            f.hp = Math.max(0, f.hp - poisonDmg);
            f.poisoned--;
            if (!silent) {
                log.push(`☠️ ${f.name} 中毒损失 ${poisonDmg} 点体力`);
            }
            if (f.hp <= 0) {
                state.removeFighter(f.name);
                if (!silent) log.push(` → 被毒倒!`);
            }
        }
    }
}

function triggerTurnStartPassives(attacker, state, silent, log) {
    for (const passive of attacker.skills.passives) {
        if (passive.trigger === "onTurnStart" && checkSkillTrigger(passive, state.rng)) {
            if (!silent) log.push(`✨ ${attacker.name} 触发 ${passive.name}`);
            if (passive.id === "shield") {
                attacker.shield = (attacker.shield || 0) + Math.floor(attacker.maxHp * 0.1);
            }
        }
    }
}

// ========== 辅助技能处理 ==========
function useSupportSkill(attacker, state, silent, log) {
    const supportSkill = attacker.skills.supports[Math.floor(state.rng() * attacker.skills.supports.length)];
    if (!checkSkillTrigger(supportSkill, state.rng)) return false;
    
    if (!silent) log.push(`🔮 ${attacker.name} 使用 ${supportSkill.name}`);
    
    if (supportSkill.id === "heal") {
        const allies = state.getAllies(attacker);
        const healTarget = allies.length > 0 ? 
            (state.rng() < 0.5 ? attacker : allies[Math.floor(state.rng() * allies.length)]) : 
            attacker;
        const healAmount = Math.floor(attacker.mag * 1.5);
        healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + healAmount);
        if (!silent) log.push(` → ${healTarget.name} 回复 ${healAmount}`);
    } else if (supportSkill.id === "haste") {
        attacker.buffs.spd = 3;
        if (!silent) log.push(` → 速度上升`);
    } else if (supportSkill.id === "iron_wall") {
        attacker.buffs.def = 2;
        attacker.buffs.res = 2;
        if (!silent) log.push(` → 防御上升`);
    } else if (supportSkill.id === "focus") {
        attacker.buffs.atk = 3;
        if (!silent) log.push(` → 攻击上升`);
    } else if (supportSkill.id === "charge") {
        attacker.charged = 1;
        if (!silent) log.push(` → 蓄力`);
    }
    return true;
}

// ========== 攻击技能处理 ==========
function calculateDamage(attacker, target, skill) {
    const power = skill.basePower / 100;
    let derdmg, objdmg, def;
    
    if (skill.attr === "magical") {
        derdmg = attacker.mag * 0.4 * power;
        objdmg = attacker.mag * 0.6 * power;
        def = target.res * 0.6;
    } else {
        derdmg = attacker.atk * 0.4 * power;
        objdmg = attacker.atk * 0.6 * power;
        def = target.def * 0.6;
    }
    
    if (attacker.charged) {
        derdmg *= 3;
        objdmg *= 3;
        attacker.charged = 0;
    }
    
    let dmg = Math.floor(derdmg + Math.max(0, objdmg - def));
    
    if (target.shield > 0) {
        const absorbed = Math.min(target.shield, dmg);
        dmg -= absorbed;
        target.shield -= absorbed;
    }
    
    return Math.max(1, dmg);
}

function applySkillEffects(attacker, target, skill, dmg, state, silent, log) {
    if (skill.id === "drain_life") {
        const heal = Math.floor(dmg / 2);
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
        if (!silent) log.push(`，吸收 ${heal} 点体力`);
    }
    
    if (skill.id === "poison") {
        target.poisoned = 3;
        if (!silent) log.push(`，中毒`);
    }
    
    if (skill.id === "ice_bolt") {
        target.frozen = 1;
        if (!silent) log.push(`，冰冻`);
    }
    
    if (skill.id === "curse") {
        target.cursed = 3;
        if (!silent) log.push(`，诅咒`);
    }
    
    if (skill.id === "life_swap") {
        const temp = attacker.hp;
        attacker.hp = target.hp;
        target.hp = temp;
        if (!silent) log.push(`\n\t生命值互换`);
    }
    
    if (skill.id === "plague") {
        const percent = 50 + Math.floor(state.rng() * 50);
        const plagueDmg = Math.floor(target.hp * percent / 100);
        target.hp = Math.max(0, target.hp - plagueDmg);
        if (!silent) log.push(`\n\t瘟疫造成 ${plagueDmg} 点伤害 (${percent}%)`);
    }
}

function useAttackSkill(attacker, state, silent, log) {
    const enemies = state.getEnemies(attacker);
    if (enemies.length === 0) return;
    
    const target = enemies[Math.floor(state.rng() * enemies.length)];
    
    const attackSkill = attacker.skills.attacks.length > 0 ? 
        attacker.skills.attacks[Math.floor(state.rng() * attacker.skills.attacks.length)] : 
        getDefaultAttack(attacker);
    
    const useSkill = checkSkillTrigger(attackSkill, state.rng);
    const skill = useSkill ? attackSkill : getDefaultAttack(attacker);
    
    // 命中判定
    const hitBase = 70 + (attacker.agi - target.agi) * 0.5;
    const hitRate = Math.min(95, Math.max(5, hitBase));
    const hitRoll = Math.floor(state.rng() * 100);
    
    if (!silent) {
        let attackStr = `${attacker.name} 对 ${target.name} 发动攻击`;
        if (useSkill) attackStr += ` (${skill.name})`;
        log.push(attackStr);
    }
    
    if (hitRoll >= hitRate) {
        if (!silent) log.push(`\t${target.name} 闪避了攻击`);
        return;
    }
    
    const dmg = calculateDamage(attacker, target, skill);
    target.hp = Math.max(0, target.hp - dmg);
    
    if (!silent) {
        log.push(`\t${target.name} 受到 ${dmg} 点伤害`);
    }
    
    applySkillEffects(attacker, target, skill, dmg, state, silent, log);
    
    // 检查目标死亡
    if (target.hp <= 0) {
        state.removeFighter(target.name);
        if (!silent) log.push(`${target.name} 被击倒了!`);
        
        // 击杀被动
        for (const passive of attacker.skills.passives) {
            if (passive.trigger === "onKill" && checkSkillTrigger(passive, state.rng)) {
                if (!silent) log.push(`✨ ${attacker.name} 触发 ${passive.name}`);
            }
        }
    }
    
    // 反击
    if (target.alive) {
        for (const passive of target.skills.passives) {
            if (passive.trigger === "afterDamage" && passive.id === "counter" && checkSkillTrigger(passive, state.rng)) {
                const counterDmg = Math.floor(target.atk * 0.5);
                attacker.hp = Math.max(0, attacker.hp - counterDmg);
                if (!silent) log.push(`\t${target.name} 反击造成 ${counterDmg} 点伤害`);
                if (attacker.hp <= 0) {
                    state.removeFighter(attacker.name);
                    if (!silent) log.push(`${attacker.name} 被反击击倒!`);
                }
            }
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
        
        // 更新行动条
        updateActionBars(state);
        
        // 获取下一个攻击者
        const attacker = getNextAttacker(state);
        if (!attacker) continue;
        
        // 回合开始被动
        triggerTurnStartPassives(attacker, state, silent, log);
        
        // 选择行动
        const useSupport = attacker.skills.supports.length > 0 && state.rng() < 0.3;
        
        if (useSupport) {
            useSupportSkill(attacker, state, silent, log);
        } else {
            useAttackSkill(attacker, state, silent, log);
        }
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
