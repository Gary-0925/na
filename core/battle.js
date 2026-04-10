import { sha256 } from "../utils/sha256.js";
import { createBattleRNG } from "../utils/random.js";
import { generateStats } from "./stats.js";
import { generateSkills } from "./skills.js";

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
        fighters.push(fighter);
    }

    const rng = await createBattleRNG(allNames);
    
    let log = "";
    if (!silent) {
        log = `SHA256 名字竞技场\n`;
        teams.forEach((team, idx) => {
            log += `队伍${idx + 1}: ${team.members.join(", ")}\n`;
            const teamFighters = fighters.filter(f => f.team === idx);
            teamFighters.forEach(f => {
                log += `  ${f.name}: 血${f.hp} 攻${f.atk} 防${f.def} 速${f.spd} 敏${f.agi} 魔${f.mag} 抗${f.res}\n`;
                if (f.skills.attack) {
                    log += `    技能: ${f.skills.attack.name} (${f.skills.attack.proficiency}%)\n`;
                }
            });
        });
        log += `\n`;
    }

    const alive = new Set(fighters.map(f => f.name));
    const deadSet = new Set();
    
    // 初始化行动条 - 随机起始位置
    const actionBars = new Map();
    fighters.forEach(f => {
        actionBars.set(f.name, rng() * 50);
    });
    
    let actionCount = 0;
    const maxActions = 500;
    
    // 辅助函数：获取存活队伍
    const getAliveTeams = () => {
        const teams = new Set();
        fighters.filter(f => alive.has(f.name)).forEach(f => teams.add(f.team));
        return teams;
    };

    // 主循环
    while (alive.size > 1 && getAliveTeams().size > 1 && actionCount < maxActions) {
        
        // 1. 所有存活者增加行动条
        for (const f of fighters) {
            if (!alive.has(f.name)) continue;
            const oldBar = actionBars.get(f.name) || 0;
            // 速度越快，增加越多
            const gain = 15 + f.spd * 0.3 + f.agi * 0.2;
            actionBars.set(f.name, oldBar + gain);
        }
        
        // 2. 找到行动条最高的存活者
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
        
        // 3. 如果最高行动条还没到100，继续循环
        if (maxBar < 100) {
            continue;
        }
        
        // 4. 扣除行动条
        actionBars.set(attacker.name, maxBar - 100);
        actionCount++;
        
        // 5. 选择目标
        const targets = fighters.filter(f => 
            alive.has(f.name) && f.team !== attacker.team
        );
        
        if (targets.length === 0) continue;
        
        const target = targets[Math.floor(rng() * targets.length)];
        if (!target) continue;
        
        // 6. 攻击
        const hitBase = 70 + (attacker.agi - target.agi) * 0.5;
        const hitRate = Math.min(95, Math.max(5, hitBase));
        const hitRoll = Math.floor(rng() * 100);
        
        if (!silent) {
            log += `\n${attacker.name} → ${target.name}`;
        }
        
        if (hitRoll >= hitRate) {
            if (!silent) log += ` 未命中`;
            continue;
        }
        
        // 伤害计算
        let derdmg = attacker.atk * 0.4;
        let objdmg = attacker.atk * 0.6;
        let def = target.def * 0.6;
        let effects = [];
        
        // 技能判定
        const skill = attacker.skills.attack;
        if (skill && rng() < skill.proficiency / 100) {
            const power = skill.basePower / 100;
            if (skill.attr === "magical") {
                derdmg = attacker.mag * 0.4 * power;
                objdmg = attacker.mag * 0.6 * power;
                def = target.res * 0.6;
            } else {
                derdmg = attacker.atk * 0.4 * power;
                objdmg = attacker.atk * 0.6 * power;
            }
            effects.push(skill.name);
        } else {
            // 普通攻击可能变魔法
            if (rng() < 0.2 + (attacker.mag - attacker.atk) / 200) {
                derdmg = attacker.mag * 0.4;
                objdmg = attacker.mag * 0.6;
                def = target.res * 0.6;
                effects.push("🔮魔法");
            }
        }
        
        // 暴击
        if (rng() < 0.08 + attacker.agi / 500) {
            derdmg *= 2;
            objdmg *= 1.5;
            effects.push("💥暴击");
        }
        
        // 偷袭
        if (rng() < 0.15 + (attacker.int - target.int) / 200) {
            def *= 0.2;
            effects.push("✨偷袭");
        }
        
        let dmg = Math.floor(derdmg + Math.max(0, objdmg - def));
        dmg = Math.max(1, dmg);
        target.hp = Math.max(0, target.hp - dmg);
        
        if (!silent) {
            const effectsStr = effects.length > 0 ? ` [${effects.join(" ")}]` : "";
            log += ` ${dmg}伤害${effectsStr}`;
        }
        
        // 检查死亡
        if (target.hp <= 0) {
            alive.delete(target.name);
            deadSet.add(target.name);
            target.alive = false;
            if (!silent) log += ` → ${target.name}倒下!`;
        }
    }
    
    // 确定胜者
    const aliveFighters = fighters.filter(f => alive.has(f.name));
    const winnerTeamIdx = aliveFighters.length > 0 ? aliveFighters[0].team : 0;
    const winnerTeam = teams[winnerTeamIdx];
    const winner = aliveFighters.find(f => f.team === winnerTeamIdx);
    
    if (!silent) {
        log += `\n\n🏆 胜者: 队伍${winnerTeamIdx + 1} (${winnerTeam.members.join(", ")})`;
    }
    
    if (returnResults) {
        return { winner: winner ? winner.name : null, winnerTeam: winnerTeamIdx, fighters };
    }
    return { log, winner, winnerTeam: winnerTeamIdx, fighters, deadSet, teams };
}
