import { sha256 } from "../utils/sha256.js";
import { generateRandomName } from "../utils/random.js";
import { generateStats } from "./stats.js";
import { battle } from "./battle.js";

export async function powerTest(targetName) {
    const targetHash = await sha256(targetName);
    const target = generateStats(targetName, targetHash);
    target.maxHp = target.hp;

    const testNames1 = [], testNames2 = [], testNames3 = [];
    for (let i = 0; i < 5000; i++) {
        testNames1.push(await generateRandomName(i));
        testNames2.push(await generateRandomName(i * 123));
        testNames3.push(await generateRandomName(i * 456));
    }

    let wins = 0;
    let log = `测试模式\n`;
    log += `\t${targetName}: 血${target.hp} 攻${target.atk} 防${target.def} 速${target.spd} 敏${target.agi} 魔${target.mag} 抗${target.res} 智${target.int}\n`;
    log += `正在与 5000 个随机单人队或三人队对战...\n\n`;

    const batchSize = 50;
    const totalBatches = Math.ceil(testNames1.length / batchSize);

    for (let batch = 0; batch < totalBatches; batch++) {
        const promises = [];
        const start = batch * batchSize;
        const end = Math.min(start + batchSize, testNames1.length);

        for (let i = start; i < end; i++) {
            const enemyName = testNames1[i];
            if (i % 2 === 0) {
                promises.push(
                    battle(
                        [{ members: [targetName] }, { members: [enemyName] }], 
                        { silent: true, returnResults: true }
                    ).catch(err => {
                        console.error(`对战 ${i} 出错:`, err);
                        return { winnerTeam: -1 };
                    })
                );
            } else {
                promises.push(
                    battle(
                        [{ members: [targetName] }, { members: [enemyName, testNames2[i], testNames3[i]] }], 
                        { silent: true, returnResults: true }
                    ).catch(err => {
                        console.error(`对战 ${i} 出错:`, err);
                        return { winnerTeam: -1 };
                    })
                );
            }
        }

        const results = await Promise.all(promises);
        results.forEach((result) => {
            if (result && result.winnerTeam === 0) {
                wins++;
            }
        });

        const tested = end;
        const currentRate = (wins / tested * 100).toFixed(1);
        log += `第 ${batch + 1} 组 (${tested}/${testNames1.length}): ${wins}/${tested} (${currentRate}%)\n`;
        
        // 实时更新日志
        const logDiv = document.getElementById("logDiv");
        if (logDiv) {
            logDiv.textContent = log;
        }
        
        // 让出主线程，避免卡死
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    const finalRate = (wins / 5000 * 100).toFixed(1);
    log += `\n🏆 强度: ${2 * wins}/10000 (${finalRate}%)\n`;

    return { log, fighters: [target], deadSet: new Set(), winner: null };
}