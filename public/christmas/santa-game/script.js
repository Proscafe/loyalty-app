let status = "waiting";
let lastTimestamp;
let santaX;
let santaY;
let sceneOffset;
let score = 0;
let scoreSubmitted = false;
let platforms = [];
let sticks = [];
let trees = [];
let clouds = [];

const config = {
  canvasWidth: 375,
  canvasHeight: 375,
  platformHeight: 100,
  santaDistanceFromEdge: 10,
  paddingX: 100,
  perfectAreaSize: 10,
  backgroundSpeedMultiplier: 0.2,
  speed: 4,
  santaWidth: 17,
  santaHeight: 30
};

const colours = {
  lightBg: "#62AFB9",
  medBg: "#182757",
  darkBg: "#0D5B66",
  lightHill: "#E9E9E9",
  medHill: "#34A65F",
  darkHill: "#07133A",
  platform: "#9B4546",
  platformTop: "#620E0E",
  em: "#CC231E",
  skin: "#CF6D60"
};

const hills = [
  {
    baseHeight: 120,
    amplitude: 20,
    stretch: 0.5,
    colour: colours.lightHill
  },
  {
    baseHeight: 100,
    amplitude: 10,
    stretch: 1,
    colour: colours.medHill
  },
  {
    baseHeight: 70,
    amplitude: 20,
    stretch: 0.5,
    colour: colours.darkHill
  }
];

// Festive HUD is live DOM: the score updates on every successful landing.
const scoreElement = createElementStyle("div");
scoreElement.className = "christmas-scoreboard christmas-scoreboard-with-logo";

// Keep the white PRO'S mark, one gold star and live score aligned.
const scoreBrandLogo = document.createElement("img");
scoreBrandLogo.className = "christmas-score-logo";
scoreBrandLogo.src = "/pros-logo-basic.png";
scoreBrandLogo.alt = "PRO'S";
scoreBrandLogo.draggable = false;
scoreElement.appendChild(scoreBrandLogo);

const scoreLeftStar = document.createElement("span");
scoreLeftStar.className = "christmas-score-star";
scoreLeftStar.textContent = "★";
scoreLeftStar.setAttribute("aria-hidden", "true");
scoreElement.appendChild(scoreLeftStar);

const scoreValueElement = document.createElement("span");
scoreValueElement.className = "christmas-score-number";
scoreValueElement.textContent = "0";
scoreElement.appendChild(scoreValueElement);

scoreElement.setAttribute("aria-label", "Current game score");
scoreElement.setAttribute("aria-live", "polite");

const canvas = createElementStyle("canvas");
const introductionElement = createElementStyle(
  "div",
  null,
  '<span class="candy-instructions-text">Hold to grow the bridge.<br>Release to cross.<br>Match the gap or Santa falls!</span>'
);
introductionElement.className = "christmas-instructions";
introductionElement.setAttribute("aria-label", "Game instructions");
const perfectElement = createElementStyle(
  "div",
  "position:absolute;top:32%;opacity:0;transition:opacity 2s",
  "Double Score"
);
const restartButton = createElementStyle(
  "button",
  "position:absolute;display:none;cursor:pointer;top:34%;",
  "PLAY AGAIN!"
);
restartButton.className = "christmas-game-restart";
restartButton.setAttribute("aria-label", "Play Santa game again");

// Adding snow
// for (let i = 0; i <= 30; i++) {
//   createElementStyle(
//     "i",
//     `font-size: ${3 * Math.random()}em;left: ${
//       100 * Math.random()
//     }%; animation-delay: ${10 * Math.random()}s, ${2 * Math.random()}s`,
//     "."
//   );
// }

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const ctx = canvas.getContext("2d");

Array.prototype.last = function () {
  return this[this.length - 1];
};

Math.sinus = function (degree) {
  return Math.sin((degree / 180) * Math.PI);
};

