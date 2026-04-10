import { sha256 } from "../utils/sha256.js";
import { createBattleRNG } from "../utils/random.js";
import { generateStats } from "./stats.js";

export async function battle(teams, options = {}) {
    const { silent = false, returnResults = false } = options;

    const allNames = teams.flatMap((t) => t.members);

    const fighters = [];
    for (const name of allNames) {
        const hash = await sha256(name);
        const fighter = generateStats(name, hash);
        fighter.team = teams.findIndex((t) => t.members.includes(name));
        fighters.push(fighter);
    }

    fighters.forEach((f) => { f.maxHp = f.hp; });

    const rng = await createBattleRNG(allNames);

    let log = "";
    if (!silent) {
        log = `SHA256 名字竞技场\n`;
        teams.forEach((team, idx) => {
            log += `队伍${idx + 1} (${team.members.join(", ")})\n`;
            const teamFighters = fighters.filter((f) => f.team === idx);
            teamFighters.forEach((f) => {
                log += `\t${f.name}: 血${f.hp} 攻${f.atk} 防${f.def} 速${f.spd} 敏${f.agi} 魔${f.mag} 抗${f.res} 智${f.int}\n`;
            });
        });
    }

    const alive = new Set(fighters.map((f) => f.name));
    const deadSet = new Set();

    const getAliveTeams = () => {
        const aliveTeams = new Set();
        fighters.filter((f) => alive.has(f.name)).forEach((f) => aliveTeams.add(f.team));
        return aliveTeams;
    };

    const actionTimers = new Map();
    fighters.forEach((f) => actionTimers.set(f.name, f.spd * 1.5));

    let actionCount = 0;
    const maxActions = 5000;

    while (alive.size > 1 && actionCount < maxActions) {
        const aliveTeams = getAliveTeams();
        if (aliveTeams.size <= 1) break;

        for (const f of fighters) {
            if (!alive.has(f.name)) continue;
            const old = actionTimers.get(f.name);
            const gain = 5 + f.spd * 0.8;
            actionTimers.set(f.name, old + gain);
        }

        const ready = fighters.filter((f) => alive.has(f.name) && actionTimers.get(f.name) >= 100);
        if (ready.length === 0) continue;

        ready.sort((a, b) => actionTimers.get(b.name) - actionTimers.get(a.name));

        for (const attacker of ready) {
            if (!alive.has(attacker.name)) continue;

            const aliveTeams = getAliveTeams();
            if (aliveTeams.size <= 1) break;

            const overflow = actionTimers.get(attacker.name) - 100;
            actionTimers.set(attacker.name, Math.max(0, overflow));

            const targets = fighters.filter((f) => alive.has(f.name) && f.team !== attacker.team);
            if (targets.length === 0) break;

            const target = targets[Math.floor(rng() * targets.length)];

            const hitBase = 70 + (attacker.agi - target.agi) * 0.5;
            const hitRate = Math.min(95, Math.max(5, hitBase));
            const hitRoll = Math.floor(rng() * 100);

            actionCount++;

            if (!silent) log += `\n${attacker.name} 对 ${target.name} 发动攻击`;

            if (hitRoll >= hitRate) {
                if (!silent) log += `\n\t${target.name} 闪避了攻击\n`;
                continue;
            }

            let derdmg = attacker.atk * 0.4;
            let objdmg = attacker.atk * 0.6;
            let def = target.def * 0.6;
            let effects = [];

            if (rng() * 100 < Math.min(60, Math.max(0, 20 + (attacker.mag - attacker.atk) * 0.5))) {
                derdmg = attacker.mag * 0.4;
                objdmg = attacker.mag * 0.6;
                def = target.res * 0.6;
                if (!silent) effects.push("?魔法");
            }

            if (rng() * 100 < Math.min(40, Math.max(0, 15 + (attacker.int - target.int) * 0.5))) {
                def = def * 0.2;
                if (!silent) effects.push("?偷袭");
            }

            if (rng() * 100 < Math.min(60, Math.max(5, 10 + (attacker.agi - target.agi) * 0.2))) {
                derdmg = derdmg * 2;
                objdmg = objdmg * 1.5;
                def = def * 1.5;
                if (!silent) effects.push("?暴击");
            }

            let dmg = Math.floor(derdmg + Math.max(0, objdmg - def));
            dmg = Math.max(1, dmg);
            target.hp = Math.max(0, target.hp - dmg);

            if (!silent) {
                if (effects.length > 0) log += `\n\t${attacker.name} 发动了 ${effects.join(" ")} `;
                log += `\n\t${target.name} 受到了 ${dmg} 点伤害\n`;
            }

            if (target.hp <= 0) {
                alive.delete(target.name);
                deadSet.add(target.name);
                if (!silent) log += `\n${target.name} 被击倒了!\n`;
            }
        }
    }

    const winnerTeamIdx = getAliveTeams().values().next().value;
    const winnerTeam = teams[winnerTeamIdx];
    const winner = fighters.find((f) => f.team === winnerTeamIdx);

    if (!silent) {
        log += `\n? 胜者队伍: 队伍${winnerTeamIdx + 1} (${winnerTeam.members.join(", ")})`;
    }

    if (returnResults) {
        return { winner: winner ? winner.name : null, winnerTeam: winnerTeamIdx, fighters };
    }
    return { log, winner, winnerTeam: winnerTeamIdx, fighters, deadSet, teams };
}