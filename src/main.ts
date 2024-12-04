// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";
import { Board, Cell } from "./board.ts";

// Location of our classroom (as identified on Google Maps)
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4; // Tile size on the map
const NEIGHBORHOOD_RADIUS = 8; // How many tiles around the player are visible
const CACHE_SPAWN_PROBABILITY = 0.1;
const MAX_COINS_PER_CACHE = 5;
const inventoryPanel = document.querySelector<HTMLDivElement>(
  "#inventoryPanel",
)!;

// Interfaces
interface Coin {
  i: number;
  j: number;
  serial: string; // Unique serial ID for the coin
}

interface Cache {
  coins: Set<string>;
}

interface Inventory {
  items: Set<string>;
}

// Utility Functions
function formatCoin(coin: Coin): string {
  return `${coin.i}:${coin.j}#${coin.serial.slice(0, 6)}`;
}

function createInventory(): Inventory {
  return { items: new Set() };
}

function addItem(inventory: Inventory, itemId: string): void {
  inventory.items.add(itemId);
}

function removeItem(inventory: Inventory, itemId: string): boolean {
  return inventory.items.delete(itemId); // Removes the item and returns `true` if it existed
}

function renderInventory(inventory: Inventory, container: HTMLElement): void {
  container.innerHTML = `<h3>Inventory</h3><ul>`;
  for (const item of inventory.items) {
    container.innerHTML += `<li>${item}</li>`;
  }
  container.innerHTML += `</ul>`;
}

function renderCacheCoins(cache: Cache, popupDiv: HTMLElement): void {
  const cacheCoinsDiv = popupDiv.querySelector(".cache-coins")!;
  cacheCoinsDiv.innerHTML = `<h4>Cache Coins:</h4>`;
  if (cache.coins.size === 0) {
    cacheCoinsDiv.innerHTML += `<p>No coins here</p>`;
  } else {
    cacheCoinsDiv.innerHTML += `<ul>${
      Array.from(cache.coins).map((coin) => `<li>${coin}</li>`).join("")
    }</ul>`;
  }
}

function addCoinToCache(cache: Cache, coin: Coin): void {
  if (!coin || coin.i == null || coin.j == null || !coin.serial) {
    console.error("Invalid coin provided:", coin);
    return;
  }

  const formattedCoin = formatCoin(coin);
  if (cache.coins.has(formattedCoin)) {
    console.warn(`Attempted to add a duplicate coin: ${formattedCoin}`);
    return; // Skip duplicates
  }

  cache.coins.add(formattedCoin);
}

// Create the map
const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

const playerMarker = leaflet.marker(OAKES_CLASSROOM);
playerMarker.bindTooltip("You are Here.");
playerMarker.addTo(map);

// `Board` instance to manage grid coordinates and tiles
const board = new Board(TILE_DEGREES, NEIGHBORHOOD_RADIUS);

// Spawn a cache in a given cell
function spawnCache(cacheCell: Cell, inventory: Inventory): void {
  const cache: Cache = { coins: new Set() };
  const bounds = board.getCellBounds(cacheCell);

  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Generate random coins for the cache and add to the cache
  const numberOfCoins = Math.floor(Math.random() * (MAX_COINS_PER_CACHE + 1));
  for (let k = 0; k < numberOfCoins; k++) {
    const coin: Coin = {
      i: cacheCell.i,
      j: cacheCell.j,
      serial: luck(`${cacheCell.i},${cacheCell.j},coin${k}`).toString(),
    };
    addCoinToCache(cache, coin);
  }

  // Bind a popup to the cache for interaction
  rect.bindPopup(() => {
    const popupDiv = document.createElement("div");

    popupDiv.innerHTML = `
          <div>Cache at location "${cacheCell.i},${cacheCell.j}"</div>
          <div class="cache-coins"></div>
          <button id="depositCoin">Deposit Coin</button>
          <button id="withdrawCoin">Withdraw Coin</button>
      `;
    renderCacheCoins(cache, popupDiv);

    // Deposit coin logic
    popupDiv.querySelector<HTMLButtonElement>("#depositCoin")!.addEventListener(
      "click",
      () => {
        const inventoryArray = Array.from(inventory.items);
        if (inventoryArray.length > 0) {
          const coinToDeposit = inventoryArray[0];
          removeItem(inventory, coinToDeposit);
          const [i, j, serial] = coinToDeposit.split(/[:#]/);
          addCoinToCache(cache, { i: +i, j: +j, serial });
          renderInventory(inventory, inventoryPanel);
          renderCacheCoins(cache, popupDiv);
        } else {
          alert("No coins in your inventory to deposit!");
        }
      },
    );

    // Withdraw coin logic
    popupDiv.querySelector<HTMLButtonElement>("#withdrawCoin")!
      .addEventListener("click", () => {
        if (cache.coins.size > 0) {
          const coinToWithdraw = Array.from(cache.coins)[0];
          cache.coins.delete(coinToWithdraw);
          addItem(inventory, coinToWithdraw);
          renderInventory(inventory, inventoryPanel);
          renderCacheCoins(cache, popupDiv);
        } else {
          alert("No coins in the cache to withdraw!");
        }
      });

    return popupDiv;
  });
}

// Initialize the game
function initializeGame(): void {
  const inventory = createInventory();
  renderInventory(inventory, inventoryPanel);

  // Calculate all visible cells around the starting point
  const visibleCells = board.getCellsNearPoint(OAKES_CLASSROOM);

  // Spawn caches in some of the visible cells
  for (const cell of visibleCells) {
    if (luck(`${cell.i},${cell.j}`) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(cell, inventory);
    }
  }
}

// Start the game
initializeGame();