window.addEventListener("keydown", function (event) {
  if (event.key == " " && !document.querySelector("#santa-leaderboard-overlay:not([hidden])")) {
    event.preventDefault();
    resetGame();
    return;
  }
});

["mousedown", "touchstart"].forEach(function (evt) {
  window.addEventListener(evt, function (event) {
    if (event.target instanceof Element && event.target.closest("button, a, [data-game-ui]")) return;
    if (document.querySelector("#santa-leaderboard-overlay:not([hidden])")) return;
    if (status == "waiting") {
      lastTimestamp = undefined;
      introductionElement.style.opacity = 0;
      status = "stretching";
      window.requestAnimationFrame(animate);
    }
  });
});

["mouseup", "touchend"].forEach(function (evt) {
  window.addEventListener(evt, function (event) {
    if (status == "stretching") {
      status = "turning";
    }
  });
});

window.addEventListener("resize", function (event) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  draw();
});

restartButton.addEventListener("click", function (event) {
  event.preventDefault();
  resetGame();
  restartButton.style.display = "none";
});

window.requestAnimationFrame(animate);

resetGame();

function resetGame() {
  status = "waiting";
  lastTimestamp = undefined;
  sceneOffset = 0;
  score = 0;
  scoreSubmitted = false;
  introductionElement.style.opacity = 1;
  perfectElement.style.opacity = 0;
  restartButton.style.display = "none";
  scoreValueElement.textContent = String(score);
  platforms = [{ x: 50, w: 50 }];
  santaX = platforms[0].x + platforms[0].w - config.santaDistanceFromEdge;
  santaY = 0;
  sticks = [{ x: platforms[0].x + platforms[0].w, length: 0, rotation: 0 }];
  trees = [];
  clouds = [];

  for (let i = 0; i <= 20; i++) {
    if (i <= 3) generatePlatform();
    generateTree();
    generateCloud();
  }

  draw();
}

function generateCloud() {
  const minimumGap = 60;
  const maximumGap = 300;

  const lastCloud = clouds[clouds.length - 1];
  let furthestX = lastCloud ? lastCloud.x : 0;

  const x =
    furthestX +
    minimumGap +
    Math.floor(Math.random() * (maximumGap - minimumGap));

  const y =
    minimumGap +
    Math.floor(Math.random() * (maximumGap - minimumGap)) -
    window.innerHeight / 1.2;

  const w = Math.floor(Math.random() * 15 + 15);
  clouds.push({ x, y, w });
}

function generateTree() {
  const minimumGap = 30;
  const maximumGap = 150;

  const lastTree = trees[trees.length - 1];
  let furthestX = lastTree ? lastTree.x : 0;

  const x =
    furthestX +
    minimumGap +
    Math.floor(Math.random() * (maximumGap - minimumGap));

  const treeColors = [colours.lightHill, colours.medBg, colours.medHill];
  const color = treeColors[Math.floor(Math.random() * 3)];

  trees.push({ x, color });
}

function generatePlatform() {
  const minimumGap = 40;
  const maximumGap = 200;
  const minimumWidth = 20;
  const maximumWidth = 100;

  const lastPlatform = platforms[platforms.length - 1];
  let furthestX = lastPlatform.x + lastPlatform.w;

  const x =
    furthestX +
    minimumGap +
    Math.floor(Math.random() * (maximumGap - minimumGap));
  const w =
    minimumWidth + Math.floor(Math.random() * (maximumWidth - minimumWidth));

  platforms.push({ x, w });
}

