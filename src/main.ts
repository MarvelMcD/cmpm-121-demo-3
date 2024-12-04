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

// Inventory panel reference
const inventoryPanel = document.querySelector<HTMLDivElement>(
  "#inventoryPanel",
)!;

// Create a `Board` instance
const board = new Board(TILE_DEGREES, NEIGHBORHOOD_RADIUS);

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

// Interfaces
interface Cache {
  coins: Set<string>;
}

interface Inventory {
  items: Set<string>;
}

// Utility functions for inventory management
function createInventory(): Inventory {
  return { items: new Set() };
}

function addItem(inventory: Inventory, itemId: string): void {
  inventory.items.add(itemId);
}

function removeItem(inventory: Inventory, itemId: string): boolean {
  return inventory.items.delete(itemId); // Returns true if successful
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

// Spawn a cache at the given Cell
function spawnCache(cacheCell: Cell, inventory: Inventory): void {
  const cache: Cache = { coins: new Set() };

  // Get bounds for the cache's cell
  const bounds = board.getCellBounds(cacheCell);

  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Determine how many coins this cache will spawn with
  const numberOfCoins = Math.floor(Math.random() * (MAX_COINS_PER_CACHE + 1));

  // Generate unique coin IDs and add them to the cache
  for (let k = 0; k < numberOfCoins; k++) {
    const coinId = `coin_${cacheCell.i}_${cacheCell.j}_${k}_${
      luck(`${cacheCell.i},${cacheCell.j},coin${k}`).toString()
    }`;
    cache.coins.add(coinId);
  }

  // Bind a popup to the cache with interactive buttons
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
          cache.coins.add(coinToDeposit);
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
  const inventory = createInventory(); // Create the player's inventory
  renderInventory(inventory, inventoryPanel); // Render inventory

  // Get all visible cells near the player's starting position
  const visibleCells = board.getCellsNearPoint(OAKES_CLASSROOM);

  // Spawn caches for some of the cells
  for (const cell of visibleCells) {
    if (luck(`${cell.i},${cell.j}`) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(cell, inventory);
    }
  }
}

// Start the game
initializeGame();
