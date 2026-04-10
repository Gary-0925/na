export function renderFighters(fighters, deadSet, teams = null) {
    const div = document.getElementById("fightersDiv");
    let html = "";

    if (teams !== null) {
        teams.forEach((team, idx) => {
            const teamFighters = fighters.filter((f) => team.members.includes(f.name));
            if (teamFighters.length === 0) return;

            html += `<div class="team-group">`;
            html += `<div class="team-label">队伍 ${idx + 1} ${team.winner ? '<span class="winner-badge">🏆 胜者</span>' : ""}</div>`;

            teamFighters.forEach((f) => {
                const isDead = deadSet.has(f.name);
                const hpPercent = isDead ? 0 : (f.hp / f.maxHp) * 100;
                html += `<div class="card ${isDead ? "dead" : ""}">
                    <div class="name">${f.name}</div>
                    <div class="hp"><div class="hp-bar" style="width:${hpPercent}%"></div></div>
                    <div style="font-size:12px">HP ${isDead ? 0 : f.hp}/${f.maxHp}</div>
                    <div class="stats">
                        <div class="stat">攻<span>${f.atk}</span></div>
                        <div class="stat">防<span>${f.def}</span></div>
                        <div class="stat">速<span>${f.spd}</span></div>
                        <div class="stat">敏<span>${f.agi}</span></div>
                        <div class="stat">魔<span>${f.mag}</span></div>
                        <div class="stat">抗<span>${f.res}</span></div>
                        <div class="stat">智<span>${f.int}</span></div>
                        <div class="stat">战力<span>${f.total}</span></div>
                    </div>
                </div>`;
            });

            html += `</div>`;
        });
    } else {
        fighters.forEach((f) => {
            const isDead = deadSet.has(f.name);
            const hpPercent = isDead ? 0 : (f.hp / f.maxHp) * 100;
            html += `<div class="card ${isDead ? "dead" : ""}">
                <div class="name">${f.name}</div>
                <div class="hp"><div class="hp-bar" style="width:${hpPercent}%"></div></div>
                <div style="font-size:12px">HP ${isDead ? 0 : f.hp}/${f.maxHp}</div>
                <div class="stats">
                    <div class="stat">攻<span>${f.atk}</span></div>
                    <div class="stat">防<span>${f.def}</span></div>
                    <div class="stat">速<span>${f.spd}</span></div>
                    <div class="stat">敏<span>${f.agi}</span></div>
                    <div class="stat">魔<span>${f.mag}</span></div>
                    <div class="stat">抗<span>${f.res}</span></div>
                    <div class="stat">智<span>${f.int}</span></div>
                    <div class="stat">战力<span>${f.total}</span></div>
                </div>
            </div>`;
        });
    }

    div.innerHTML = html;
}