function animate(timestamp) {
  if (!lastTimestamp) {
    lastTimestamp = timestamp;
    window.requestAnimationFrame(animate);
    return;
  }

  switch (status) {
    case "waiting":
      return;
    case "stretching": {
      sticks.last().length += (timestamp - lastTimestamp) / config.speed;
      break;
    }
    case "turning": {
      sticks.last().rotation += (timestamp - lastTimestamp) / config.speed;

      if (sticks.last().rotation > 90) {
        sticks.last().rotation = 90;

        const [nextPlatform, perfectHit] = thePlatformTheStickHits();
        if (nextPlatform) {
          score += perfectHit ? 2 : 1;
          scoreValueElement.textContent = String(score);

          if (perfectHit) {
            perfectElement.style.opacity = 1;
            setTimeout(() => (perfectElement.style.opacity = 0), 1000);
          }

          generatePlatform();
          generateTree();
          generateTree();

          generateCloud();
          generateCloud();
        }

        status = "walking";
      }
      break;
    }
    case "walking": {
      santaX += (timestamp - lastTimestamp) / config.speed;

      const [nextPlatform] = thePlatformTheStickHits();
      if (nextPlatform) {
        const maxSantaX =
          nextPlatform.x + nextPlatform.w - config.santaDistanceFromEdge;
        if (santaX > maxSantaX) {
          santaX = maxSantaX;
          status = "transitioning";
        }
      } else {
        const maxSantaX =
          sticks.last().x + sticks.last().length + config.santaWidth;
        if (santaX > maxSantaX) {
          santaX = maxSantaX;
          status = "falling";
        }
      }
      break;
    }
    case "transitioning": {
      sceneOffset += (timestamp - lastTimestamp) / (config.speed / 2);

      const [nextPlatform] = thePlatformTheStickHits();
      if (sceneOffset > nextPlatform.x + nextPlatform.w - config.paddingX) {
        sticks.push({
          x: nextPlatform.x + nextPlatform.w,
          length: 0,
          rotation: 0
        });
        status = "waiting";
      }
      break;
    }
    case "falling": {
      if (sticks.last().rotation < 180)
        sticks.last().rotation += (timestamp - lastTimestamp) / config.speed;

      santaY += (timestamp - lastTimestamp) / (config.speed / 2);
      const maxSantaY =
        config.platformHeight +
        100 +
        (window.innerHeight - config.canvasHeight) / 2;
      if (santaY > maxSantaY) {
        restartButton.style.display = "block";
        if (!scoreSubmitted) { scoreSubmitted = true; void submitScore(score); }
        return;
      }
      break;
    }
    default:
      throw Error("Wrong status");
  }

  draw();
  window.requestAnimationFrame(animate);

  lastTimestamp = timestamp;
}

function thePlatformTheStickHits() {
  if (sticks.last().rotation != 90)
    throw Error(`Stick is ${sticks.last().rotation}°`);
  const stickFarX = sticks.last().x + sticks.last().length;

  const platformTheStickHits = platforms.find(
    (platform) => platform.x < stickFarX && stickFarX < platform.x + platform.w
  );

  if (
    platformTheStickHits &&
    platformTheStickHits.x +
      platformTheStickHits.w / 2 -
      config.perfectAreaSize / 2 <
      stickFarX &&
    stickFarX <
      platformTheStickHits.x +
        platformTheStickHits.w / 2 +
        config.perfectAreaSize / 2
  )
    return [platformTheStickHits, true];

  return [platformTheStickHits, false];
}

function draw() {
  ctx.save();
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  drawBackground();
  ctx.translate(
    (window.innerWidth - config.canvasWidth) / 2 - sceneOffset,
    (window.innerHeight - config.canvasHeight) / 2
  );

  drawPlatforms();
  drawSanta();
  drawSticks();

  ctx.restore();
}

