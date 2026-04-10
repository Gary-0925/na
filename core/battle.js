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
    if (!handler) {
        console.error(`技能 ${skill.id} 没有处理器`);
        return;
    }
    
    const result = handler(attacker, target, state);
    
    // 处理伤害
    if (result.results) {
        // 连击等多段攻击
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
    } else if (result.dmg !== undefined) {
        // 单段攻击
        target.hp = Math.max(0, target.hp - result.dmg);
        if (!silent) log.push(`\t${target.name} 受到 ${result.dmg} 点伤害`);
    }
    
    // 显示效果（在伤害之后）
    if (result.effects && result.effects.length > 0 && !silent) {
        log.push(`\t${result.effects.join(" ")}`);
    }
    
    // 检查目标死亡（单段攻击的情况）
    if (result.dmg !== undefined && !result.results) {
        if (target.hp <= 0) {
            state.removeFighter(target.name);
            if (!silent) log.push(`${target.name} 被击倒了!`);
            return;
        }
    }
    
    // 反击（目标还活着才能反击）
    if (target.alive) {
        for (const passive of target.skills.passives) {
            if (passive.trigger === "afterDamage" && passive.id === "counter" && checkSkillTrigger(passive, state.rng)) {
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
}
