export function renderFighters(fighters, deadSet, teams = null) {
    const div = document.getElementById("fightersDiv");
    let html = "";

    if (teams !== null) {
        teams.forEach((team, idx) => {
            const teamFighters = fighters.filter((f) => team.members.includes(f.name));
            if (teamFighters.length === 0) return;

            html += `<div class="team-group">`;
            html += `<div class="team-label">¶ÓÎé ${idx + 1} ${team.winner ? '<span class="winner-badge">? Ê¤Õß</span>' : ""}</div>`;

            teamFighters.forEach((f) => {
                const isDead = deadSet.has(f.name);
                const hpPercent = isDead ? 0 : (f.hp / f.maxHp) * 100;
                html += `<div class="card ${isDead ? "dead" : ""}">
                    <div class="name">${f.name}</div>
                    <div class="hp"><div class="hp-bar" style="width:${hpPercent}%"></div></div>
                    <div style="font-size:12px">HP ${isDead ? 0 : f.hp}/${f.maxHp}</div>
                    <div class="stats">
                        <div class="stat">¹¥<span>${f.atk}</span></div>
                        <div class="stat">·À<span>${f.def}</span></div>
                        <div class="stat">ËÙ<span>${f.spd}</span></div>
                        <div class="stat">Ãô<span>${f.agi}</span></div>
                        <div class="stat">Ä§<span>${f.mag}</span></div>
                        <div class="stat">¿¹<span>${f.res}</span></div>
                        <div class="stat">ÖÇ<span>${f.int}</span></div>
                        <div class="stat">Õ½Á¦<span>${f.total}</span></div>
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
                    <div class="stat">¹¥<span>${f.atk}</span></div>
                    <div class="stat">·À<span>${f.def}</span></div>
                    <div class="stat">ËÙ<span>${f.spd}</span></div>
                    <div class="stat">Ãô<span>${f.agi}</span></div>
                    <div class="stat">Ä§<span>${f.mag}</span></div>
                    <div class="stat">¿¹<span>${f.res}</span></div>
                    <div class="stat">ÖÇ<span>${f.int}</span></div>
                    <div class="stat">Õ½Á¦<span>${f.total}</span></div>
                </div>
            </div>`;
        });
    }

    div.innerHTML = html;
}