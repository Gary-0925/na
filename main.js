import { battle } from "./core/battle.js";
import { powerTest } from "./core/powerTest.js";
import { renderFighters } from "./ui/render.js";

let winner = null;

async function startBattle() {
    const input = document.getElementById("namesInput").value;
    const lines = input.split("\n").filter(l => l.trim());

    const teams = lines
        .map((line) => {
            const members = line
                .split(/[,，]+/)
                .map((n) => n.trim())
                .filter((n) => n);
            return { members };
        })
        .filter((t) => t.members.length > 0);

    if (teams.length === 0) return;

    const allNames = teams.flatMap((t) => t.members);
    const uniqueNames = [...new Set(allNames)];

    let result;
    if (uniqueNames.length === 1) {
        result = await powerTest(uniqueNames[0]);
        document.querySelector(".mode-hint").textContent = "📊 当前为测试模式";
        renderFighters(result.fighters, result.deadSet || new Set(), null);
    } else {
        result = await battle(teams);
        document.querySelector(".mode-hint").textContent = `👥 当前为组队对战模式`;
        winner = result.winner;
        renderFighters(result.fighters, result.deadSet || new Set(), result.teams || teams);
    }

    document.getElementById("logDiv").textContent = result.log;
}

document.getElementById("fightBtn").addEventListener("click", startBattle);
setTimeout(startBattle, 100);