function drawPlatforms() {
  platforms.forEach(({ x, w }) => {
    let newX = x + 3;
    let newW = w - 6;
    let platformHeight =
      config.platformHeight + (window.innerHeight - config.canvasHeight) / 2;
    ctx.fillStyle = colours.platform;
    ctx.fillRect(
      newX,
      config.canvasHeight - config.platformHeight,
      newW,
      platformHeight
    );

    for (let i = 1; i <= platformHeight / 10; ++i) {
      let yGap = config.canvasHeight - config.platformHeight + i * 10;
      ctx.moveTo(newX, yGap);
      ctx.lineTo(newX + newW, yGap);
      let xGap = i % 2 ? 0 : 10;
      for (let j = 1; j < newW / 30; ++j) {
        let x = j * 20 + xGap;
        ctx.moveTo(newX + x, yGap);
        ctx.lineTo(newX + x, yGap + 10);
      }
      ctx.strokeStyle = colours.platformTop;
      ctx.stroke();
    }

    ctx.fillStyle = colours.platformTop;
    ctx.fillRect(x, config.canvasHeight - config.platformHeight, w, 10);

    if (sticks.last().x < x) {
      ctx.fillStyle = "white";
      ctx.fillRect(
        x + w / 2 - config.perfectAreaSize / 2,
        config.canvasHeight - config.platformHeight,
        config.perfectAreaSize,
        config.perfectAreaSize
      );
    }
  });
}

function drawSanta() {
  // Santa is drawn as a small vector character so he stays sharp on mobile.
  // Center him on santaX; keep both boots at the chimney's landing height.
  ctx.save();
  ctx.translate(
    santaX,
    santaY + config.canvasHeight - config.platformHeight - config.santaHeight / 2
  );

  const walking = status === "walking" || status === "stretching";
  const stride = walking ? Math.sin(Date.now() / 95) * 2.3 : 0;

  function oval(x, y, rx, ry, color) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  function strokeLine(points, width, color) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  // Rounded black boots and swinging trouser legs.
  ctx.fillStyle = "#25313d";
  ctx.fillRect(-9, 7 + stride, 7, 5);
  ctx.fillRect(2, 7 - stride, 7, 5);
  oval(-7, 13 + stride, 6, 3.2, "#172633");
  oval(7, 13 - stride, 6, 3.2, "#172633");

  // Red coat, gold buckle and soft white trim.
  oval(0, -1, 12, 13.5, "#b41f24");
  oval(-3, -3, 6, 10, "#ed3330");
  strokeLine([[-11, 8], [11, 8]], 4, "#fbf5e7");
  ctx.fillStyle = "#25272c";
  ctx.fillRect(-11, 2, 22, 4);
  ctx.fillStyle = "#f2ca5b";
  ctx.fillRect(-3, 1, 6, 6);
  ctx.fillStyle = "#1c242c";
  ctx.fillRect(-1.5, 2.5, 3, 3);

  // Mittened arms, one extended as he balances across the cane.
  strokeLine([[-9, -8], [-15, -2]], 6, "#cf2928");
  strokeLine([[10, -8], [15, -5]], 6, "#d22a2a");
  oval(-16, -1, 4.4, 4, "#fff6e9");
  oval(16, -4, 4.4, 4, "#fff6e9");
  oval(-17, 0, 3.5, 3.1, "#26343d");
  oval(17, -4, 3.5, 3.1, "#26343d");

  // Face and little rosy cheeks.
  oval(0, -17, 10, 10, "#ffd0a6");
  oval(-7, -15, 2.9, 2.2, "#f59f8b");
  oval(7, -15, 2.9, 2.2, "#f59f8b");

  // Fluffy scalloped beard and moustache, with a visible smiling face.
  oval(0, -10.5, 8.5, 8.5, "#fff8eb");
  oval(-6.5, -9, 4.4, 5.5, "#fff8eb");
  oval(6.5, -9, 4.4, 5.5, "#fff8eb");
  oval(0, -5, 4.2, 4.4, "#fff8eb");
  oval(-4.2, -14.2, 4.4, 2.4, "#ffffff");
  oval(4.2, -14.2, 4.4, 2.4, "#ffffff");
  oval(0, -16, 2.8, 2.3, "#ef9e87");

  // Friendly bright eyes and a happy smile.
  oval(-3.5, -20.2, 1.15, 1.4, "#202b35");
  oval(3.5, -20.2, 1.15, 1.4, "#202b35");
  ctx.beginPath();
  ctx.arc(0, -12.8, 2.25, 0.12 * Math.PI, 0.88 * Math.PI);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "#a64c49";
  ctx.stroke();

  // Oversized slouched Santa hat and bright pom-pom.
  ctx.beginPath();
  ctx.moveTo(-11, -26);
  ctx.quadraticCurveTo(-8, -39, 1, -39);
  ctx.quadraticCurveTo(11, -39, 15, -30);
  ctx.quadraticCurveTo(19, -25, 23, -29);
  ctx.quadraticCurveTo(21, -19, 14, -23);
  ctx.lineTo(9, -27);
  ctx.closePath();
  ctx.fillStyle = "#e8332f";
  ctx.fill();
  strokeLine([[-10, -26], [10, -26]], 5, "#fffaf0");
  oval(22, -27, 5.1, 5.1, "#fffaf0");
  oval(20.8, -28.3, 2.1, 1.3, "#ffffff");

  ctx.restore();
}

