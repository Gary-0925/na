import { sha256 } from "../utils/sha256.js";
import { createBattleRNG } from "../utils/random.js";
import { generateStats } from "./stats.js";
import { generateSkills, checkSkillTrigger } from "./skills.js";

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
            f.shield = 0;
            this.actionTimers.set(f.name, Math.random() * 50); // 随机初始进度
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
    
    getAliveTeams() {
        const aliveTeams = new Set();
        this.fighters.filter(f => this.alive.has(f.name)).forEach(f => aliveTeams.add(f.team));
        return aliveTeams;
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
                log += `\t  技能: ${f.skills.attack.name} / ${f.skills.support.name}\n`;
            });
        });
        log += `\n`;
    }

    let actionCount = 0;
    const maxActions = 500;

    while (state.getAliveTeams().size > 1 && actionCount < maxActions) {
        // 增加行动进度
        for (const f of fighters) {
            if (!state.alive.has(f.name)) continue;
            const old = state.actionTimers.get(f.name) || 0;
            const gain = 10 + f.spd * 0.5;
            state.actionTimers.set(f.name, old + gain);
        }

        // 找到可以行动的角色
        const ready = fighters.filter(f => 
            state.alive.has(f.name) && 
            state.actionTimers.get(f.name) >= 100
        );
        
        if (ready.length === 0) continue;

        // 按进度排序
        ready.sort((a, b) => state.actionTimers.get(b.name) - state.actionTimers.get(a.name));

        // 只处理第一个（避免同一轮多次行动）
        const attacker = ready[0];
        const overflow = state.actionTimers.get(attacker.name) - 100;
        state.actionTimers.set(attacker.name, Math.max(0, overflow));

        actionCount++;

        // 选择目标
        const targets = state.getAliveEnemies(attacker);
        if (targets.length === 0) break;
        
        const target = targets[Math.floor(rng() * targets.length)];
        if (!target) continue;

        // 命中判定
        const hitBase = 70 + (attacker.agi - target.agi) * 0.5;
        const hitRate = Math.min(95, Math.max(5, hitBase));
        const hitRoll = Math.floor(rng() * 100);

        if (!silent) {
            log += `\n${attacker.name} 对 ${target.name} 发动攻击`;
        }

        if (hitRoll >= hitRate) {
            if (!silent) log += `\n\t${target.name} 闪避了攻击`;
            continue;
        }

        // 伤害计算
        let derdmg = attacker.atk * 0.4;
        let objdmg = attacker.atk * 0.6;
        let def = target.def * 0.6;
        let effects = [];

        // 尝试使用技能
        const useSkill = rng() < attacker.skills.attack.proficiency / 100;
        
        if (useSkill) {
            const skill = attacker.skills.attack;
            if (skill.attr === "magical") {
                derdmg = attacker.mag * 0.4 * (skill.basePower / 100);
                objdmg = attacker.mag * 0.6 * (skill.basePower / 100);
                def = target.res * 0.6;
                effects.push(skill.name);
            } else {
                derdmg = attacker.atk * 0.4 * (skill.basePower / 100);
                objdmg = attacker.atk * 0.6 * (skill.basePower / 100);
                effects.push(skill.name);
            }
        } else {
            // 普通攻击
            if (rng() * 100 < Math.min(60, Math.max(0, 20 + (attacker.mag - attacker.atk) * 0.5))) {
                derdmg = attacker.mag * 0.4;
                objdmg = attacker.mag * 0.6;
                def = target.res * 0.6;
                effects.push("🔮魔法");
            }
        }

        // 暴击判定
        if (rng() * 100 < Math.min(60, Math.max(5, 10 + (attacker.agi - target.agi) * 0.2))) {
            derdmg = derdmg * 2;
            objdmg = objdmg * 1.5;
            effects.push("💥暴击");
        }

        // 偷袭判定
        if (rng() * 100 < Math.min(40, Math.max(0, 15 + (attacker.int - target.int) * 0.5))) {
            def = def * 0.2;
            effects.push("✨偷袭");
        }

        let dmg = Math.floor(derdmg + Math.max(0, objdmg - def));
        dmg = Math.max(1, dmg);
        target.hp = Math.max(0, target.hp - dmg);

        if (!silent) {
            if (effects.length > 0) log += `\n\t${effects.join(" ")}`;
            log += `\n\t${target.name} 受到了 ${dmg} 点伤害 (HP: ${target.hp}/${target.maxHp})`;
        }

        if (target.hp <= 0) {
            state.alive.delete(target.name);
            state.deadSet.add(target.name);
            if (!silent) log += `\n☠️ ${target.name} 被击倒了!`;
        }
    }

    const winnerTeamIdx = state.getAliveTeams().values().next().value;
    const winnerTeam = teams[winnerTeamIdx];
    const winner = fighters.find(f => f.team === winnerTeamIdx);

    if (!silent) {
        log += `\n\n🏆 胜者队伍: 队伍${winnerTeamIdx + 1} (${winnerTeam.members.join(", ")})`;
    }

    if (returnResults) {
        return { winner: winner ? winner.name : null, winnerTeam: winnerTeamIdx, fighters };
    }
    return { log, winner, winnerTeam: winnerTeamIdx, fighters, deadSet: state.deadSet, teams };
}