function drawSticks() {
  sticks.forEach((stick) => {
    ctx.save();

    ctx.translate(stick.x, config.canvasHeight - config.platformHeight);
    ctx.rotate((Math.PI / 180) * stick.rotation);

    ctx.beginPath();
    ctx.lineWidth = 4;
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -stick.length);

    ctx.strokeStyle = ctx.createPattern(createCandyPattern(), "repeat");
    ctx.stroke();

    ctx.restore();
  });
}

function drawBackground() {
  var gradient = ctx.createRadialGradient(
    window.innerWidth / 2,
    window.innerHeight / 2,
    0,
    window.innerHeight / 2,
    window.innerWidth / 2,
    window.innerWidth
  );
  gradient.addColorStop(0, colours.lightBg);
  gradient.addColorStop(1, colours.darkBg);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  hills.forEach((hill) =>
    drawHill(hill.baseHeight, hill.amplitude, hill.stretch, hill.colour)
  );
  trees.forEach((tree) => drawTree(tree.x, tree.color));
  clouds.forEach((cloud) => drawCloud(cloud.x, cloud.y, cloud.w));
}

function drawHill(baseHeight, amplitude, stretch, color) {
  ctx.beginPath();
  ctx.moveTo(0, window.innerHeight);
  ctx.lineTo(0, getHillY(0, baseHeight, amplitude, stretch));
  for (let i = 0; i < window.innerWidth; i++) {
    ctx.lineTo(i, getHillY(i, baseHeight, amplitude, stretch));
  }
  ctx.lineTo(window.innerWidth, window.innerHeight);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawTree(x, color) {
  ctx.save();
  ctx.translate(
    (-sceneOffset * config.backgroundSpeedMultiplier + x) * hills[1].stretch,
    getTreeY(x, hills[1].baseHeight, hills[1].amplitude)
  );

  const treeTrunkHeight = 15;
  const treeTrunkWidth = 10;
  const treeCrownHeight = 60;
  const treeCrownWidth = 30;

  // Draw trunk
  ctx.fillStyle = colours.darkHill;
  ctx.fillRect(
    -treeTrunkWidth / 2,
    -treeTrunkHeight,
    treeTrunkWidth,
    treeTrunkHeight
  );

  // Draw crown
  ctx.beginPath();

  ctx.moveTo(-treeCrownWidth / 2, -treeTrunkHeight * 3);
  ctx.lineTo(0, -(treeTrunkHeight + treeCrownHeight));
  ctx.lineTo(treeCrownWidth / 2, -treeTrunkHeight * 3);

  ctx.moveTo(-treeCrownWidth / 2, -treeTrunkHeight * 2);
  ctx.lineTo(0, -(treeTrunkHeight / 2 + treeCrownHeight));
  ctx.lineTo(treeCrownWidth / 2, -treeTrunkHeight * 2);

  ctx.moveTo(-treeCrownWidth / 2, -treeTrunkHeight);
  ctx.lineTo(0, -(treeTrunkHeight + treeCrownHeight / 2));
  ctx.lineTo(treeCrownWidth / 2, -treeTrunkHeight);

  ctx.fillStyle = color;
  ctx.fill();

  ctx.restore();
}

function drawCloud(x, y, width) {
  ctx.save();
  ctx.translate(
    (-sceneOffset * config.backgroundSpeedMultiplier + x) * hills[1].stretch,
    getTreeY(x, hills[1].baseHeight, hills[1].amplitude)
  );

  const height = width * 1.5;
  ctx.beginPath();
  ctx.arc(x, y, width, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(x + height, y - width, height, Math.PI * 1, Math.PI * 2);
  ctx.arc(x + height * 2, y - width, height, Math.PI * 1.2, Math.PI);
  ctx.arc(x + width * 3, y, width, Math.PI * 1.5, Math.PI * 0.5);
  ctx.moveTo(x + width * 3, y + width);
  ctx.lineTo(x, y + width);
  ctx.fillStyle = "rgba(255, 255, 255, .3)";
  ctx.fill();

  ctx.restore();
}

function createCandyPattern() {
  const patternCanvas = document.createElement("canvas");
  const pctx = patternCanvas.getContext("2d");

  const max = 15;
  let i = 0;
  let x = 0;
  let z = 90;

  while (i < max) {
    pctx.beginPath();
    pctx.moveTo(0, x);
    pctx.lineTo(0, z);
    pctx.lineWidth = 24;
    pctx.strokeStyle = "red";
    pctx.stroke();

    pctx.beginPath();
    pctx.moveTo(0, x + 24);
    pctx.lineTo(0, z + 24);
    pctx.lineWidth = 24;
    pctx.strokeStyle = "white";
    pctx.stroke();

    x += 48;
    z += 48;
    i++;
  }

  return patternCanvas;
}

function getHillY(windowX, baseHeight, amplitude, stretch) {
  const sineBaseY = window.innerHeight - baseHeight;
  return (
    Math.sinus(
      (sceneOffset * config.backgroundSpeedMultiplier + windowX) * stretch
    ) *
      amplitude +
    sineBaseY
  );
}

function getTreeY(x, baseHeight, amplitude) {
  const sineBaseY = window.innerHeight - baseHeight;
  return Math.sinus(x) * amplitude + sineBaseY;
}

function createElementStyle(element, cssStyles = null, inner = null) {
  const g = document.createElement(element);
  if (cssStyles) g.style.cssText = cssStyles;
  if (inner) g.innerHTML = inner;
  document.body.appendChild(g);
  return g;
}

function addShadow(colour, depth) {
  let shadow = "";
  for (let i = 0; i <= depth; i++) {
    shadow += `${i}px ${i}px 0 ${colour}`;
    shadow += i < depth ? ", " : "";
  }
  return shadow;
}



// Authenticated high-score display. Scores are stored per user on the server.
let myBestScore = 0;
const leaderboardTrigger = document.createElement('button');
leaderboardTrigger.type = 'button';
leaderboardTrigger.id = 'santa-high-score-trigger';
leaderboardTrigger.setAttribute('data-game-ui', '');
leaderboardTrigger.textContent = 'Best: —';
leaderboardTrigger.setAttribute('aria-label', 'View your high score and leaderboard');
document.body.appendChild(leaderboardTrigger);
const leaderboardOverlay = document.createElement('div');
leaderboardOverlay.id = 'santa-leaderboard-overlay';
leaderboardOverlay.setAttribute('data-game-ui', '');
leaderboardOverlay.hidden = true;
leaderboardOverlay.innerHTML = `<section class="santa-leaderboard-panel" role="dialog" aria-modal="true" aria-labelledby="santa-leaderboard-heading">
<div class="santa-leaderboard-head"><div class="santa-leaderboard-titles"><div class="santa-leaderboard-kicker">TOP 10</div><h2 id="santa-leaderboard-heading">Santa’s Helpers</h2></div><button type="button" id="santa-leaderboard-close" aria-label="Close leaderboard">×</button></div>
<p class="santa-leaderboard-subtitle">The North Pole’s finest bridge builders</p>
<ol id="santa-leaderboard-list"></ol>
<div id="santa-my-rank" aria-live="polite"></div>
</section>`;
document.body.appendChild(leaderboardOverlay);
const leaderboardButton = document.createElement('button');
leaderboardButton.type = 'button';
leaderboardButton.id = 'santa-view-leaderboard';
leaderboardButton.setAttribute('data-game-ui','');
leaderboardButton.textContent = 'VIEW LEADERBOARD';
document.body.appendChild(leaderboardButton);
function setBestScore(value) {
  myBestScore = Math.max(0, Number(value) || 0);
  leaderboardTrigger.textContent = `Best: ${myBestScore}`;
}
function showLeaderboard() {
  leaderboardOverlay.hidden = false;
  document.getElementById('santa-leaderboard-close').focus();
  void loadLeaderboard(true);
}
function closeLeaderboard() { leaderboardOverlay.hidden = true; leaderboardTrigger.focus(); }
leaderboardTrigger.addEventListener('click', showLeaderboard);
leaderboardButton.addEventListener('click', showLeaderboard);
document.getElementById('santa-leaderboard-close').addEventListener('click', closeLeaderboard);
leaderboardOverlay.addEventListener('click', event => { if (event.target === leaderboardOverlay) closeLeaderboard(); });
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !leaderboardOverlay.hidden) closeLeaderboard();
});

async function loadLeaderboard(showPanel = false) {
  const list = document.getElementById('santa-leaderboard-list');
  const myRank = document.getElementById('santa-my-rank');
  if (showPanel) { list.replaceChildren(); list.textContent = 'Loading scores…'; myRank.textContent = ''; }
  try {
    const response = await fetch('/api/christmas/santa-leaderboard', { cache:'no-store', credentials:'same-origin' });
    if (!response.ok) throw new Error('Leaderboard unavailable');
    const payload = await response.json();
    setBestScore(payload.myBest || 0);
    if (showPanel) {
      list.replaceChildren();
      const top = Array.isArray(payload.top) ? payload.top : [];
      if (!top.length) list.textContent = 'No scores yet. Be the first!';
      top.forEach(row => {
        const li = document.createElement('li');
        if (row.isMe) li.classList.add('santa-leaderboard-me');
        if (Number(row.position) >= 1 && Number(row.position) <= 3) li.classList.add(`santa-leaderboard-top-${Number(row.position)}`);
        const rank = document.createElement('span'); rank.textContent = Number(row.position) === 1 ? '🥇' : Number(row.position) === 2 ? '🥈' : Number(row.position) === 3 ? '🥉' : `#${row.position}`;
        const name = document.createElement('span'); name.textContent = row.firstName || 'Player';
        const points = document.createElement('strong'); points.textContent = String(row.bestScore);
        li.append(rank, name, points); list.appendChild(li);
      });
      if (payload.myRank) {
        myRank.textContent = `Your rank: #${payload.myRank}  ·  Best: ${payload.myBest || 0}`;
      } else myRank.textContent = 'Play a round to join the leaderboard!';
    }
  } catch {
    if (showPanel) { list.textContent = 'Unable to load leaderboard. Please try again.'; myRank.textContent = ''; }
  }
}
async function submitScore(value) {
  try {
    const response = await fetch('/api/christmas/santa-leaderboard', {
      method: 'POST', credentials:'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: Math.max(0, Math.floor(value)) })
    });
    if (!response.ok) throw new Error('Save failed');
    await loadLeaderboard(false);
  } catch { /* Keep gameplay available if scores cannot be saved. */ }
}
void loadLeaderboard(false);
